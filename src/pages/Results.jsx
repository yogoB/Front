import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { Header, Footer } from '../components/Layout.jsx';
import { request, ApiError, backendUrl } from '../lib/api.js';
import { won, provenance, splitLines, searchKey, buildRequest, keptSubs, DEFAULT_GB } from '../lib/model.js';
import { UNLIMITED_DATA_MB } from '../lib/catalog-data.js';
import { getInput, setResult, setNext } from '../lib/session.js';
import { useMember } from '../lib/useMember.js';
import { LoginTeaser, MemberCheckFailed } from '../components/GuestGate.jsx';

/** 변경이 가장 적은 조합의 **옛 선택 방식**. BE 가 minimalChange 를 주기 전(v48 이전) 응답에서만 쓴다.
    BE 가 실질월비용 오름차순으로 정렬해 주므로(RecommendationService) 목록 순서를 그대로 쓴다 —
    화면은 고르기만 하고 다시 정렬하거나 금액을 만들지 않는다(절대 원칙 2, integration.md 결과 해석).
    통신사 비교 규칙도 BE 의 sameCarrier 와 같다(공백·대소문자 무시) — searchKey 가 그 정규화다. */
const fewestChanges = (results, carrier) =>
  (carrier && results.find(r => searchKey(r.carrier) === searchKey(carrier))) || results[0];

