import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { request, ApiError, onUnauthorized } from '../src/lib/api.js';
import { DATA_BUCKETS, FEE_BUCKETS, loadCarriers } from '../src/lib/catalog-data.js';
import { parseDay, icsEscape, icsText, monthGrid, relativeDay, EVENTS_FROM_EXPIRY, EVENTS_FROM_TODAY, googleUrl, startOfToday, isoDay } from '../src/lib/schedule.js';
import { integer, buildRequest, DEFAULT_GB, splitLines, matches, matchesAll, clampDigits } from '../src/lib/model.js';

// 추천 요청은 화면이 세션에 담아 둔 입력으로 만든다(model.buildRequest). 요청을 만드는 곳은 그 함수 하나다 —
// 전에는 이 테스트가 아무 화면도 부르지 않는 낡은 빌더를 검사하고 있었다(레거시 정리 2026-09-18).
const base = { data: { gb: 20 }, subs: [{ id: 1, tierId: 2 }] };
const optionalOf = extra => buildRequest({ ...base, ...extra }).optional;

test('추천 요청은 서버 ID·enum·지원 필드만 담는다', () => {
  assert.deepEqual(buildRequest({ ...base, carrier: 'LGU+', networkType: '5G', contractType: 'SELECTIVE_25', hasFamilyBundle: false }), {
    required: { monthlyDataGb: 20, wantedServiceIds: [1], wantedTierIds: [2] },
    optional: { currentCarrier: 'LGU+', networkType: '5G', contractType: 'SELECTIVE_25', hasFamilyBundle: false },
  });
  // 모른다고 한 값은 아예 보내지 않는다 — 그래야 BE 의 missingInputs 안내가 남는다(원칙 5-①).
  assert.deepEqual(optionalOf({}), {});
  // 데이터를 건너뛰면 기본 기준으로 계산한다. 화면이 그 사실을 ⓘ 로 적는다.
  assert.equal(buildRequest({ subs: base.subs }).required.monthlyDataGb, DEFAULT_GB);
  // 디테일에서 '해지'로 정한 구독은 추천 대상이 아니다.
  assert.deepEqual(buildRequest({ ...base, subs: [{ id: 1, tierId: 2, disposition: '해지' }, { id: 3, tierId: 4, disposition: '유지' }] }).required,
    { monthlyDataGb: 20, wantedServiceIds: [3], wantedTierIds: [4] });
  // 지금 쓰는 요금제는 고른 경우에만 보낸다(G-30).
  assert.equal(optionalOf({ currentPlanId: 42 }).currentPlanId, 42);
  assert.equal('currentPlanId' in optionalOf({ currentPlanId: null }), false);
});

