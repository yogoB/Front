import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { request, ApiError } from '../src/api.js';
import { DATA_BUCKETS, FEE_BUCKETS, CARRIERS } from '../src/catalog-data.js';
import { integer, optionalInputs, recommendationRequest, calculatorRequest, validPassword, comparisonCsv, splitLines } from '../src/model.js';

const values = { monthlyDataGb: '20', currentCarrier: 'LGU+', networkType: '5G', contractType: 'SELECTIVE_25', hasFamilyBundle: 'false', fee: '55000', budget: '70000', contractEnd: '2027-01-01' };
const subs = [{ id: 1, tierId: 2, wanted: true }, { id: 3, tierId: 8, wanted: false }];
test('filter/calculator use server IDs, exact enums and only supported fields', () => {
  assert.deepEqual(recommendationRequest(values, subs), {
    required: { monthlyDataGb: 20, wantedServiceIds: [1] },
    optional: { currentCarrier: 'LGU+', networkType: '5G', contractType: 'SELECTIVE_25', hasFamilyBundle: false }
  });
  assert.deepEqual(calculatorRequest(5, optionalInputs(values), subs), { planId: 5, tierIds: [2], optional: optionalInputs(values) });
  assert.deepEqual(optionalInputs({ currentCarrier: '', networkType: '', contractType: '', hasFamilyBundle: '' }), {});
  assert.throws(() => recommendationRequest(values, [{ ...subs[0], wanted: false }]));
  assert.throws(() => calculatorRequest(5, {}, []));
  assert.throws(() => recommendationRequest(values, [{ ...subs[0], unavailable: true }]), /다시 선택/);
  assert.throws(() => calculatorRequest(5, {}, [{ ...subs[0], unavailable: true }]), /다시 선택/);
});
test('integer inputs do not silently rewrite invalid amounts or fractional GB', () => {
  for (const bad of ['', '-55000', '12.5', '1e3', '1,000', 'NaN', '9007199254740992']) assert.throws(() => integer(bad, '금액'));
  for (const bad of ['0', '-1', '2.5', '2147483648']) assert.throws(() => recommendationRequest({ ...values, monthlyDataGb: bad }, subs));
  assert.equal(integer('0', '금액'), 0);
  assert.equal(integer(' 20 ', 'GB', 1), 20);
});
test('password validation follows code point and UTF-8 byte limits', () => {
  validPassword('abcd1234'); validPassword('가'.repeat(23) + '1');     // 문자+숫자 8자 이상
  assert.throws(() => validPassword('abcd123'));                        // 7자
  assert.throws(() => validPassword('abcdefgh'));                       // 숫자 없음
  assert.throws(() => validPassword('12345678'));                       // 문자 없음
  assert.throws(() => validPassword('가'.repeat(24) + '1'));            // 72바이트 초과(bcrypt 한계)
  assert.throws(() => validPassword('a'.repeat(72) + '1'));
});
test('CSV preserves server amounts/provenance and neutralizes formula-like strings', () => {
  const csv = comparisonCsv([{ planId: 1, carrier: 'KT', planName: '=HYPERLINK("x")', monthlyTotal: 12345, baseline: 20000, monthlySavings: 7655, annualSavings: 91860,
    breakdown: [{ label: '할인, 항목', amount: -7655, provenance: 'DERIVED', note: '+악성\n문자열' }] }]);
  assert.ok(csv.includes('"12345"')); assert.ok(csv.includes('"-7655"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"')); assert.ok(csv.includes('"\'+악성\n문자열"'));
  assert.ok(csv.includes('"DERIVED"')); assert.ok(csv.startsWith('\uFEFF'));
});
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
test('public calls unwrap nothing, retain warnings and never depend on auth', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/recommendations'); assert.equal(options.credentials, 'omit');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), recommendationRequest(values, subs));
    return json({ data: { results: [] }, warnings: [{ code: 'YGB-EXT-001', message: '설명 실패' }] });
  });
  const response = await request('/api/v1/recommendations', { method: 'POST', body: recommendationRequest(values, subs) });
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
  await request('/api/v1/auth/login', { member: true, method: 'POST', body: { email: 'x@example.com', password: 'private' } });
  await request('/api/v1/me/sessions/abc', { member: true, method: 'DELETE' });
  assert.equal(tokens, 2); assert.equal(calls.length, 4);
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
  await assert.rejects(request('/api/v1/auth/login', { member: true, method: 'POST', body: {} }), /CSRF unavailable/);
  assert.deepEqual(calls, ['/api/v1/auth/csrf']);
  fetch.mock.mockImplementation(async (url, options) => { options.signal.throwIfAborted(); return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason))); });
  const controller = new AbortController(); const promise = request('/api/v1/chat/messages', { signal: controller.signal }); controller.abort();
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

test('carriers include majors and flag MVNO brands for BE mapping', () => {
  const names = CARRIERS.map(c => c.name);
  for (const major of ['SKT', 'KT', 'LG U+']) assert.ok(names.includes(major), `missing ${major}`);
  assert.ok(CARRIERS.some(c => c.mvno), 'need at least one 알뜰폰 brand flagged');
  assert.ok(CARRIERS.filter(c => c.mvno).every(c => c.name), 'mvno entries need names');
});

test('range buckets carry a positive integer representative for BE (monthlyDataGb)', () => {
  for (const list of [DATA_BUCKETS, FEE_BUCKETS])
    for (const b of list)
      assert.ok(Number.isInteger(b.rep) && b.rep > 0, `${b.label} rep must be positive int`);
  // representative gb is what /recommendations receives; keep it in Java int range and non-skippable-safe
  assert.deepEqual(DATA_BUCKETS.map(b => b.rep), [2, 4, 10, 30, 80, 100]);
});

// 절대 원칙 2: 금액 계산은 BE_main 의 pricing 모듈만. 프론트는 서버 금액으로 산술하지 않는다.
// 기간 환산·절감액 뺄셈이 되살아나면 여기서 잡는다.
test('front never does arithmetic on server amounts', () => {
  const MONEY = 'monthlyTotal|baseline|monthlySavings|annualSavings';
  const arithmetic = new RegExp(`(${MONEY})\\s*[*/+-]\\s|[*/+-]\\s*[a-zA-Z_.]*(${MONEY})\\b`);
  for (const file of readdirSync('src').filter(f => f.endsWith('.js'))) {
    readFileSync(`src/${file}`, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');                 // 주석에 적힌 설명은 검사하지 않는다
      assert.ok(!arithmetic.test(code), `src/${file}:${i + 1} 가 서버 금액으로 계산한다 — ${line.trim()}`);
    });
  }
});

// 검색: 공백·대소문자를 무시한다. "요고38"로 "KT 요고 38"을 못 찾던 문제(2026-09-16).
test('matches — 띄어쓰기와 대소문자를 무시한다', async () => {
  const { matches } = await import('../src/model.js');
  const plan = 'KT 요고 38';
  for (const query of ['요고 38', '요고38', 'KT요고38', 'kt 요고 38', ' 요고  38 ']) {
    assert.ok(matches(plan, query), `'${query}' 가 '${plan}' 을 찾지 못했다`);
  }
  assert.ok(matches(plan, ''), '빈 검색어는 전부 통과해야 한다');
  assert.ok(!matches(plan, '요고39'), '다른 요금제까지 잡으면 안 된다');
});
