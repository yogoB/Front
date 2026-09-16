import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';
import { FlowHead, Question, ErrorLine, Actions } from '../components/Flow.jsx';
import SubscriptionPicker from '../components/SubscriptionPicker.jsx';
import Analyzing from '../components/Analyzing.jsx';
import { loadCatalog, DATA_BUCKETS, FEE_BUCKETS } from '../lib/catalog-data.js';
import { won, tierKrwGuess, isForeign } from '../lib/model.js';
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
  const [subs, setSubs] = useState([]);               // 카탈로그를 받은 뒤 채운다 (BE 가 원본)
  const [query, setQuery] = useState('');

  /* 구독 카탈로그는 BE 가 원본이다. 목업 가격으로 대체하지 않는다. */
  useEffect(() => {
    loadCatalog()
      .then(catalog => setSubs(catalog.map(s => ({ id: s.id, service: s, tierId: s.tiers[0].id, checked: false }))))
      .catch(e => setError(e.message || '구독 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }, []);

  const go = next => { setError(''); setStep(next); };
  const back = () => (step > 1 ? go(step - 1) : navigate('/modes'));

  function analyze() {
    const chosen = subs.filter(s => s.checked);
    if (!chosen.length) { setError('구독 서비스를 하나 이상 골라주세요.'); return; }
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
    return (<><Header /><main className="mx-auto max-w-[860px] px-6">
      <Analyzing onDone={() => navigate('/results')} />
    </main></>);
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[860px] px-6 py-6">
        <FlowHead steps={STEPS} current={step} onGo={go} onBack={back} />
        <ErrorLine>{error}</ErrorLine>

        {step === 1 && (
          <section className="mx-auto max-w-[560px]">
            <Question kicker="기본 정보" sub="대략적으로 선택해도 괜찮아요. 해당 용량 이상인 요금제를 찾아요.">
              한 달에 데이터 얼마나 쓰세요?
            </Question>
            <div className="rounded-card border border-line px-6 py-7">
              <p className="text-sm text-muted">데이터 사용량 범위를 조절하세요</p>
              <output className="mb-4 block text-[28px] font-extrabold">
                {dataSkipped ? '모름' : DATA_BUCKETS[dataIdx].label}
              </output>
              <input type="range" min={0} max={DATA_BUCKETS.length - 1} step={1} value={dataIdx}
                     aria-label="데이터 사용량 구간"
                     onChange={e => { setDataIdx(Number(e.target.value)); setDataSkipped(false); }}
                     className="h-1.5 w-full accent-brand" />
            </div>
            <Actions onNext={() => go(2)} onSkip={() => { setDataSkipped(true); go(2); }} />
          </section>
        )}

        {step === 2 && (
          <section className="mx-auto max-w-[560px]">
            <Question kicker="현재 납부액"
                      sub="지난달 실제 납부한 결합·약정 할인이 다 적용된 총 납부금액을 알려주세요.">
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
              <div className="mt-4.5">
                <label htmlFor="fee-input" className="mb-2 block text-sm font-semibold">직접 입력</label>
                <div className="flex max-w-[220px] items-center rounded-[10px] border border-line px-3.5">
                  <input id="fee-input" inputMode="numeric" placeholder="55000" autoFocus
                         onChange={e => {
                           const v = e.target.value.trim();
                           setFee(/^\d+$/.test(v) ? { label: '직접입력', amount: Number(v) } : null);
                         }}
                         className="w-full border-0 bg-transparent py-3 outline-none" />
                  <span className="text-muted">원</span>
                </div>
              </div>
            )}
            <Actions onNext={() => go(3)} onSkip={() => { setFee(null); setCustomFee(false); go(3); }} />
          </section>
        )}

        {step === 3 && (
          <section className="grid items-start gap-7 md:grid-cols-[260px_1fr]">
            <Summary subs={subs} fee={fee} dataLabel={dataSkipped ? '모름' : DATA_BUCKETS[dataIdx].label} />
            <div className="min-w-0">
              <Question kicker="구독 정보" sub="이용 중인 서비스를 고르고 등급을 선택해 주세요.">
                현재 결제 중인 구독 서비스가 있나요?
              </Question>
              <SubscriptionPicker
                subs={subs} query={query} onQuery={setQuery}
                onToggle={id => setSubs(list => list.map(s => s.id === id ? { ...s, checked: !s.checked } : s))}
                onTier={(id, tierId) => setSubs(list => list.map(s => s.id === id ? { ...s, tierId } : s))} />
              <Actions onNext={analyze} nextLabel="분석 시작하기" />
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function Choice({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
            className={`cursor-pointer rounded-full border px-4.5 py-2.5 text-sm font-semibold
              ${active ? 'border-brand bg-brand-tint text-brand-ink' : 'border-line bg-white text-ink-soft hover:border-[#d9d9e2]'}`}>
      {label}
    </button>
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
    <aside aria-label="현재 예상 지출" className="rounded-card border border-line bg-bg-soft p-[22px]">
      <h2 className="border-b-2 border-black/10 pb-3 text-[15px] font-bold">현재 예상 지출</h2>
      <p className="my-3 mb-4 text-[26px] font-extrabold tnum">{has ? won((fee?.amount ?? 0) + subTotal) : '—'}</p>
      <dl className="m-0 grid gap-2 text-sm">
        <Row label="통신비" value={fee ? won(fee.amount) : '—'} />
        <Row label="데이터" value={dataLabel} />
        {/* 추정치가 섞였으면 숨기지 않고 그 자리에 적는다(절대 원칙 4 — 금액에는 출처가 붙는다). */}
        <Row label="구독" value={chosen.length ? won(subTotal) + (estimated ? ' (해외 결제 추정 포함)' : '') : '—'} />
      </dl>
      <p className="mt-3.5 text-[13px] text-muted">입력값과 카탈로그 가격의 합계예요. 추천 금액은 결과에서 계산해요.</p>
    </aside>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between"><dt className="text-ink-soft">{label}</dt><dd className="m-0 font-semibold">{value}</dd></div>
);