test('가족결합 회선 수·할인액은 결합 중일 때만, 정수 범위만 나간다 (G-28)', () => {
  const bundle = extra => optionalOf({ hasFamilyBundle: true, familyLineCount: '', familyBundleDiscountKrw: '', ...extra });
  assert.deepEqual(bundle({ familyLineCount: '3', familyBundleDiscountKrw: '11000' }),
    { hasFamilyBundle: true, familyLineCount: 3, familyBundleDiscountKrw: 11000 });
  assert.deepEqual(bundle({ familyBundleDiscountKrw: '0' }), { hasFamilyBundle: true, familyBundleDiscountKrw: 0 });
  // 회선 수는 2~10 만. 1회선·11회선은 버리고 할인액만 보낸다.
  assert.deepEqual(bundle({ familyLineCount: '1', familyBundleDiscountKrw: '5000' }), { hasFamilyBundle: true, familyBundleDiscountKrw: 5000 });
  assert.deepEqual(bundle({ familyLineCount: '11' }), { hasFamilyBundle: true });
  // 음수 할인액은 버린다. 결합이 아니면 회선 수·할인액을 적어도 함께 버린다.
  assert.deepEqual(bundle({ familyBundleDiscountKrw: '-5' }), { hasFamilyBundle: true });
  assert.deepEqual(optionalOf({ hasFamilyBundle: false, familyLineCount: '3', familyBundleDiscountKrw: '5000' }), { hasFamilyBundle: false });
});
test('clampDigits keeps digits only and caps at the given maximum', () => {
  assert.equal(clampDigits('55,000원', 200_000), '55000');
  assert.equal(clampDigits('250000', 200_000), '200000');
  assert.equal(clampDigits('', 200_000), '');
  assert.equal(clampDigits('abc', 200_000), '');
});
test('integer inputs do not silently rewrite invalid amounts or fractional GB', () => {
  for (const bad of ['', '-55000', '12.5', '1e3', '1,000', 'NaN', '9007199254740992']) assert.throws(() => integer(bad, '금액'));
  assert.equal(integer('0', '금액'), 0);
  assert.equal(integer(' 20 ', 'GB', 1), 20);
});
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
test('public calls unwrap nothing, retain warnings and never depend on auth', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/recommendations'); assert.equal(options.credentials, 'omit');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), buildRequest(base));
    return json({ data: { results: [] }, warnings: [{ code: 'YGB-EXT-001', message: '설명 실패' }] });
  });
  const response = await request('/api/v1/recommendations', { method: 'POST', body: buildRequest(base) });
  assert.equal(response.warnings[0].code, 'YGB-EXT-001');
});
test('each member mutation obtains fresh CSRF and uses cookies, including DELETE', async t => {
  let tokens = 0; const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url); assert.equal(options.credentials, 'include');
    if (url.endsWith('/csrf')) return json({ data: { headerName: 'X-CSRF-TOKEN', token: `token-${++tokens}` }, warnings: [] });
    assert.equal(options.headers['X-CSRF-TOKEN'], `token-${tokens}`);
    return json({ data: { ok: true }, warnings: [] });
  });
  await request('/api/v1/me/nickname', { member: true, method: 'POST', body: { nickname: '새닉' } });
  await request('/api/v1/me/sessions/abc', { member: true, method: 'DELETE' });
  assert.equal(tokens, 2); assert.equal(calls.length, 4);
});
test('회원 호출의 401 만 세션 재확인 콜백을 부른다', async t => {
  const seen = [];
  onUnauthorized(path => seen.push(path));
  t.mock.method(globalThis, 'fetch', async () => json({ error: { code: 'YGB-AUTH-001', message: '로그인 필요' } }, 401));
  await assert.rejects(request('/api/v1/me/subscriptions', { member: true }), e => e.status === 401);
  await assert.rejects(request('/api/v1/catalog/services'), e => e.status === 401);   // 공개 호출은 세션과 무관
  assert.deepEqual(seen, ['/api/v1/me/subscriptions']);
  onUnauthorized(() => {});
});
test('HTTP error code/field survives and network/non-JSON failures are actionable', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => json({ error: { code: 'YGB-REQ-001', message: '입력 확인', field: 'monthlyDataGb' } }, 400));
  await assert.rejects(request('/api/v1/recommendations'), e => e instanceof ApiError && e.status === 400 && e.field === 'monthlyDataGb');
  fetch.mock.mockImplementation(async () => new Response('<html>Bad gateway</html>', { status: 502 }));
  await assert.rejects(request('/api/v1/catalog/services'), /응답을 읽지/);
  fetch.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(request('/api/v1/catalog/services'), /서버에 연결하지/);
});
test('CSRF failure stops mutation and cancellation preserves AbortError', async t => {
  const calls = [];
  const fetch = t.mock.method(globalThis, 'fetch', async url => { calls.push(url); return json({ error: { message: 'CSRF unavailable' } }, 503); });
  await assert.rejects(request('/api/v1/me/nickname', { member: true, method: 'POST', body: {} }), /CSRF unavailable/);
  assert.deepEqual(calls, ['/api/v1/auth/csrf']);
  fetch.mock.mockImplementation(async (url, options) => { options.signal.throwIfAborted(); return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason))); });
  const controller = new AbortController(); const promise = request('/api/v1/recommendations', { signal: controller.signal }); controller.abort();
  await assert.rejects(promise, e => e.name === 'AbortError');
});

test('splitLines breaks on sentence ends only — amounts, dates and IDs stay on one line', () => {
  assert.deepEqual(
    splitLines('10GB 기준으로 계산했어요. 실제 사용량을 넣으면 정확해져요.'),
    ['10GB 기준으로 계산했어요.', '실제 사용량을 넣으면 정확해져요.']);
  // 마침표가 있어도 뒤에 공백이 없으면 한 덩어리다 — 날짜·소수·금액이 쪼개지면 안 된다.
  assert.deepEqual(splitLines('약정 종료 2026-11-30 기준 1.5GB ₩4,900'), ['약정 종료 2026-11-30 기준 1.5GB ₩4,900']);
  // 배열은 그대로 줄이 되고, 빈 값은 버린다.
  assert.deepEqual(splitLines(['약정 있음', '', null, '종료 2026-11-30']), ['약정 있음', '종료 2026-11-30']);
});