/** 결과를 받은 시각. 시안의 "실시간 통신사 API 연동" 같은 과장 대신 계산 기준 시각만 적는다. */
const stamp = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function Results() {
  const navigate = useNavigate();
  const member = useMember();
  // 마운트 때 한 번만 읽는다. 렌더마다 getInput() 을 부르면 JSON.parse 가 매번 새 객체를 만들어 아래 효과의
  // deps 가 바뀌고, setData → 리렌더 → 새 input → 재요청 … 추천을 무한 반복 호출했다(운영 실측 10초에 156회).
  const [input] = useState(getInput);
  const [data, setData] = useState(null);
  const [failure, setFailure] = useState('');
  const [months, setMonths] = useState(12);   // 절감액 기준 기간(시안 기본 12개월)
  const [plans, setPlans] = useState([]);     // 요금제 제원(데이터·통화 행) — 카탈로그에서 조회만 한다
  const [saveNote, setSaveNote] = useState('');
  const cardRef = useRef(null);
  // 설명(내레이션)은 처음엔 접혀 있고, 펼칠 때 따로 받는다(사용자 결정 2026-09-18, 내레이션 분리).
  // 첫 응답에 message 가 이미 실려 있으면(분리 전 BE) 호출 없이 그대로 쓴다.
  const [story, setStory] = useState('closed');   // closed | loading | open | failed
  const [told, setTold] = useState(null);         // narrate 응답 { message, notices, reasons? }

  function openStory() {
    if (data.message != null || told) { setStory('open'); return; }
    setStory('loading');
    request('/api/v1/recommendations/narrate', { method: 'POST', body: buildRequest(input) })
      .then(({ data: d }) => { setTold(d); setStory('open'); })
      .catch(() => setStory('failed'));
  }

  useEffect(() => {
    // 비회원도 계산까지 간다(사용자 결정 2026-09-18) — 로딩이 끝나면 절감액 한 줄을 보여주고 로그인을 청한다.
    // D-36 의 "계산도 하지 않는다"를 바꾼 것이다. 확인 중(undefined)·확인 실패(false)일 때만 기다린다.
    if (member === undefined || member === false || !input) return;
    if (!keptSubs(input).length) { setFailure('추천에 포함할 구독 서비스를 고르지 않았어요. 다시 선택해 주세요.'); return; }
    // session:true — 쿠키를 함께 보낸다. BE 가 principal 로 REPORT_SHOWN/GATE_SHOWN 을 가르므로(D-36)
    // 쿠키를 빼면 회원이 본 리포트도 전부 '게이트를 만난 비회원'으로 집계된다(운영에서 REPORT_SHOWN 이 0 이었다).
    request('/api/v1/recommendations', { method: 'POST', session: true, body: buildRequest(input) })
      .then(({ data }) => setData({ ...data, receivedAt: new Date() }))
      .catch(e => setFailure(e instanceof ApiError ? e.message : '추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
    request('/api/v1/catalog/plans').then(({ data }) => setPlans(data)).catch(() => {});
  }, [member, input]);

  if (!input) return <Empty message="모드를 선택하고 조건을 입력하면 결과를 볼 수 있어요." />;
  if (member === undefined) return <><Header /><p className="p-10 text-center text-muted">불러오는 중…</p></>;
  if (member === false) return <><Header /><MemberCheckFailed /></>;
  if (failure) return <Empty message={failure} />;
  if (!data) return <><Header /><p className="p-10 text-center text-muted">계산하는 중…</p></>;
  const guest = member === null;   // 리포트는 흐리고 티저 모달로 로그인을 청한다(아래).

  const current = data.current ?? null;   // currentPlanId 를 보냈고 카탈로그에 있을 때만. 없으면 입력값 합계 폴백
  // 3열의 두 조합(사용자 결정 2026-09-18). 둘 다 BE 가 계산해 순위까지 매긴 결과에서 고르기만 한다.
  //   2열 = 변경이 가장 적은 추천(지금 통신사 유지) — 우리가 미는 1안이다(UX 정책 규칙 2).
  //   3열 = 무조건 가장 싼 조합 = BE 정렬 1위. 통신사가 바뀔 수 있다.
  // 지금 통신사는 BE 가 확정한 current 를 먼저 믿고, 없으면 사용자가 고른 이름을 쓴다.
  const cheapest = data.results[0];
  const currentCarrier = current?.cost.carrier ?? input.carrier ?? null;
  // 2열은 BE 의 minimalChange 다(D-55) — "현재 통신사 안에서 가장 싼 조합"을 BE 가 고른다.
  // 화면이 고르면 SKT 사용자에게 알뜰폰이 '변경 최소'로 나오던 문제가 생겼다(사용자 테스트 2026-09-18).
  // null 은 "현재 통신사를 모르거나 그 통신사에 후보가 없다"는 뜻이라 열을 1순위로 채우고 안내를 붙인다.
  // 필드 자체가 없으면(구버전 BE) 옛 방식으로 고른다.
  const minimal = 'minimalChange' in data ? data.minimalChange : (cheapest && fewestChanges(data.results, currentCarrier));
  const recommended = minimal ?? cheapest;
  const sameAsCheapest = recommended?.planId === cheapest?.planId;
  const minimalKnown = Boolean(minimal);   // 현재 통신사 안에서 고른 것인가
  /* '변경 최소'가 지금보다 비싸면 **지금 요금제가 조건을 통과하지 못한 것**이다(G-51).
     BE 후보 질의(CatalogReader.findCandidatePlans)는 판매중·데이터·망·가입자격 넷만 보고 현재 요금제를
     빼지 않는다. 통과했다면 후보에 들어가 있고, 같은 통신사에서 가장 싼 것을 고르는 minimalChange 가
     그보다 비쌀 수 없다. BE 가 이 성질을 테스트로 고정해 두었다(RecommendationApiTest).
     두 금액을 견주기만 한다 — 차액은 적지 않는다(절대 원칙 2). */
  const minimalCostsMore = Boolean(current && minimalKnown && recommended.monthlyTotal > current.cost.monthlyTotal);
  // 왜 없는지는 둘 중 하나다 — 통신사를 모르거나, 알지만 그 통신사에 다른 후보가 없거나(예: SKT·LTE 는 카탈로그에 1건뿐).
  // 둘을 같은 문장으로 적으면 이미 통신사를 알려준 사람에게 또 알려달라고 하게 된다.
  const narrated = { ...data, ...(told ?? {}) };   // 설명 필드는 첫 응답 또는 narrate 응답에서
  const notices = buildNotices(input, narrated, recommended);
  const reasons = narrated.reasons ?? [];
  const planViews = {
    recommended: recommended && plans.find(p => p.id === recommended.planId),
    cheapest: cheapest && plans.find(p => p.id === cheapest.planId),
    current: current && plans.find(p => p.id === current.cost.planId),
  };
  // 6개월 탭은 BE 가 semiannualSavings 를 주기 시작하면 저절로 나타난다(계약 확정 2026-09-18).
  // 월 절감 ×6 으로 채우지 않는다 — 프론트 기간 환산은 절대 원칙 2 위반이다(contract.test.js 가드).
  const tabs = [1, 6, 12].filter(m => m !== 6 || recommended?.semiannualSavings != null);

  async function saveImage() {
    setSaveNote('');
    try {
      // 캡처는 화면에 있는 것만 담는다 — 숫자를 다시 그리지 않는다. 도구 줄(data-nocapture)만 뺀다.
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2, backgroundColor: '#ffffff',
        filter: node => !(node.dataset && 'nocapture' in node.dataset),
      });
      Object.assign(document.createElement('a'), { href: dataUrl, download: '요고비-요금비교.png' }).click();
    } catch { setSaveNote('이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  }

  async function saveToMyPage() {
    setSaveNote('저장 중…');
    try {
      // 스냅숏 금액은 BE 가 같은 계산기로 만들어 저장한다 — 화면 숫자를 되돌려 보내지 않는다(원칙 2·4).
      // tierIds 는 1개 이상 필수(BE 확정 2026-09-18, 계산기와 같은 검증). 화면 입력은 선택 시점에
      // 항상 tiers[0] 을 채우므로(Light·Detail) 유지 구독이 있는 한 비지 않는다. 50개 초과 409 는
      // 서버 문장을 그대로 보여준다(D-46) — 마이페이지에서 지우고 다시 저장하는 흐름이다.
      await request('/api/v1/me/saved-results', { method: 'POST', member: true,
        body: { planId: recommended.planId, tierIds: keptSubs(input).map(s => s.tierId).filter(Boolean), optional: buildRequest(input).optional } });
      setSaveNote('마이페이지에 저장했어요.');
    } catch (e) {
      setSaveNote(e instanceof ApiError && [404, 405].includes(e.status)
        ? '저장 기능을 준비 중이에요 — 서버가 아직 이 요청을 받지 않아요.'
        : e instanceof ApiError ? e.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <div className="min-h-screen bg-bg-page">
      <Header />
      {/* 비회원에게는 리포트를 흐려서 보여준다 — 읽히지 않게 하는 것은 아래 모달의 showModal(inert)이고,
          흐림은 "여기에 답이 있다"를 보이는 장치다. 화면 게이트일 뿐 API 는 여전히 공개다(D-36 주석 유지). */}
      <div className={guest ? 'select-none blur-[6px]' : undefined}>
      <main className="mx-auto max-w-page px-6 py-8">
        <span className="inline-block rounded-full bg-bg-soft px-3 py-1.5 text-[13px] font-bold text-ink-soft">
          최적화 완료
        </span>
        <h1 className="mb-1 mt-4 text-2xl font-extrabold tracking-[-.01em] md:text-[28px]">최적 요금 조합 비교 분석</h1>
        <p className="mb-6 text-sm text-muted">카탈로그 가격 기준 · {stamp(data.receivedAt)} 계산</p>

        {/* 계산 결과(표)가 먼저다 — 사용자 결정 2026-09-18: 처음 보이는 것은 비교표 카드뿐이고, 설명(내레이션)은 아래에서 펼친다.
            시안의 결과 카드 하나 — 기간 토글·저장 아이콘·3열 비교표·추천 사유를 한 판에 담는다. */}
        {recommended && (
          <section ref={cardRef} className="card overflow-hidden">
            <div data-nocapture className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-soft">
                절감액 기준 기간:
                {tabs.map(m => (
                  <button key={m} type="button" onClick={() => setMonths(m)} aria-pressed={months === m}
                          className={`min-h-11 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold transition-colors
                            ${months === m ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft hover:bg-bg-soft'}`}>
                    {m}개월
                  </button>
                ))}
              </div>
              {saveNote && <span role="status" className="text-[13px] font-semibold text-ink-soft">{saveNote}</span>}
            </div>
            <CompareTable input={input} recommended={recommended} cheapest={cheapest} sameAsCheapest={sameAsCheapest}
                          minimalKnown={minimalKnown} currentCarrier={currentCarrier} minimalCostsMore={minimalCostsMore}
                          excluded={current?.excluded ?? null} subs={keptSubs(input)}
                          current={current} months={months} planViews={planViews}
                          tools={
                            /* 저장·내려받기는 세 번째 열 머리 오른쪽에 둔다(사용자 결정 2026-09-18).
                               둘 다 리포트 전체를 다루므로 대상을 label 에 적는다 — 셋째 열만 저장한다고 읽히지 않게. */
                            /* -my-2.5: 44px 누름면(접근성)을 유지하면서 머리 줄 높이는 그대로 둔다. */
                            <span data-nocapture className="-my-2.5 flex items-center gap-0.5">
                              <IconButton label="추천 조합을 마이페이지에 저장" onClick={saveToMyPage}><BookmarkIcon /></IconButton>
                              <IconButton label="리포트 이미지로 내려받기" onClick={saveImage}><DownloadIcon /></IconButton>
                            </span>
                          } />
            {reasons.length > 0 && <Reasons reasons={reasons} />}
          </section>
        )}
        {recommended && <SaveResult input={input} best={recommended} current={current} />}

        {input.mode === 'light' && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white px-6 py-5">
            <div>
              <strong className="font-bold">더 정밀한 결과를 원하시나요?</strong>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">통신사·약정·결합 할인을 추가 반영하면 더 정확한 조합을 찾을 수 있어요.</p>
            </div>
            <button type="button" onClick={() => navigate('/detail')} className="btn btn-dark">더 정확한 절감받기</button>
          </div>
        )}

        {story !== 'open' ? (
          <button type="button" onClick={openStory} disabled={story === 'loading'} className="btn btn-ghost btn-block mt-6 bg-white">
            {story === 'loading' ? '설명을 만드는 중…' : story === 'failed' ? '설명을 불러오지 못했어요 — 다시 시도' : '이 결과 설명 보기 ↓'}
          </button>
        ) : (
          <section className="mt-6" aria-label="결과 설명">
            {recommended && <SaveHero best={recommended} current={current} sameAsCheapest={sameAsCheapest} />}
            <Summary message={narrated.message} />
            <p className="my-6 max-w-prose rounded-xl bg-warn-tint px-4 py-3 text-sm leading-relaxed text-warn-ink">
              {current
                ? <>‘현재’ 열도 추천과 <strong>같은 계산기</strong>로 냈어요 — 지금 쓰는 요금제로 같은 구독을 유지했을 때의 금액이에요.</>
                : <>‘추천·정가’ 금액과 요금제는 계산 서버가 카탈로그로 계산한 값입니다. ‘현재’ 열은{' '}<strong>입력하신 값의 합계</strong>예요.</>}
            </p>
            {notices.length > 0 && (
              <ul className="mb-6 grid list-none gap-2.5 rounded-xl border border-line bg-white px-5 py-4 text-sm leading-relaxed text-ink-soft">
                {notices.map(text => (
                  <li key={text} className="max-w-[72ch]">
                    <span className="text-muted">ⓘ </span>
                    {splitLines(text).map((line, i) => <span key={i} className="block first:inline">{line}</span>)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <ul className="mt-8 flex list-none flex-wrap gap-2.5 p-0">
          {['금액마다 출처 표시', '안 쓰는 혜택은 0원으로 계산', '카드·계좌 연결 없음'].map(t => (
            <li key={t} className="chip bg-white"><span className="size-1.5 rounded-full bg-ink" aria-hidden="true" />{t}</li>
          ))}
        </ul>

        {recommended && <Breakdown best={recommended} />}
        {recommended && <ReportWrong planId={recommended.planId} planName={recommended.planName} />}

        {/* '다시 비교하기'는 뺐다(사용자 결정 2026-09-18) — 다음 행동은 하나다. 조건을 고치려면 헤더·뒤로가기로 간다. */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[13px] text-muted">ⓘ 상기 분석 결과는 통신사별 결합 형태에 따라 실제 고지 금액과 다를 수 있습니다.</p>
          <button type="button" onClick={() => navigate('/calendar')} className="btn btn-dark">이렇게 진행해보세요! →</button>
        </div>
      </main>
      <div className="mx-auto w-full max-w-page px-6"><Footer /></div>
      </div>
      {guest && (
        <LoginTeaser {...teaserSaving(data)}
                     onGoogle={() => { setNext('/results'); location.href = backendUrl('/oauth2/authorization/google'); }}
                     onBack={() => navigate('/modes')} />
      )}
    </div>
  );
}

/** 티저 한 줄에 쓸 절감액. BE 가 준 값 중 가장 큰 것을 **고르기만** 한다 — 빼거나 곱하지 않는다(절대 원칙 2).
    지금 쓰는 요금제를 알려준 사람에게는 '지금보다' 절감액이 더 정확하다(G-30). */
function teaserSaving(data) {
  if (data.current) return { amount: data.current.monthlySavings, basis: '지금 요금제보다' };
  return {
    amount: data.results.reduce((top, r) => (r.monthlySavings > top ? r.monthlySavings : top), 0),
    basis: '정가 대비',
  };
}

const IconButton = ({ label, onClick, children }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
          className="grid size-11 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-ink-soft hover:bg-bg-soft">
    {children}
  </button>
);

const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
);
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></svg>
);

/* 결론 먼저(원칙 5-③) — 다만 금액을 하나도 만들지 않는다(원칙 2). 설명 펼침 안에서만 보인다.
   월·연 절감은 BE 의 monthlySavings·annualSavings 를 그대로 쓴다. 기준은 정가(baseline)이며
   사용자의 현재 청구액이 아니다(integration.md 결과 해석). */
function SaveHero({ best, current, sameAsCheapest = true }) {
  // current 가 있으면 "지금보다" 가 기준이다(G-30). 차액은 BE 가 뺀 값(current.monthlySavings)을 그대로 쓴다 —
  // 화면에서 current − best 를 다시 계산하지 않는다. 음수(지금이 더 쌈)도 숨기지 않는다.
  let head, amount, foot;
  if (current) {
    const diff = current.monthlySavings;
    // 이 차액은 BE 가 1순위(최저가 조합)와 견준 값이다 — 가운데 열이 그것과 다르면 그렇게 적는다.
    const basis = sameAsCheapest ? '' : ' · 최저가 조합 기준';
    if (diff > 0) { head = '지금보다 매달'; amount = won(diff); foot = `1년이면 ${won(current.annualSavings)}${basis}`; }
    else if (diff < 0) { head = '지금 요금제가 더 싸요 — 매달'; amount = won(-diff); foot = `추천 조합으로 옮기면 그만큼 더 내요${basis}`; }
    else { head = '지금과 같은 금액이에요'; amount = won(best.monthlyTotal); foot = '옮겨도 월 요금은 그대로예요'; }
  } else {
    const saving = best.monthlySavings > 0;
    head = saving ? '정가 대비 매달' : '추천 조합은 매달';
    amount = won(saving ? best.monthlySavings : best.monthlyTotal);
    // 절감 0 은 "못 찾음"이 아니라 기준이 정가라는 뜻이다. 입력 구간 대표값과 빼지 않는다 — 화면이 금액을 만들지 않는다.
    foot = saving ? `1년이면 ${won(best.annualSavings)}` : '정가 기준 금액이에요 — 지금 쓰는 요금제를 알려주시면 얼마나 아끼는지 계산해요';
  }
  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-6 rounded-card bg-brand-tint px-6 py-6 md:px-8">
      <div>
        <span className="block text-sm font-semibold text-brand-ink">{head}</span>
        <strong className="my-1 block text-[40px] font-extrabold leading-tight tracking-[-.02em] text-brand-strong tnum">{amount}</strong>
        <span className="block text-sm font-semibold text-ink-soft">{foot}</span>
      </div>
      <dl className="m-0 flex flex-wrap gap-2.5">
        <Delta label="추천 조합" value={won(best.monthlyTotal)} />
        {current && <Delta label="지금 요금제" value={won(current.cost.monthlyTotal)} />}
        <Delta label="정가 기준" value={won(best.baseline)} />
      </dl>
    </section>
  );
}

const Delta = ({ label, value }) => (
  <div className="min-w-[128px] rounded-xl bg-white px-4 py-3">
    <dt className="text-xs font-semibold text-muted">{label}</dt>
    <dd className="m-0 mt-0.5 text-lg font-bold tnum">{value}</dd>
  </div>
);

/* 모르면 막히지 않는다(원칙 5-①): 빠진 입력과 카탈로그 결손을 그대로 안내한다. */
/* ⓘ 안내. missingInputs 문장은 서버(notices)가 만든다 — 같은 값으로 두 곳에서 문장을
   만들면 표현이 갈라진다(D-46). 여기 남는 둘은 서버가 알 수 없는 것뿐이다:
   데이터 입력을 건너뛴 화면 상태와, 결과가 없어 서버가 내레이터를 부르지 않은 경우. */
function buildNotices(source, data, best) {
  const notices = [];
  if (!source.data) notices.push(`데이터 사용량을 건너뛰어 ${DEFAULT_GB}GB 기준으로 계산했어요. 실제 사용량을 넣으면 결과가 정확해져요.`);
  notices.push(...(data.notices || []));
  if (!best) notices.push('조건에 맞는 요금제를 아직 찾지 못했어요. 조건을 바꾸거나 잠시 후 다시 시도해 주세요.');
  return notices;
}

/** 사용자가 입력한 현재 월 지출 합계 — data.current 가 없을 때의 폴백 메모다. 절감액 계산에는 쓰지 않는다. */
function currentTotal(source) {
  if (source.fee?.amount === undefined) return null;
  return source.fee.amount + keptSubs(source).reduce((sum, s) => sum + (s.price || 0), 0);
}

/** 요금제 기본료 줄. BE CostCalculator 가 "<요금제명> 기본료" 라벨로 만든다 — 그 라벨을 그대로 찾는다. */
const baseFee = cost => cost.breakdown.find(l => l.label.endsWith('기본료'));

/** 카탈로그 제원 표기(금액이 아니라 데이터·통화 수량 — 표기 변환만 한다). null 은 미확인이다. */
const fmtData = mb => mb == null ? null : mb === UNLIMITED_DATA_MB ? '무제한'
  : `${mb % 1024 ? (mb / 1024).toFixed(1) : mb / 1024}GB`;

/* 요금제 망 표기. LTE_5G 는 통합요금제(5G·LTE 양쪽)다. */
const NETWORK_LABEL = { FIVE_G: '5G', LTE: 'LTE', LTE_5G: '5G/LTE 통합', THREE_G: '3G' };

/* 지금 요금제가 후보에서 빠진 사유. **판정은 BE 가 한다**(current.excluded, G-52) —
   후보 질의의 절을 그대로 한 행에 적용한 결과다. 화면이 규칙을 베껴 두면 거울이 하나 더 생기고,
   실제로 그 거울이 틀렸다(데이터가 넉넉한데 "데이터가 모자라요", 2026-09-20). 화면은 문장만 만든다.
   ageLimit 은 카탈로그 원문이라 제한 없는 요금제도 'ALL' 이 온다 — ELIGIBILITY 일 때만 쓴다. */
function excludedSentence(excluded, requiredLabel) {
  if (!excluded) return null;
  const { reason, planDataMb, requiredDataMb, planNetwork, requiredNetwork, ageLimit } = excluded;
  if (reason === 'DATA')
    return `지금 요금제의 데이터는 ${fmtData(planDataMb) ?? '확인 필요'}, 원하시는 건 ${requiredLabel === '무제한' ? '무제한' : fmtData(requiredDataMb) ?? '그보다 많아요'}예요.`;
  if (reason === 'NETWORK')
    return `지금 요금제는 ${NETWORK_LABEL[planNetwork] ?? planNetwork} 전용인데 ${requiredNetwork} 로 찾으셨어요.`;
  if (reason === 'ELIGIBILITY')
    return `지금 요금제는 ${ageLimit ? `${ageLimit} 자격` : '가입 자격'}이 있어야 해서 후보에서 뺐어요.`;
  if (reason === 'INACTIVE') return '지금 요금제는 더 이상 판매하지 않아요.';
  return null;
}
const fmtVoice = min => min == null ? '확인 필요' : min === 0 ? '미제공' : `${min.toLocaleString('ko-KR')}분`;

/** 결과 한 건(results[]·current.cost 모두 같은 모양)에서 비교표 열에 적을 사실을 뽑는다.
    내역 줄의 금액은 '비용'이다. 제휴 혜택은 note 로 표시되므로 그 줄만 혜택으로 센다. */
/** 할인/적립 칸. 음수 줄과 묶음 줄을 함께 적는다 — 금액은 BE 값을 그대로 옮긴다. */
function discountLines(cost) {
  const cut = cost.breakdown.filter(l => l.amount < 0).map(l => `${l.label} ${won(l.amount)}`);
  const bundled = cost.breakdown.filter(l => l.note === '번들 적용')
    .map(l => `${l.label}으로 묶어서 따로 살 때보다 싸요`);
  if (cut.length || bundled.length) return [...cut, ...bundled];
  return cost.baseline !== cost.monthlyTotal ? ['정가보다 싸요 — 아래 “계산 과정과 출처 보기”에 내역이 있어요'] : [];
}

function columnFacts(cost) {
  return {
    plan: <PlanChip carrier={cost.carrier} name={cost.planName} />,
    fee: baseFee(cost) ? won(baseFee(cost).amount) : '—',
    benefits: cost.breakdown.filter(l => l.note === '제휴 혜택 적용').map(l => `${l.label} ${won(l.amount)}`),
    // 깎인 금액은 음수 줄로 온다. 묶음 상품(Apple One·티빙x웨이브)은 다르다 — 여러 등급을 한 줄로 바꿔 넣어
    // 음수 줄이 없는데도 정가보다 싸다. BE 가 그 줄에 "번들 적용"을 달아 주므로 이름을 그대로 적는다(2026-09-20).
    // 둘 다 없는데 정가와 체감가가 다르면 이유를 모르는 것이라 계산 과정을 보라고만 한다 — 지어내지 않는다.
    discounts: discountLines(cost),
  };
}

/* 시안의 통신사 로고 자리 — 실제 로고는 상표라 이니셜 원으로 그린다. 카탈로그에 없는 통신사는 회색. */
const CARRIER_BADGE = { SKT: ['SK', '#26334d'], KT: ['KT', '#e2231a'], 'LGU+': ['LG', '#e6007e'] };
function PlanChip({ carrier, name }) {
  const [abbr, color] = CARRIER_BADGE[carrier] ?? [String(carrier).slice(0, 2), '#6e6f85'];
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span aria-hidden="true" style={{ background: color }}
            className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white">{abbr}</span>
      {carrier} {name}
    </span>
  );
}

function CompareTable({ input, recommended, cheapest, sameAsCheapest, minimalKnown = true, currentCarrier, minimalCostsMore = false, excluded = null, subs = [], current, months, planViews, tools }) {
  const rec = columnFacts(recommended);
  const low = columnFacts(cheapest);
  // '현재' 열: BE 가 같은 계산기로 낸 current.cost 가 있으면 그것, 없으면 입력값 합계(폴백).
  const cur = current ? columnFacts(current.cost) : null;
  const curTotal = current ? won(current.cost.monthlyTotal) : (currentTotal(input) === null ? '—' : won(currentTotal(input)));
  // 기간 절감액은 BE 값 그대로다(1=monthlySavings, 6=semiannualSavings, 12=annualSavings). 곱하지 않는다(절대 원칙 2).
  const periodSaving = months === 12 ? recommended.annualSavings
    : months === 6 ? recommended.semiannualSavings : recommended.monthlySavings;
  const spec = (view, fallback) => fmtData(view?.dataMb) ?? fallback;
  const guessed = input.data ? `${input.data.label} 충족` : `${DEFAULT_GB}GB 기준 충족`;
  const exclusion = excludedSentence(excluded, input.data?.label);

  const rows = [
    ['요금제 (Plan)', cur ? cur.plan : input.currentPlanLabel ?? (input.carrier ? `${input.carrier} · 현재 요금제` : '현재 요금제'), rec.plan, low.plan],
    // 월 요금 = 요금제 기본료 줄(구독 제외). 현재 열 폴백은 사용자가 입력한 월 통신비다.
    ['월 요금 (Monthly)', cur ? cur.fee : input.fee?.amount != null ? won(input.fee.amount) : '—', rec.fee, low.fee],
    ['데이터 (Data)',
      planViews.current ? (fmtData(planViews.current.dataMb) ?? '확인 필요') : input.data ? input.data.label : '모름',
      spec(planViews.recommended, guessed), spec(planViews.cheapest, guessed)],
    ['통화 (Calls)', planViews.current ? fmtVoice(planViews.current.voiceMin) : '확인 필요',
      fmtVoice(planViews.recommended?.voiceMin), fmtVoice(planViews.cheapest?.voiceMin)],
    ['부가혜택 (Benefits)', cur ? (cur.benefits.length ? cur.benefits : ['포함된 구독 혜택 없음']) : '—',
      rec.benefits.length ? rec.benefits : ['포함된 구독 혜택 없음'],
      low.benefits.length ? low.benefits : ['포함된 구독 혜택 없음']],
    ['할인/적립 (Discounts)', cur ? (cur.discounts.length ? cur.discounts : ['적용된 할인 없음']) : '—',
      rec.discounts.length ? rec.discounts : ['적용된 할인 없음'],
      low.discounts.length ? low.discounts : ['적용된 할인 없음']],
    ['약정 기간 (Contract)',
      input.contract?.has ? ['약정 있음', input.contract.endDate && `종료 ${input.contract.endDate}`].filter(Boolean) : ['무약정'],
      '선택약정 미반영', '선택약정 미반영'],
    // 통신사를 옮기는 조합은 지금 약정의 위약금이 남는다 — 금액은 BE 에 없으므로 '확인 필요'로 적는다.
    ['위약금 (Penalty)', input.contract?.has ? '확인 필요' : '없음', '확인 필요', '확인 필요'],
  ];

  const columns = [
    { tone: 'now', title: '현재 상황', sub: current ? '지금 요금제 · 같은 계산기' : '현재 통신사 및 납부 요금', total: curTotal,
      plan: rows[0][1] },
    { tone: 'best', best: true, title: '추천 · 변경 최소 🌟',
      sub: !minimalKnown ? (currentCarrier ? `${currentCarrier} 안에는 조건을 맞추는 요금제가 없어 전체 1순위를 적었어요` : '지금 조건에서 가장 나은 조합 · 체감 환산 월 요금')
        : sameAsCheapest ? `${recommended.carrier} 그대로가 가장 싼 조합이에요`
        : `${recommended.carrier} 그대로 · 번호이동 없이 바꾸는 조합`,
      total: won(recommended.monthlyTotal), plan: rows[0][2],
      save: recommended.monthlySavings > 0 ? `정가 대비 ${months === 12 ? '연' : months === 6 ? '6개월' : '월'} ${won(periodSaving)} 절감` : '' },
    { tone: 'base', title: '최저가 조합',
      sub: sameAsCheapest ? '추천 조합과 같은 조합이에요' : `월 총액이 가장 낮은 조합 · ${cheapest.carrier} 로 옮겨야 해요`,
      total: won(cheapest.monthlyTotal), plan: rows[0][3] },
  ];

  return (
    <div className="border-t border-line">
      {/* 조건을 맞추는 가장 싼 안이 지금보다 비쌀 수 있다. 숫자 둘만 두면 "더 비싼 걸 추천했다"로 읽힌다(2026-09-20). */}
      {minimalCostsMore && (
        <p className="bg-warn-tint px-4.5 py-2.5 text-[13px] leading-relaxed text-warn-ink">
          <strong>지금 요금제가 더 싸요.</strong> 다만 지금 요금제로는 원하시는 조건을 맞출 수 없어요.
          {exclusion && ` ${exclusion}`}
          {' '}가운데 열은 {currentCarrier ? `${currentCarrier} 안에서 ` : ''}그 조건을 맞추는 가장 싼 조합이에요.
          조건이 지금으로 충분하면 그대로 두셔도 괜찮아요.
        </p>
      )}
      {!minimalKnown && (
        <p className="bg-bg-soft px-4.5 py-2.5 text-[13px] leading-relaxed text-muted">
          {currentCarrier
            ? <><strong className="text-ink-soft">{currentCarrier}</strong> 안에는 원하시는 조건을 맞추는 요금제가 없어요.
                지금 두 열은 같은 조합이고, 옮기려면 통신사를 바꿔야 해요.</>
            : <>현재 통신사를 알려주시면 <strong className="text-ink-soft">번호이동 없이 바꾸는 안</strong>도 따로 찾아드려요.
                지금 두 열은 같은 조합이에요.</>}
        </p>
      )}
      <Dashboard columns={columns} subs={subs} tools={tools} />

      {/* 항목별 비교는 접어 둔다(사용자 결정 2026-09-21) — 처음 보이는 것은 카드 셋이고, 표는 눌러서 편다. */}
      <details className="group border-t border-line">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-1.5 px-4 text-sm font-semibold text-ink-soft hover:bg-bg-soft [&::-webkit-details-marker]:hidden">
          항목별로 자세히 비교하기
          <svg className="transition-transform group-open:rotate-180" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
      <div className="overflow-x-auto border-t border-line">
      {/* fixed: 내용 길이와 무관하게 비교 3열의 가로 폭을 똑같이 준다. */}
      <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
        <colgroup><col className="w-[19%]" /><col className="w-[27%]" /><col className="w-[27%]" /><col className="w-[27%]" /></colgroup>
        <thead>
          <tr>
            <th scope="col" className="border-b-2 border-line bg-bg-soft px-4.5 py-3.5 text-left align-top">
              <span className="text-[15px] font-semibold text-muted">상세 구분 항목</span>
            </th>
            <ColHead title="현재 상황">{curTotal}</ColHead>
            <ColHead title="추천 · 변경 최소" best>{won(recommended.monthlyTotal)}</ColHead>
            <ColHead title="최저가 조합">
              {/* 정가와 체감가가 같으면(할인 없음) 취소선을 긋지 않는다 — 같은 금액을 두 번 적는 꼴이다. */}
              {cheapest.baseline !== cheapest.monthlyTotal &&
                <s className="mr-2 text-sm font-semibold text-muted">{won(cheapest.baseline)}</s>}
              {won(cheapest.monthlyTotal)}
            </ColHead>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cur, rec, low]) => (
            <tr key={label}>
              <th scope="row" className="border-b border-line bg-bg-soft px-4.5 py-3.5 text-left align-top font-semibold text-ink-soft">
                {label}
              </th>
              <Cell value={cur} />
              <Cell value={rec} best />
              <Cell value={low} />
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      </details>
    </div>
  );
}

/* 결과 대시보드(사용자 결정 2026-09-21). 카드 셋만으로 결론이 읽혀야 한다 —
   애플 비교표처럼 검정 외곽선·넉넉한 여백·한 가지 강조만 둔다. 금액·요금제는 BE 값 그대로다.
   고른 구독은 세 카드에 같은 목록으로 적는다 — 어떤 조합이든 그대로 유지하는 것이 계산 전제다. */
function Dashboard({ columns, subs, tools }) {
  return (
    <div className="border-t border-line p-4 sm:p-5">
      {tools && <div className="mb-3 flex justify-end">{tools}</div>}
      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        {columns.map(col => (
          <section key={col.title}
                   className={`flex flex-col rounded-2xl border border-ink bg-white p-5
                     ${col.best ? 'shadow-[0_0_0_3px_rgb(23_24_42_/_12%)]' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[13px] font-bold ${col.best ? 'text-ink' : 'text-muted'}`}>{col.title}</span>
              {col.best && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white">추천</span>}
            </div>
            <p className="mt-1 min-h-[2.6em] text-xs leading-relaxed text-muted">{col.sub}</p>
            <p className="mt-3 whitespace-nowrap text-[30px] font-extrabold leading-none tracking-[-.03em] tnum">{col.total}</p>
            {col.save
              ? <p className="mt-2 text-[13px] font-bold text-ink-soft">{col.save}</p>
              : <p className="mt-2 text-[13px] text-muted">&nbsp;</p>}
            <div className="mt-4 border-t border-line pt-3 text-sm">
              <p className="font-semibold">{col.plan}</p>
              {subs.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-semibold text-muted">함께 쓰는 구독</p>
                  <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-1.5 p-0">
                    {subs.map(sub => (
                      <li key={sub.id} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft">
                        {sub.name}{sub.tierName && <span className="text-muted"> · {sub.tierName}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* 머리 셀 — 시안의 열 배지(현재/추천 BEST/정가)·체크 표식·총액. 각 줄에 같은 최소 높이를 주어 총액이 한 선에 놓인다. */
/* 표 머리는 이름과 금액만 남긴다 — 부제·절감액·저장 버튼은 위 대시보드가 이미 말한다(2026-09-21). */
function ColHead({ title, children, best }) {
  return (
    <th scope="col" className={`border-b-2 px-4.5 py-3 text-left align-bottom
      ${best ? 'border-ink bg-ink/[.04]' : 'border-line'}`}>
      <span className="block text-xs font-bold text-muted">{title}</span>
      <span className="mt-1 block text-lg font-extrabold tnum">{children}</span>
    </th>
  );
}

/** 항목마다 한 줄. 쉼표로 이어 붙이면 줄 중간에서 끊긴다. */
/** 값 한 칸. 배열이면 줄로 나눠 적는다 — 표와 폰 카드가 같은 렌더러를 쓴다. */
const Lines = ({ value }) => (Array.isArray(value) ? value : [value])
  .map((line, i) => <span key={i} className="block first:mt-0 [&+span]:mt-[3px]">{line}</span>);

function Cell({ value, best }) {
  return (
    <td className={`border-b border-line px-4.5 py-3.5 align-top ${best ? 'bg-ink/[.04]' : ''}`}>
      <Lines value={value} />
    </td>
  );
}

/* 근거는 접되 버리지 않는다(원칙 5-④): 기본은 금액만, 펼치면 계산 과정과 출처. */
function Breakdown({ best }) {
  return (
    <details className="my-6 rounded-xl border border-line bg-white px-5 py-4">
      <summary className="cursor-pointer text-sm font-semibold">계산 과정과 출처 보기</summary>
      <ul className="mt-4 grid list-none gap-2.5 p-0">
        {best.breakdown.map((line, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2.5 text-sm">
            <span>{line.label}</span>
            <strong className="tnum">{won(line.amount)}</strong>
            <em className="text-xs not-italic text-ink-soft">{provenance[line.provenance] ?? line.provenance}</em>
            {line.note && <p className="col-span-full text-xs text-ink-soft">{line.note}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}

const REPORT_FIELDS = [['PRICE', '금액이 달라요'], ['DATA', '데이터·통화가 달라요'],
  ['BENEFIT', '포함 혜택이 달라요'], ['AVAILABILITY', '지금 가입할 수 없어요'], ['OTHER', '그 밖의 오류']];

/** 정보 오류 제보(POST /api/v1/catalog/reports). 접수만 하고 회원 정보는 보내지 않는다.
    React 전환 때 통째로 빠져 있던 화면을 되살린 것이다. */
function ReportWrong({ planId, planName }) {
  const [field, setField] = useState('PRICE');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setStatus('');
    try {
      const body = { targetType: 'MOBILE_PLAN', targetId: planId, field, description: description.trim() };
      if (sourceUrl.trim()) body.sourceUrl = sourceUrl.trim();
      // 공개 엔드포인트지만 CSRF 면제 목록(/recommendations·/calculator)에 없다.
      // member:true 여야 request 가 토큰을 받아 붙인다 — 없으면 전부 403 이다.
      await request('/api/v1/catalog/reports', { method: 'POST', body, member: true });
      setDone(true);
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : '제보를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { setBusy(false); }
  }

  return (
    <details className="mt-4 rounded-card border border-line bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold">정보가 잘못되었나요?</summary>
      {done
        ? <p className="mt-3 text-sm text-ink-soft">접수했어요. 확인한 뒤 카탈로그에 반영할게요. 고맙습니다.</p>
        : (
          <form onSubmit={submit} className="mt-3 grid gap-2">
            <p className="text-[13px] text-muted">
              <strong className="text-ink-soft">{planName}</strong> 의 정보가 실제와 다르면 알려주세요.
              개인정보(이름·전화번호·계약번호)는 적지 말아 주세요.
            </p>
            <select value={field} onChange={e => setField(e.target.value)} aria-label="잘못된 항목" className="field">
              {REPORT_FIELDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={2000}
                      aria-label="무엇이 다른지" placeholder="예: 월 39,000원이 아니라 41,000원이에요." className="field" />
            <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} inputMode="url"
                   aria-label="출처 링크(선택)" placeholder="출처 링크(선택) — 통신사 공식 페이지 https://…" className="field" />
            <div className="flex items-center gap-3">
              <button type="submit" disabled={!description.trim() || busy}
                      className="btn btn-dark disabled:cursor-not-allowed disabled:opacity-45">
                {busy ? '보내는 중…' : '제보 보내기'}
              </button>
              {status && <span className="text-[13px] text-danger">{status}</span>}
            </div>
          </form>
        )}
    </details>
  );
}

/* 상황 정리 문장은 내레이터가 준다(D-38·내레이션 분리) — 펼칠 때 narrate 로 받는다.
   내레이터에 닿지 못하면 null 이고, 그때는 화면이 최소 설명을 적는다.
   화면이 금액을 문장으로 다시 쓰지 않는다 — 숫자를 만드는 곳은 계산 서버 하나다(절대 원칙 2). */
function Summary({ message }) {
  if (!message) {
    return (
      <p className="mb-6 max-w-prose leading-relaxed text-muted">
        절감액은 계산 서버가 준 <strong className="text-ink">정가 대비</strong> 값이에요. 월 기준으로 비교했어요.
      </p>
    );
  }
  return (
    <p className="mb-6 max-w-prose leading-relaxed text-muted">
      {splitLines(message).map((line, i) => (
        <span key={i} className="block [&+span]:mt-1">{line}</span>
      ))}
    </p>
  );
}

/* 추천 사유는 내레이터가 만든다(narrate 응답의 reasons). 펼치기 전·장애 시엔 빈 배열이고 그때는 숨긴다.
   표와 같은 카드 안에 붙는다. 예전엔 보라(--color-detail)였는데 강조색을 하나로 줄이며 회색면으로 바꿨다(2026-09-21). */
function Reasons({ reasons }) {
  return (
    <section className="m-5 rounded-xl border border-line bg-bg-soft p-5">
      <h2 className="mb-3 text-[15px] font-extrabold text-ink">💡 왜 나에게 이 상품이 추천됐나요?</h2>
      <ul className="m-0 grid list-none gap-2 p-0">
        {reasons.map((text, i) => (
          <li key={i} className="max-w-prose text-sm leading-relaxed text-ink-soft">
            {splitLines(text).map((line, j) => <span key={j} className="block [&+span]:mt-[3px]">{line}</span>)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 캘린더가 같은 숫자를 쓰도록 결과를 넘긴다(원칙 5-⑤: 같은 숫자는 같은 출처). */
function SaveResult({ input, best, current }) {
  useEffect(() => {
    setResult({
      planId: best.planId,
      currentTotal: current ? current.cost.monthlyTotal : currentTotal(input),
      carrier: best.carrier, planLabel: `${best.carrier} ${best.planName}`,
      monthlyTotal: best.monthlyTotal, monthlySavings: best.monthlySavings, annualSavings: best.annualSavings,
    });
  }, [input, best, current]);
  return null;
}

function Empty({ message }) {
  return (
    <>
      <Header />
      <main className="mx-auto my-20 max-w-[560px] px-6 text-center">
        <span className="inline-block rounded-full bg-bg-soft px-3 py-1.5 text-[13px] font-bold text-ink-soft">안내</span>
        <h1 className="mt-5 text-[26px] font-extrabold">비교할 입력이 없어요</h1>
        <p className="mt-3 text-muted">{message}</p>
        <a href="/modes" className="btn btn-dark mt-7 inline-flex">모드 선택으로</a>
      </main>
    </>
  );
}
