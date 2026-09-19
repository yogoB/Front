import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';
import { FlowHead, Question, ErrorLine, Actions, RangeCard, SearchState } from '../components/Flow.jsx';
import { Choice, ChoiceGroup } from '../components/Choice.jsx';
import Analyzing from '../components/Analyzing.jsx';
import { loadCatalog, loadPlans, carriersOf, DATA_BUCKETS, FEE_BUCKETS } from '../lib/catalog-data.js';
import { won, tierPrice, foreignNote, tierKrwGuess, isForeign, matches, matchesAll, searchKey, clampDigits, FEE_MAX } from '../lib/model.js';
import { PriceNote } from '../components/SubscriptionPicker.jsx';
import { setInput } from '../lib/session.js';
import { request } from '../lib/api.js';

const STEPS = ['기본', '요금제', '구독'];
const DEFAULT_WISH = [1, 2, 6];
const LINES_MIN = 2, LINES_MAX = 10;   // 결합 회선 수. 1회선 결합은 없다

export default function Detail() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [plans, setPlans] = useState([]);                 // 요금제 전량 — 통신사 목록과 같은 응답
  // 로딩과 0건은 다른 말이다(사용자 피드백 2026-09-18). loading | ready | failed 셋을 구분해 화면이 골라 적는다.
  const [catalogState, setCatalogState] = useState('loading');
  const [plansState, setPlansState] = useState('loading');
  const [currentPlan, setCurrentPlan] = useState(null);    // 지금 쓰는 요금제(선택). 고르면 BE 가 '현재' 열을 계산한다(G-30)

  const [carrier, setCarrier] = useState(null);       // { name, mvno }
  const [carrierQuery, setCarrierQuery] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [contractHas, setContractHas] = useState(null);
  const [contractEnd, setContractEnd] = useState('');
  const [dataIdx, setDataIdx] = useState(2);
  const [fee, setFee] = useState(null);
  const [customFee, setCustomFee] = useState(false);
  const [networkType, setNetworkType] = useState(null);
  const [contractType, setContractType] = useState(null);
  const [hasFamilyBundle, setHasFamilyBundle] = useState(null);
  const [familyLineCount, setFamilyLineCount] = useState('');          // 근거 문구용. 금액 계산에 쓰지 않는다
  const [familyDiscount, setFamilyDiscount] = useState('');            // 월 결합 할인액(원). BE 가 그대로 뺀다(G-28)
  const [feeText, setFeeText] = useState('');                          // 직접입력 통신비. 상한 FEE_MAX
  const [wish, setWish] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchCatalog = useCallback(() => {
    setCatalogState('loading');
    return loadCatalog()
      .then(list => {
        setCatalog(list);
        setCatalogState('ready');
        // 기본 선택을 채운다. 카탈로그에 없는 서비스는 조용히 건너뛴다.
        setWish(DEFAULT_WISH.map(id => list.find(s => s.id === id)).filter(Boolean)
          .map(service => ({ id: service.id, service, tierId: service.tiers[0].id })));
      })
      .catch(e => { setCatalogState('failed'); setError(e.message || '구독 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); });
  }, []);
  // 통신사 목록은 따로 받는다. 실패해도 구독 단계까지는 진행할 수 있어야 하므로 화면을 막지 않는다.
  const fetchPlans = useCallback(() => {
    setPlansState('loading');
    return loadPlans()
      .then(list => { setPlans(list); setCarriers(carriersOf(list)); setPlansState('ready'); })
      .catch(() => setPlansState('failed'));
  }, []);
  useEffect(() => { fetchCatalog(); fetchPlans(); }, [fetchCatalog, fetchPlans]);

  const go = next => { setError(''); setStep(next); };
  const back = () => (step > 1 ? go(step - 1) : navigate('/modes'));

  function nextFromStep1() {
    if (!carrier) { setError('통신사를 선택해 주세요.'); return; }
    go(2);
  }

  function analyze() {
    if (!carrier) { setError('통신사를 먼저 선택해 주세요.'); go(1); return; }
    if (!wish.length) { setError('지금 쓰는 구독 서비스를 하나 이상 넣어주세요.'); return; }
    const b = DATA_BUCKETS[dataIdx];
    setInput({
      mode: 'detail',
      carrier: carrier.name, mvno: carrier.mvno,
      // 지금 쓰는 요금제 id 만 보낸다. 없으면 '현재' 열은 입력값 합계로 돌아간다.
      currentPlanId: currentPlan?.id ?? null, currentPlanLabel: currentPlan ? `${currentPlan.carrier} ${currentPlan.name}` : null,
      contract: { has: contractHas === true, endDate: contractEnd || null },
      data: { label: b.label, gb: b.rep },
      fee,
      // BE optional 로 그대로 넘어간다. null 은 보내지 않아 missingInputs 안내가 유지된다.
      networkType, contractType, hasFamilyBundle,
      // 결합 중일 때만 의미가 있다. 빈 값은 Results.buildRequest 가 뺀다.
      familyLineCount: hasFamilyBundle && Number(familyLineCount) >= LINES_MIN ? familyLineCount : '',   // 2 미만은 안 보낸다
      familyBundleDiscountKrw: hasFamilyBundle ? familyDiscount : '',
      subs: wish.map(w => {
        const t = w.service.tiers.find(t => t.id === w.tierId);
        return { id: w.id, name: w.service.name, tierId: t.id, tierName: t.name,
                 price: tierKrwGuess(t) ?? 0, estimated: isForeign(t) };
      }),
    });
    setAnalyzing(true);
  }

  if (analyzing) {
    return (<div className="min-h-screen bg-bg-page"><Header /><main className="mx-auto max-w-[860px] px-6">
      <Analyzing onDone={() => navigate('/results')} />
    </main></div>);
  }

  return (
    <div className="min-h-screen bg-bg-page">
      <Header />
      <main className="mx-auto max-w-[860px] px-6 py-8">
        <FlowHead steps={STEPS} current={step} onGo={go} onBack={back} />
        <ErrorLine>{error}</ErrorLine>

        <div className="grid items-start gap-8 md:grid-cols-[260px_1fr]">
          <Statement carrier={carrier} plan={currentPlan} contractHas={contractHas} fee={fee} />

          <div className="min-w-0">
            {step === 1 && (
              <>
                <Question kicker="현재 통신사">어떤 통신사를 쓰고 계세요?</Question>
                <CarrierSearch
                  carriers={carriers} status={plansState} onRetry={fetchPlans}
                  query={carrierQuery} onQuery={q => { setCarrierQuery(q); setShowSuggest(true); }}
                  open={showSuggest} selected={carrier}
                  onPick={c => { setCarrier({ name: c.name, mvno: c.mvno }); setCarrierQuery(c.name); setShowSuggest(false); }}
                  onClear={() => { setCarrier(null); setCarrierQuery(''); setContractHas(null); setContractEnd(''); setCurrentPlan(null); }} />
                {carrier && (
                  <PlanSearch plans={plans} status={plansState} onRetry={fetchPlans} carrier={carrier.name}
                              selected={currentPlan} onPick={setCurrentPlan} onClear={() => setCurrentPlan(null)} />
                )}
                {carrier && (
                  <div>
                    <ChoiceGroup label="약정이 걸려 있나요?" stack
                      options={[[true, '네, 약정 중이에요'], [false, '아니요, 무약정이에요']]}
                      value={contractHas} onChange={setContractHas} />
                    {contractHas && (
                      <div className="mt-5">
                        <label htmlFor="contract-end" className="mb-2 block text-sm font-semibold">약정 종료일</label>
                        <input id="contract-end" type="date" value={contractEnd}
                               onChange={e => setContractEnd(e.target.value)}
                               className="field max-w-[220px]" />
                      </div>
                    )}
                  </div>
                )}
                <Actions onNext={nextFromStep1} />
              </>
            )}

            {step === 2 && (
              <>
                <Question kicker="희망 조건" tip="통신사 앱 → 사용량 조회에서 확인할 수 있어요"
                          sub="원하는 데이터 사용량과 지금 내는 통신비를 알려주시면 절감액까지 계산해요.">
                  지금 얼마나 쓰고 계세요?
                </Question>
                <RangeCard label="데이터 사용량 범위를 조절하세요" ariaLabel="희망 데이터 사용량 구간"
                           value={DATA_BUCKETS[dataIdx].label} idx={dataIdx} max={DATA_BUCKETS.length - 1} onChange={setDataIdx} />

                <h2 className="mt-10 text-xl font-extrabold">지금 내는 월 통신비는요?</h2>
                {currentPlan ? (
                  // 요금제를 골랐으면 통신비는 그 요금제에서 온다 — 여기서 또 묻지 않는다. 못 찾은 사람은 아래 직접 입력이 그대로다.
                  <p className="mt-3 rounded-xl bg-brand-tint px-4 py-3 text-sm leading-relaxed text-brand-ink">
                    <strong>{currentPlan.carrier} {currentPlan.name}</strong>에서 가져왔어요 — 월 {won(currentPlan.basePrice)}.
                    '현재' 금액은 이 요금제 기준으로 계산해요.
                  </p>
                ) : (
                <div className="mt-3 flex flex-wrap gap-2.5" role="group" aria-label="현재 월 통신비">
                  {FEE_BUCKETS.map(b => (
                    <Choice key={b.label} label={b.label} active={!customFee && fee?.label === b.label}
                            onClick={() => { setCustomFee(false); setFee({ label: b.label, amount: b.rep }); }} />
                  ))}
                  <Choice label="직접입력" active={customFee} onClick={() => setCustomFee(true)} />
                </div>
                )}
                {!currentPlan && customFee && (
                  <input type="number" inputMode="numeric" min={0} max={FEE_MAX} step={100} placeholder="예: 55000" autoFocus
                         aria-label="통신비 직접 입력(원)" value={feeText}
                         onChange={e => {
                           // max 속성은 타이핑을 막지 못한다 — 여기서 잘라 상한을 넘긴 값이 화면에도 상태에도 남지 않게 한다.
                           const text = clampDigits(e.target.value, FEE_MAX);
                           setFeeText(text);
                           const value = Number(text);
                           setFee(text && value > 0 ? { label: `${value.toLocaleString('ko-KR')}원`, amount: value } : null);
                         }}
                         className="field mt-3 max-w-[220px]" />
                )}

                <h2 className="mt-12 text-xl font-extrabold">아래를 알려주시면 더 정확해져요</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">모르면 건너뛰어도 결과는 나와요. 아는 만큼만 골라주세요.</p>
                {/* "잘 모르겠어요" 칩은 뺐다. 안 고르면 null 그대로라 missingInputs 안내가 나간다(원칙 5-①). */}
                <ChoiceGroup label="선택약정 25% 할인" stack value={contractType} onChange={setContractType}
                  options={[['SELECTIVE_25', '받고 있어요'], ['NONE', '받고 있지 않아요']]} />
                {/* "기타"는 null — BE 가 망 필터를 걸지 않는다. 3G 를 보내는 경로는 화면에서만 사라졌고 BE enum 은 그대로다. */}
                <ChoiceGroup label="사용 중인 통신망" value={networkType} onChange={setNetworkType}
                  options={[['5G', '5G'], ['LTE', 'LTE'], [null, '기타']]} />
                <ChoiceGroup label="가족 결합" stack value={hasFamilyBundle} onChange={setHasFamilyBundle}
                  options={[[true, '하고 있어요'], [false, '하고 있지 않아요']]} />
                {hasFamilyBundle === true && (
                  <div className="mt-4 grid gap-4 rounded-card border border-line bg-white p-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="family-lines" className="mb-2 block text-sm font-semibold">결합 회선 수</label>
                      <input id="family-lines" type="number" inputMode="numeric" min={LINES_MIN} max={LINES_MAX} placeholder="예: 3"
                             value={familyLineCount} onChange={e => setFamilyLineCount(clampDigits(e.target.value, LINES_MAX))}
                             className="field" />
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">{LINES_MIN}~{LINES_MAX}회선. 근거 문구에만 써요 — 회선 수로 할인액을 추정하지 않아요.</p>
                    </div>
                    <div>
                      <label htmlFor="family-discount" className="mb-2 block text-sm font-semibold">월 결합 할인액(원)</label>
                      <input id="family-discount" type="number" inputMode="numeric" min={0} max={FEE_MAX} step={100} placeholder="예: 11000"
                             value={familyDiscount} onChange={e => setFamilyDiscount(clampDigits(e.target.value, FEE_MAX))}
                             className="field" />
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">적어 주신 금액을 그대로 빼서 계산해요. 모르면 비워 두세요.</p>
                    </div>
                  </div>
                )}
                <Actions onNext={() => go(3)} />
              </>
            )}

            {step === 3 && (
              <>
                <Question kicker="구독 정보">
                  구독서비스 정보를 입력해주세요!
                </Question>
                <div className="mb-4 flex flex-col gap-2.5">
                  {wish.map(w => (
                    <div key={w.id} className="rounded-xl border border-line bg-white py-2 pl-4 pr-1">
                      {/* 지금 쓰는 것만 받는다 — 유지/해지를 여기서 묻지 않는다(사용자 결정 2026-09-20).
                          무엇을 정리할지는 결과가 말한다. 이 화면은 입력만 한다. */}
                      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                        <span className="font-semibold">{w.service.icon}  {w.service.name}</span>
                        <button type="button" aria-label={`${w.service.name} 제거`}
                                onClick={() => setWish(list => list.filter(x => x.id !== w.id))}
                                className="grid size-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[15px] text-muted hover:bg-bg-soft hover:text-ink-soft">✕</button>
                      </div>
                      {/* 등급을 여기서 고른다. 고르기 전에는 화면은 첫 등급 금액을 보여주면서 서버는 대표 등급(스탠다드)으로
                          계산해, 프리미엄 가입자가 스탠다드 금액을 추천받고 있었다. 이제 고른 값이 그대로 전송된다. */}
                      <div className="mt-1.5 flex items-center gap-2 pr-2.5">
                        <select value={w.tierId} aria-label={`${w.service.name} 등급`}
                                onChange={e => setWish(list => list.map(x => x.id === w.id ? { ...x, tierId: Number(e.target.value) } : x))}
                                className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm">
                          {w.service.tiers.map(t => (
                            <option key={t.id} value={t.id}>{t.name} · {tierPrice(t)}</option>
                          ))}
                        </select>
                        {/* 고른 등급이 해외 결제면 근거를 ⓘ 로 붙인다 — 목록의 금액은 원화 기준이다. */}
                        <PriceNote note={foreignNote(w.service.tiers.find(t => t.id === w.tierId))} />
                      </div>
                    </div>
                  ))}
                  {!wish.length && <p className="text-sm leading-relaxed text-muted">아직 고른 서비스가 없어요. 아래에서 추가해 주세요.</p>}
                </div>
                <button type="button" onClick={() => setModalOpen(true)}
                        className="btn border-brand bg-white text-brand-ink hover:bg-brand-tint">+ 추가하기</button>
                <Actions onNext={analyze} nextLabel="분석 시작하기" />
              </>
            )}
          </div>
        </div>

        {modalOpen && (
          <AddModal catalog={catalog} status={catalogState} onRetry={fetchCatalog} chosen={wish.map(w => w.id)}
                    onClose={() => setModalOpen(false)}
                    onAdd={ids => {
                      setWish(list => [...list, ...ids.map(id => {
                        const s = catalog.find(x => x.id === id);
                        return { id: s.id, service: s, tierId: s.tiers[0].id };
                      })]);
                      setModalOpen(false);
                    }} />
        )}
      </main>
    </div>
  );
}

/* 통신사 — 검색 자동완성. 전체 목록을 나열하지 않고 입력하면 일치하는 것만 제안한다.
   목록에 없으면 입력한 이름을 그대로 고를 수 있다(QA 2026-09-17) — BE 가 모르는 이름을 결손으로 기록해 수집 대상이 된다.
   직접 입력한 통신사는 3사가 아니므로 mvno 로 둔다. 고른 뒤에는 ✕ 로 되돌린다. */
function CarrierSearch({ query, onQuery, open, selected, onPick, onClear, carriers, status = 'ready', onRetry }) {
  const found = useMemo(
    () => (query.trim() ? carriers.filter(c => matches(c.name, query) || (c.mvno && matches('알뜰폰', query))) : []),
    [query, carriers]);
  const typed = query.trim();
  const exact = found.some(c => matches(c.name, typed) && matches(typed, c.name));
  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-field border border-brand bg-brand-tint px-4 py-2.5 font-semibold text-brand-ink">
        <span>{selected.name}{selected.mvno && <small className="ml-2 text-xs font-medium text-muted">알뜰폰</small>}</span>
        <button type="button" onClick={onClear} aria-label="통신사 선택 해제"
                className="grid size-9 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-base text-brand-ink hover:bg-white/60">✕</button>
      </div>
    );
  }
  return (
    <div>
      <input value={query} onChange={e => onQuery(e.target.value)} onFocus={() => onQuery(query)}
             placeholder={status === 'loading' ? '통신사 목록을 불러오는 중이에요…' : '통신사 이름을 입력하세요'}
             aria-label="통신사 검색" aria-busy={status === 'loading'} className="field" />
      {open && typed && status !== 'ready' && (
        <div className="mt-2 overflow-hidden rounded-card border border-line bg-white">
          {/* 목록이 아직 없을 때 "일치하는 통신사가 없어요"를 띄우면 로딩을 0건으로 읽는다(사용자 피드백). */}
          <SearchState status={status} onRetry={onRetry} empty="" />
        </div>
      )}
      {open && typed && status === 'ready' && (
        <div className="mt-2 overflow-hidden rounded-card border border-line bg-white">
          {found.map(c => (
            <button key={c.name} type="button" onClick={() => onPick(c)}
                    className="flex w-full cursor-pointer items-center gap-2.5 border-b border-line bg-white px-4 py-3.5 text-left font-semibold last:border-b-0 hover:bg-bg-soft">
              <Highlight name={c.name} query={query} />
              {c.mvno && <small className="text-xs font-medium text-muted">알뜰폰</small>}
            </button>
          ))}
          {!exact && (
            <button type="button" onClick={() => onPick({ name: typed, mvno: true })}
                    className="flex w-full cursor-pointer items-center gap-2.5 border-b border-line bg-white px-4 py-3.5 text-left font-semibold last:border-b-0 hover:bg-bg-soft">
              <span>"{typed}" 직접 입력</span>
              <small className="text-xs font-medium text-muted">{found.length ? '목록에 없어요' : '일치하는 통신사가 없어요'}</small>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* 지금 쓰는 요금제(선택, G-30). 고른 통신사의 요금제만 후보이고, 검색 규칙은 통신사와 같다(소문자+공백 제거).
   1,700여 건이라 상위 8건만 보여준다. 고르면 id 만 BE 로 가고, '현재' 열을 BE 가 같은 계산기로 낸다. */
function PlanSearch({ plans, carrier, selected, onPick, onClear, status = 'ready', onRetry }) {
  const [query, setQuery] = useState('');
  const [reported, setReported] = useState('');
  const mine = useMemo(() => plans.filter(p => searchKey(p.carrier) === searchKey(carrier)), [plans, carrier]);
  // 낱말을 모두 포함하면 걸린다 — "SKT 청년"으로도 "0 청년 다이렉트 62"를 찾는다(통짜 비교로는 안 걸렸다).
  const found = query.trim() ? mine.filter(p => matchesAll(p.name, query, carrier)).slice(0, 8) : [];

  /* 카탈로그에 없는 요금제는 사용자가 알려 줄 수 있다 — 그래야 수집 대상이 된다(결손 보드, D-56).
     공개·CSRF 면제 경로라 토큰 왕복이 없다. 응답은 있든 없든 늘 같으므로(카탈로그를 훑는 통로가 되면 안 된다)
     화면도 "접수했다"까지만 적고 존재 여부를 추측하지 않는다. 통신사 이름은 추천 경로가 이미 자동 기록한다. */
  async function reportMissing() {
    // 통신사 이름을 이미 쳤으면 덧붙이지 않는다 — "SKT SKT 청년 59" 로 쌓이면 같은 결손이 두 줄로 갈린다.
    const typed = query.trim();
    const text = (matchesAll(typed, carrier) ? typed : `${carrier} ${typed}`).slice(0, 200);
    setReported('보내는 중…');
    try {
      await request('/api/v1/catalog/gaps', { method: 'POST', body: { kind: 'MOBILE_PLAN', queryText: text } });
      setReported('알려주셔서 고마워요. 수집 목록에 올릴게요.');
    } catch (e) {
      setReported(e.status === 429 ? '요청이 많아요. 잠시 후 다시 시도해 주세요.'
        : e.message || '알리지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }
  return (
    <div className="mt-5">
      <label htmlFor="current-plan" className="mb-2 block text-sm font-semibold">
        지금 쓰는 요금제 <span className="font-medium text-muted">(선택)</span>
      </label>
      {selected ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-field border border-brand bg-brand-tint px-4 py-2.5 font-semibold text-brand-ink">
            <span>{selected.name} <small className="ml-1 text-xs font-medium text-muted tnum">월 {won(selected.basePrice)}</small></span>
            <button type="button" onClick={onClear} aria-label="요금제 선택 해제"
                    className="grid size-9 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-base text-brand-ink hover:bg-white/60">✕</button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">이 요금제로 '현재' 금액을 계산해요.</p>
        </>
      ) : (
        <>
          <input id="current-plan" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off"
                 placeholder={status === 'loading' ? '요금제를 불러오는 중이에요…'
                   : status === 'failed' ? '요금제 목록을 불러오지 못했어요'
                   : mine.length ? '요금제 이름 검색' : '이 통신사의 요금제가 카탈로그에 없어요'}
                 disabled={status === 'ready' && !mine.length} aria-busy={status === 'loading'}
                 className="field disabled:bg-bg-soft disabled:text-muted" />
          {status !== 'ready' && (
            <div className="mt-2 overflow-hidden rounded-card border border-line bg-white">
              <SearchState status={status} onRetry={onRetry} empty="" />
            </div>
          )}
          {status === 'ready' && query.trim() && (
            <div className="mt-2 overflow-hidden rounded-card border border-line bg-white">
              {found.length ? found.map(p => (
                <button key={p.id} type="button" onClick={() => { onPick(p); setQuery(''); }}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 text-left font-semibold last:border-b-0 hover:bg-bg-soft">
                  <span>{p.name}</span>
                  <small className="text-xs font-medium text-muted tnum">월 {won(p.basePrice)}</small>
                </button>
              )) : (
                <div className="px-4 py-3 text-sm text-muted">
                  <p><strong className="text-ink-soft">"{query.trim()}"</strong> 는 목록에 없어요. 비워 두고 아래에서 통신비를 직접 넣어도 괜찮아요.</p>
                  {reported
                    ? <p className="mt-1.5 font-semibold text-brand-ink">{reported}</p>
                    : <button type="button" onClick={reportMissing} className="btn-text mt-1 font-semibold text-brand-ink">이 요금제가 없다고 알려주기</button>}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Highlight({ name, query }) {
  const i = name.toLowerCase().indexOf(query.trim().toLowerCase());
  if (i < 0) return name;
  const len = query.trim().length;
  return <>{name.slice(0, i)}<strong>{name.slice(i, i + len)}</strong>{name.slice(i + len)}</>;
}

/** 지금까지 고른 것을 옆에 계속 보여준다 — 뒤로 가지 않아도 무엇을 답했는지 알 수 있다. */
function Statement({ carrier, plan, contractHas, fee }) {
  return (
    <aside className="rounded-card border border-line bg-white p-6" aria-label="입력 요약">
      <h2 className="border-b-2 border-black/10 pb-3 text-base font-bold">지금까지 고른 것</h2>
      <dl className="m-0 mt-4 grid gap-2.5 text-sm">
        <Row label="통신사" value={carrier?.name || '—'} />
        <Row label="요금제" value={plan ? plan.name : '—'} />
        <Row label="약정" value={contractHas === null ? '—' : contractHas ? '약정 중' : '무약정'} />
        <Row label="통신비" value={fee ? won(fee.amount) : plan ? `${won(plan.basePrice)} (요금제)` : '—'} />
      </dl>
    </aside>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between"><dt className="text-ink-soft">{label}</dt><dd className="m-0 font-semibold">{value}</dd></div>
);

/** 추가 모달. <dialog> 는 포커스 가둠·백드롭을 브라우저가 해준다 — 직접 만들지 않는다. */
function AddModal({ catalog, chosen, onClose, onAdd, status = 'ready', onRetry }) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState([]);
  useEffect(() => { ref.current?.showModal(); }, []);

  const shown = catalog.filter(s => !chosen.includes(s.id) && matches(s.name, query));
  return (
    <dialog ref={ref} onClose={onClose}
            className="m-auto w-[min(460px,92vw)] rounded-[18px] p-6 shadow-card backdrop:bg-ink/40">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">구독 서비스 추가</h2>
        <button type="button" onClick={onClose} aria-label="닫기"
                className="-mr-2 grid size-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-base text-muted hover:bg-bg-soft">✕</button>
      </div>
      <input value={query} onChange={e => setQuery(e.target.value)} autoFocus
             placeholder={status === 'loading' ? '구독 목록을 불러오는 중이에요…' : '서비스 검색'}
             aria-label="서비스 검색" aria-busy={status === 'loading'} className="field mb-4" />
      <div className="mb-4 flex max-h-[320px] flex-col overflow-y-auto rounded-card border border-line">
        {shown.map(s => (
          <label key={s.id} className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <input type="checkbox" className="size-[18px] accent-brand"
                   checked={picked.includes(s.id)}
                   onChange={() => setPicked(p => p.includes(s.id) ? p.filter(x => x !== s.id) : [...p, s.id])} />
            <span className="font-semibold">{s.icon}  {s.name}</span>
            <span className="whitespace-nowrap text-sm text-ink-soft">
              {tierPrice(s.tiers[0])}
              <PriceNote note={foreignNote(s.tiers[0])} />
            </span>
          </label>
        ))}
        {!shown.length && <SearchState status={status} onRetry={onRetry} empty="추가할 서비스가 없어요." className="p-4 text-sm" />}
      </div>
      <button type="button" onClick={() => onAdd(picked)} className="btn btn-brand btn-block">추가</button>
    </dialog>
  );
}