test('carrier list comes from the catalog and stays searchable', async () => {
  // 카탈로그에 실제로 들어 있는 표기를 그대로 쓴다. 예전에는 7개를 하드코딩했고 그 안의 이름이
  // 'M모바일' 이라 "kt" 를 쳐도 KT엠모바일이 나오지 않았다 — 걸릴 문자열이 없었다.
  const plans = [{ carrier: 'KT' }, { carrier: 'KT엠모바일' }, { carrier: 'KT엠모바일' },
    { carrier: 'SKT' }, { carrier: 'LG U+' }, { carrier: 'LG헬로모바일' }, { carrier: '토스모바일' }];
  const saved = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: plans, warnings: [] }),
    { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const carriers = await loadCarriers();
    // 중복 표기는 한 번만 나온다.
    assert.deepEqual([...new Set(carriers.map(c => c.name))].length, carriers.length);
    assert.deepEqual(new Set(carriers.map(c => c.name)),
      new Set(['KT', 'KT엠모바일', 'SKT', 'LG U+', 'LG헬로모바일', '토스모바일']));
    // MNO/MVNO 는 BE 의 carrier_type 파생 규칙과 같아야 한다(docs/domain.md §2).
    assert.deepEqual(carriers.filter(c => !c.mvno).map(c => c.name).sort(), ['KT', 'LG U+', 'SKT']);
    // 이 줄이 원래 버그다: "kt" 검색에 KT엠모바일이 나와야 한다.
    assert.ok(carriers.filter(c => matches(c.name, 'kt')).some(c => c.name === 'KT엠모바일'),
      '"kt" 로 검색하면 KT엠모바일이 나와야 한다');
    assert.deepEqual([...carriers].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(c => c.name),
      carriers.map(c => c.name), '목록은 한글 기준 정렬이어야 한다');
  } finally { globalThis.fetch = saved; }
});

test('range buckets carry a positive integer representative for BE (monthlyDataGb)', () => {
  for (const list of [DATA_BUCKETS, FEE_BUCKETS])
    for (const b of list)
      assert.ok(Number.isInteger(b.rep) && b.rep > 0, `${b.label} rep must be positive int`);
  // representative gb is what /recommendations receives; keep it in Java int range and non-skippable-safe
  assert.deepEqual(DATA_BUCKETS.map(b => b.rep), [2, 4, 10, 30, 80, 100]);
});

// 절대 원칙 2: 금액 계산은 BE_main 의 pricing 모듈만. 프론트는 서버 금액으로 산술하지 않는다.
// 기간 환산·절감액 뺄셈·합계가 되살아나면 여기서 잡는다.
// 2026-09-17: src 최상위 .js 만 보던 탓에 React 전환 뒤 훑는 파일이 0개였다 — 재귀 + .jsx 로 고쳤다.
test('front never does arithmetic on server amounts', () => {
  const MONEY = 'monthlyTotal|baseline|monthlySavings|annualSavings|currentTotal|wastedAmount|monthlyPrice';
  // (?<![\\w-]) 는 테일윈드 클래스(items-baseline, gap-3)를 코드로 오해하지 않게 한다.
  const word = `(?<![\\w-])(${MONEY})`;
  const arithmetic = new RegExp(`${word}\\s*[*/+-]\\s|[*/+-]\\s*[a-zA-Z_.]*${word}\\b`);
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.jsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []);
  const files = walk('src');
  assert.ok(files.length > 10, `훑은 파일이 ${files.length}개뿐이다 — 경로가 또 어긋났다`);
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');                 // 주석에 적힌 설명은 검사하지 않는다
      assert.ok(!arithmetic.test(code), `${file}:${i + 1} 가 서버 금액으로 계산한다 — ${line.trim()}`);
    });
  }
});

