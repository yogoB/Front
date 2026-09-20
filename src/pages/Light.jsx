import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';
import { FlowHead, Question, ErrorLine, Actions, RangeCard } from '../components/Flow.jsx';
import { Choice } from '../components/Choice.jsx';
import SubscriptionPicker from '../components/SubscriptionPicker.jsx';
import Analyzing from '../components/Analyzing.jsx';
import { loadCatalog, DATA_BUCKETS, FEE_BUCKETS } from '../lib/catalog-data.js';
import { track } from '../lib/track.js';
import { won, tierKrwGuess, isForeign, clampDigits, FEE_MAX } from '../lib/model.js';
import { setInput } from '../lib/session.js';

const STEPS = ['기본', '요금제', '구독'];

export default function Light() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const [dataIdx, setDataIdx] = useState(2);          // 기본 5~15GB
  const [dataSkipped, setDataSkipped] = useState(false);
  const [fee, setFee] = useState(null);               // { label, amount } 또는 null
  const [customFee, setCustomFee] = useState(false);
  const [feeText, setFeeText] = useState('');          // 직접입력 통신비. 상한 FEE_MAX(디테일과 같다)
  const [subs, setSubs] = useState([]);               // 카탈로그를 받은 뒤 채운다 (BE 가 원본)
  const [query, setQuery] = useState('');
  const [catalogState, setCatalogState] = useState('loading');   // loading | ready | failed — 로딩과 0건은 다른 말이다

  /* 구독 카탈로그는 BE 가 원본이다. 목업 가격으로 대체하지 않는다. */
  const fetchCatalog = useCallback(() => {
    setCatalogState('loading');
    return loadCatalog()
      .then(catalog => {
        setSubs(catalog.map(s => ({ id: s.id, service: s, tierId: s.tiers[0].id, checked: false })));
        setCatalogState('ready');
      })
      .catch(e => { setCatalogState('failed'); setError(e.message || '구독 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); });
  }, []);
  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);
  // 보고서 §9.2 결과 도달률의 분모 — 입력을 시작한 사람. 하루 한 번만 쌓인다(BE 가 묶는다).
  useEffect(() => { track('INPUT_STARTED'); }, []);

  const go = next => { setError(''); setStep(next); };
  const back = () => (step > 1 ? go(step - 1) : navigate('/modes'));

  function analyze() {
    const chosen = subs.filter(s => s.checked);
    if (!chosen.length) { setError('구독 서비스를 하나 이상 골라주세요.'); return; }
    track('INPUT_COMPLETED');   // 막는 검사를 통과한 뒤에 센다 — 디테일과 같은 자리다(되돌아가는 사람을 완료로 세지 않는다)
    const bucket = DATA_BUCKETS[dataIdx];
    setInput({
      mode: 'light',
      data: dataSkipped ? null : { label: bucket.label, gb: bucket.rep },
      fee,
      subs: chosen.map(s => {
        const t = s.service.tiers.find(t => t.id === s.tierId);
        return { id: s.id, name: s.service.name, tierId: t.id, tierName: t.name,
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
      <main className="mx-auto max-w-[900px] px-6 py-8">
        <FlowHead steps={STEPS} current={step} onGo={go} onBack={back} />
        <ErrorLine>{error}</ErrorLine>

        {/* 단계가 바뀌어도 **골격은 그대로** 둔다(Mobbin 레퍼런스 Copy.ai·Babbel, 사용자 지적 2026-09-21).
            전에는 1·2단계가 회색 바탕에 글자만 떠 있고 3단계에서 갑자기 사이드바가 생겨, 같은 흐름인데
            화면 모양이 세 번 바뀌었다. 합계는 1단계부터 보여 준다 — 답할수록 채워지는 것이 보인다.
            폰에서는 질문이 먼저다(order) — 합계를 먼저 읽히게 하면 질문이 접힌 화면 아래로 밀린다. */}
        <div className="grid items-start gap-6 md:grid-cols-[260px_1fr]">
          <div className="order-2 md:order-1">
            <Summary subs={subs} fee={fee} dataLabel={dataSkipped ? '모름' : DATA_BUCKETS[dataIdx].label} />
          </div>
          <section className="order-1 min-w-0 rounded-card border border-line bg-white p-6 shadow-card sm:p-8 md:order-2">

        {step === 1 && (
          <div>
            <Question kicker="기본 정보" sub="대략적으로 선택해도 괜찮아요. 해당 용량 이상인 요금제를 찾아요."
                      tip="통신사 앱 → 사용량 조회에서 확인할 수 있어요">
              한 달에 데이터 얼마나 쓰세요?
            </Question>
            <RangeCard label="데이터 사용량 범위를 조절하세요" ariaLabel="데이터 사용량 구간"
                       value={dataSkipped ? '모름' : DATA_BUCKETS[dataIdx].label}
                       idx={dataIdx} max={DATA_BUCKETS.length - 1}
                       onChange={i => { setDataIdx(i); setDataSkipped(false); }} />
            <Actions onNext={() => go(2)} onSkip={() => { setDataSkipped(true); go(2); }} />
          </div>
        )}

        {step === 2 && (
          <div>
            <Question kicker="현재 납부액"
                      sub="지난달 실제 납부한 결합·약정 할인이 다 적용된 총 납부금액을 알려주세요."
                      tip="통신사 앱 → 청구내역에서 확인할 수 있어요">
              실제로 내는 금액이 얼마예요?
            </Question>
            <div className="flex flex-wrap gap-2.5" role="group" aria-label="현재 통신비 구간">
              {FEE_BUCKETS.map(b => (
                <Choice key={b.label} label={b.label} active={!customFee && fee?.label === b.label}
                        onClick={() => { setCustomFee(false); setFee({ label: b.label, amount: b.rep }); }} />
              ))}
              <Choice label="직접입력" active={customFee} onClick={() => setCustomFee(true)} />
            </div>
            {customFee && (
              <div className="mt-5">
                <label htmlFor="fee-input" className="mb-2 block text-sm font-semibold">직접 입력</label>
                <div className="flex min-h-13 items-center rounded-xl border border-line bg-white px-4 shadow-card focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/10">
                  <input id="fee-input" inputMode="numeric" placeholder="55000" autoFocus value={feeText}
                         onChange={e => {
                           // 상한을 넘긴 값은 화면에도 상태에도 남지 않게 여기서 자른다.
                           const v = clampDigits(e.target.value, FEE_MAX);
                           setFeeText(v);
                           setFee(v ? { label: '직접입력', amount: Number(v) } : null);
                         }}
                         className="w-full border-0 bg-transparent py-2.5 outline-none" />
                  <span className="text-muted">원</span>
                </div>
              </div>
            )}
            <Actions onNext={() => go(3)} onSkip={() => { setFee(null); setCustomFee(false); go(3); }} />
          </div>
        )}

        {step === 3 && (
          <div>
            <Question kicker="구독 정보" sub="이용 중인 서비스를 고르고 등급을 선택해 주세요.">
              구독 서비스 정보를 알려주세요
            </Question>
            <SubscriptionPicker
              subs={subs} query={query} onQuery={setQuery} status={catalogState} onRetry={fetchCatalog}
              onToggle={id => setSubs(list => list.map(s => s.id === id ? { ...s, checked: !s.checked } : s))}
              onTier={(id, tierId) => setSubs(list => list.map(s => s.id === id ? { ...s, tierId } : s))} />
            <Actions onNext={analyze} nextLabel="분석 시작하기" />
          </div>
        )}
          </section>
        </div>
      </main>
    </div>
  );
}

/** 입력값과 카탈로그 가격의 단순 합계다. 추천 금액이 아니다 — 화면에도 그렇게 적는다. */
function Summary({ subs, fee, dataLabel }) {
  const chosen = subs.filter(s => s.checked);
  const picked = chosen.map(s => s.service.tiers.find(t => t.id === s.tierId));
  const subTotal = picked.reduce((sum, t) => sum + (tierKrwGuess(t) ?? 0), 0);
  const estimated = picked.some(isForeign);
  const has = fee || chosen.length;
  return (
    <aside aria-label="현재 예상 지출" className="rounded-card border border-line bg-white p-6">
      <h2 className="border-b-2 border-black/10 pb-3 text-base font-bold">현재 예상 지출</h2>
      <p className="mb-5 mt-4 text-2xl font-extrabold tnum">{has ? won((fee?.amount ?? 0) + subTotal) : '—'}</p>
      <dl className="m-0 grid gap-2.5 text-sm">
        <Row label="통신비" value={fee ? won(fee.amount) : '—'} />
        <Row label="데이터" value={dataLabel} />
        {/* 추정치가 섞였으면 숨기지 않고 그 자리에 적는다(절대 원칙 4 — 금액에는 출처가 붙는다). */}
        <Row label="구독" value={chosen.length ? won(subTotal) + (estimated ? ' (해외 결제 추정 포함)' : '') : '—'} />
      </dl>
      <p className="mt-4 text-[13px] leading-relaxed text-muted">입력값과 카탈로그 가격의 합계예요. 추천 금액은 결과에서 계산해요.</p>
    </aside>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-3"><dt className="text-ink-soft">{label}</dt><dd className="m-0 text-right font-semibold">{value}</dd></div>
);