// 구독 금액은 목록에서 **원화 기준**으로 적고, 해외 결제 근거는 ⓘ 툴팁으로만 보낸다(사용자 결정 2026-09-18).
test('등급 금액은 원화 기준 · 해외 결제 근거는 따로 준다', async () => {
  const { tierPrice, foreignNote } = await import('../src/lib/model.js');
  assert.equal(tierPrice({ price: 7900 }), '7,900원');
  const usd = { price: 4.99, currency: 'USD', taxIncluded: false, krwEstimate: 7300 };
  assert.equal(tierPrice(usd), '약 7,300원(추정)');           // 해외 결제도 목록에는 원화로
  assert.match(foreignNote(usd), /\$4\.99 \+ 세금 10%/);      // 달러·세금은 ⓘ 안에만 있다
  assert.equal(foreignNote({ price: 7900 }), null);           // 국내 결제는 붙일 근거가 없다
  // 환산값이 없으면 원화를 지어내지 않는다 — 표기 통화를 그대로 적고, 그때는 ⓘ 도 없다(같은 말 반복 금지).
  assert.equal(tierPrice({ price: 4.99, currency: 'USD' }), '$4.99');
  assert.equal(foreignNote({ price: 4.99, currency: 'USD' }), null);
});

// 검색: 공백·대소문자를 무시한다. "요고38"로 "KT 요고 38"을 못 찾던 문제(2026-09-16).
test('matches — 띄어쓰기와 대소문자를 무시한다', async () => {
  const { matches } = await import('../src/lib/model.js');
  const plan = 'KT 요고 38';
  for (const query of ['요고 38', '요고38', 'KT요고38', 'kt 요고 38', ' 요고  38 ']) {
    assert.ok(matches(plan, query), `'${query}' 가 '${plan}' 을 찾지 못했다`);
  }
  assert.ok(matches(plan, ''), '빈 검색어는 전부 통과해야 한다');
  assert.ok(!matches(plan, '요고39'), '다른 요금제까지 잡으면 안 된다');
});

test('parseDay rejects impossible dates instead of rolling them over', () => {
  // new Date(2026,1,31) 은 3월 3일로 굴러간다 — 그걸 유효한 2/31 로 받아들이면 일정이 엉뚱한 날에 잡힌다.
  assert.equal(parseDay('2026-02-31'), null);
  assert.equal(parseDay('2026-13-01'), null);
  assert.equal(parseDay('20261130'), null);
  assert.equal(parseDay(''), null);
  assert.equal(parseDay('2026-11-30').getDate(), 30);
});

test('ICS escapes its own delimiters and keeps CRLF line endings', () => {
  // 쉼표·세미콜론·역슬래시는 ICS 의 구분자다. 그대로 두면 캘린더 앱이 필드를 잘못 나눈다.
  assert.equal(icsEscape('a,b;c\\d'), 'a\\,b\\;c\\\\d');
  assert.equal(icsEscape('첫 줄\n둘째 줄'), '첫 줄\\n둘째 줄');

  const anchor = parseDay('2026-11-30');
  const text = icsText(EVENTS_FROM_EXPIRY, anchor, { planLabel: 'SKT 5G', monthlyTotal: 73900 }, anchor);
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n'), 'RFC 5545 는 CRLF 를 요구한다');
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, EVENTS_FROM_EXPIRY.length);
  // 만료 14일 전 준비가 첫 일정이다.
  assert.ok(text.includes('DTSTART;VALUE=DATE:20261116'));
});

test('month grid pads to whole weeks and keeps day numbers', () => {
  const weeks = monthGrid(2026, 10);              // 2026-11: 1일이 일요일
  assert.ok(weeks.every(w => w.length === 7));
  assert.equal(weeks.flat().filter(d => d.getMonth() === 10).length, 30);
  // 2026-09: 1일이 화요일 → 앞 두 칸은 8월 30·31일, 마지막 줄 뒤는 10월 1~3일
  const sep = monthGrid(2026, 8);
  assert.deepEqual([sep[0][0].getDate(), sep[0][1].getDate(), sep.at(-1).at(-1).getDate()], [30, 31, 3]);
  assert.equal(relativeDay(new Date(2026, 10, 30), new Date(2026, 10, 30)), '오늘');
});

test('Google 캘린더 링크에 금액이 실리지 않는다', () => {
  // 이 설명은 질의문자열로 구글 서버에 전달된다. 개인정보처리방침 4조를 코드로 묶어 둔다.
  const result = { planLabel: 'KT 요고 38', monthlyTotal: 32390, monthlySavings: 34610 };
  const url = googleUrl(EVENTS_FROM_TODAY[0], startOfToday(), result);
  const details = new URL(url).searchParams.get('details');
  assert.ok(!/\d{1,3},\d{3}원/.test(details), `금액이 URL 에 들어갔다: ${details}`);
  assert.match(details, /KT 요고 38/);                       // 요금제 이름은 남는다
  assert.match(icsText(EVENTS_FROM_TODAY, startOfToday(), result), /32\\,390원/);  // .ics 는 그대로(쉼표는 ICS 이스케이프)
});

test('ICS UID 는 기준일이 바뀌어도 같다 — 다시 받으면 쌓이지 않고 옮겨진다', () => {
  const uids = text => [...text.matchAll(/^UID:(.+)$/gm)].map(m => m[1]);
  const a = uids(icsText(EVENTS_FROM_TODAY, new Date(2026, 0, 5), null));
  const b = uids(icsText(EVENTS_FROM_TODAY, new Date(2026, 5, 20), null));
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);                   // 한 파일 안에서는 서로 달라야 한다
});

// 사용자 제보(2026-09-18): "SKT 청년 59 같은 게 안 나온다". 통신사 이름을 앞에 붙여 치면 통짜 비교로는 안 걸렸다.
test('요금제 검색은 띄어쓴 낱말을 모두 포함하면 걸린다', () => {
  assert.ok(matchesAll('0 청년 다이렉트 62', 'SKT 청년', 'SKT'));     // 통신사 이름은 검색어에서 뺀다
  assert.ok(matchesAll('0 청년 다이렉트 62', '청년 62', 'SKT'));      // 순서가 달라도 걸린다
  assert.ok(matchesAll('0 청년 다이렉트 62', '', 'SKT'));             // 빈 검색어는 전부 통과
  assert.ok(!matchesAll('0 청년 다이렉트 62', 'SKT 청년 59', 'SKT')); // 진짜 없는 것은 없다고 나와야 한다
});

// 지금 요금제가 왜 후보에서 빠졌는지는 **BE 가 판정한다**(current.excluded, G-52).
// 화면이 규칙을 베끼면 거울이 하나 더 생기고, 실제로 그 거울이 틀렸다(2026-09-20 LG헬로모바일 사례).
test('제외 사유는 서버 값을 쓰고 화면이 다시 판정하지 않는다', () => {
  const code = readFileSync('src/pages/Results.jsx', 'utf8');
  assert.match(code, /current\?\.excluded/, 'current.excluded 를 읽지 않는다');
  assert.match(code, /function excludedSentence/, '사유 문장 함수가 없다');
  assert.ok(!/networkFits|wantMb/.test(code), '화면이 후보 조건을 다시 판정하고 있다 — 서버 값만 쓴다');
});

// '변경 최소' 열은 BE 의 minimalChange 다(D-55). 화면이 통신사로 고르면 SKT 사용자에게 알뜰폰이 '변경 최소'로 나왔다.
test('결과 화면은 변경 최소 조합을 BE minimalChange 로 받는다', () => {
  const code = readFileSync('src/pages/Results.jsx', 'utf8');
  assert.match(code, /'minimalChange' in data/, 'minimalChange 를 응답에서 읽지 않는다');
});

// 추천은 공개 경로지만 쿠키는 보내야 한다 — BE 가 principal 유무로 REPORT_SHOWN/GATE_SHOWN 을 가른다(D-36).
// 2026-09-18: 운영 백오피스에서 추천 호출 48 · 리포트 표시 0 이 찍혀 드러났다. credentials:'omit' 이라 회원이 전부 비회원으로 세지고 있었다.
test('추천 호출은 세션 쿠키를 함께 보낸다 — 퍼널이 회원을 비회원으로 세지 않게', () => {
  const code = readFileSync('src/pages/Results.jsx', 'utf8');
  const call = code.match(/request\(\s*'\/api\/v1\/recommendations'[^)]*\)/);
  assert.ok(call, '결과 화면이 추천을 부르지 않는다');
  assert.match(call[0], /session:\s*true/, "추천 호출에 session:true 가 없다 — 쿠키가 빠지면 REPORT_SHOWN 이 0 이 된다");
});

// BE SecurityConfig 는 /recommendations·/calculator 만 CSRF 를 면제한다(챗봇 경로는 D-44 로 사라졌다).
// 나머지 변경 요청은 member:true 로 보내야 request() 가 토큰을 붙인다 — 빠지면 403 이다.
// 2026-09-17: 제보(/catalog/reports)를 member 없이 보내 403 으로 죽던 것을 잡고 추가했다.
test('CSRF 면제 경로가 아닌 POST/DELETE 는 member:true 로 보낸다', () => {
  // 결손 기록(/catalog/gaps)도 추천과 같은 취급이다 — 공개·CSRF 면제(BE v50, D-56). 토큰 없이 200 인 것을 실측했다.
  const EXEMPT = ['/api/v1/recommendations', '/api/v1/calculator', '/api/v1/catalog/gaps'];
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.jsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []);
  const calls = [];
  for (const file of walk('src')) {
    const code = readFileSync(file, 'utf8');
    // request('<path>', { ... }) — 옵션 객체가 한 줄을 넘어가도 닫는 중괄호까지 집는다.
    for (const m of code.matchAll(/request\(\s*[`'"]([^`'"]+)[`'"]\s*,\s*\{([^}]*)\}/g))
      calls.push({ file, path: m[1], opts: m[2] });
  }
  assert.ok(calls.length > 3, `옵션을 넘기는 request 호출이 ${calls.length}개뿐이다 — 정규식이 어긋났다`);
  for (const { file, path, opts } of calls) {
    if (!/method:\s*['"](POST|DELETE|PUT|PATCH)/.test(opts)) continue;
    if (EXEMPT.some(e => path.startsWith(e))) continue;
    assert.match(opts, /member:\s*true/, `${file} 의 ${path} 가 CSRF 없이 나간다 — member: true 를 붙여야 한다`);
  }
});

// HTML→JSX 변환 잔재. 빌드는 통과하고(문법상 그냥 문자열 prop) 테스트도 렌더하지 않아
// /terms 가 운영에서 React #62 로 빈 화면이 된 뒤에야 발견됐다(2026-09-17).
test('JSX 에 HTML 속성이 남아 있지 않다', () => {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.jsx$/.test(e.name) ? [`${dir}/${e.name}`] : []);
  const files = walk('src');
  assert.ok(files.length > 10, `훑은 .jsx 가 ${files.length}개뿐이다 — 경로가 어긋났다`);
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const where = `${file}:${i + 1}`;
      // style 은 객체만 받는다. 문자열이면 렌더 순간 화면 전체가 죽는다.
      assert.ok(!/\sstyle="/.test(line), `${where} 의 style 이 문자열이다 — {{ }} 객체로 바꾼다`);
      assert.ok(!/\sclass="/.test(line), `${where} 에 class= 가 남았다 — className`);
      assert.ok(!/\sfor="/.test(line), `${where} 에 for= 가 남았다 — htmlFor`);
      assert.ok(!/\son(click|change|submit)=/.test(line), `${where} 에 소문자 이벤트 속성이 남았다`);
    });
  }
});

// 정책 3종은 .policy 안에 들어가야 최대폭·본문 타이포가 붙는다(index.css). 변환 때 여는 태그가
// 통째로 날아가 글이 화면 끝까지 퍼져 있었다 — 눈으로 보기 전엔 아무도 모른다.
test('정책 문서 3종은 .policy 래퍼 안에 있다', () => {
  for (const name of ['Terms', 'Privacy', 'DataSources']) {
    const code = readFileSync(`src/pages/${name}.jsx`, 'utf8');
    assert.match(code, /<main className="policy">/, `${name}.jsx 에 .policy 래퍼가 없다`);
    assert.match(code, /<\/main>/, `${name}.jsx 에 </main> 이 없다`);
  }
});

test('화면은 세션 입력(getInput/getResult)을 렌더 본문에서 읽지 않는다 — 무한 요청 회귀 가드', () => {
  // 렌더마다 JSON.parse 로 새 객체가 나오면 useEffect deps 가 매번 바뀌어 추천을 끝없이 다시 부른다(2026-09-18 운영 사고).
  // 마운트 때 한 번만 읽어야 한다: useState(getInput) / useMemo(getInput, []).
  for (const file of readdirSync('src/pages').filter(f => f.endsWith('.jsx'))) {
    const src = readFileSync(`src/pages/${file}`, 'utf8');
    assert.ok(!/^\s*const \w+ = get(Input|Result)\(\);/m.test(src), `${file}: 세션 값을 렌더마다 읽고 있다`);
  }
});

test('isoDay 는 UTC 로 밀리지 않는다 — 서버에 보내는 날짜가 하루 어긋나면 안 된다', () => {
  const local = new Date(2026, 11, 3);            // 2026-12-03 00:00 KST
  assert.equal(isoDay(local), '2026-12-03');
  assert.notEqual(isoDay(local), local.toISOString().slice(0, 10));
});
