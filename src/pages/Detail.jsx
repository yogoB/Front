import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';
import { FlowHead, Question, ErrorLine, Actions } from '../components/Flow.jsx';
import { Choice, ChoiceGroup } from '../components/Choice.jsx';
import Analyzing from '../components/Analyzing.jsx';
import { loadCatalog, CARRIERS, DATA_BUCKETS, FEE_BUCKETS } from '../lib/catalog-data.js';
import { won, tierPrice, tierKrwGuess, isForeign, matches } from '../lib/model.js';
import { setInput } from '../lib/session.js';

const STEPS = ['기본', '요금제', '구독'];
const DEFAULT_WISH = [1, 2, 6];

export default function Detail() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [catalog, setCatalog] = useState([]);

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
  const [wish, setWish] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadCatalog()
      .then(list => {
        setCatalog(list);
        // 기본 선택을 채운다. 카탈로그에 없는 서비스는 조용히 건너뛴다.
        setWish(DEFAULT_WISH.map(id => list.find(s => s.id === id)).filter(Boolean)
          .map(service => ({ id: service.id, service, tierId: service.tiers[0].id, disposition: '유지' })));
      })
      .catch(e => setError(e.message || '구독 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }, []);

  const go = next => { setError(''); setStep(next); };
  const back = () => (step > 1 ? go(step - 1) : navigate('/modes'));

  function nextFromStep1() {
    if (!carrier) { setError('통신사를 선택해 주세요.'); return; }
    go(2);
  }

  function analyze() {
    if (!carrier) { setError('통신사를 먼저 선택해 주세요.'); go(1); return; }
    if (!wish.some(w => w.disposition === '유지')) { setError('유지할 구독 서비스를 하나 이상 골라주세요.'); return; }
    const b = DATA_BUCKETS[dataIdx];
    setInput({
      mode: 'detail',
      carrier: carrier.name, mvno: carrier.mvno,
      contract: { has: contractHas === true, endDate: contractEnd || null },
      data: { label: b.label, gb: b.rep },
      fee,
      // BE optional 로 그대로 넘어간다. null 은 보내지 않아 missingInputs 안내가 유지된다.
      networkType, contractType, hasFamilyBundle,
      subs: wish.map(w => {
        const t = w.service.tiers.find(t => t.id === w.tierId);
        return { id: w.id, name: w.service.name, tierId: t.id, tierName: t.name,
                 price: tierKrwGuess(t) ?? 0, estimated: isForeign(t), disposition: w.disposition };
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

        <div className="grid items-start gap-7 md:grid-cols-[260px_1fr]">
          <Statement carrier={carrier} contractHas={contractHas} fee={fee} />

          <div className="min-w-0">
            {step === 1 && (
              <>
                <Question kicker="디테일 모드 · 현재 납부액">어떤 통신사를 쓰고 계세요?</Question>
                <CarrierSearch
                  query={carrierQuery} onQuery={q => { setCarrierQuery(q); setShowSuggest(true); }}
                  open={showSuggest} selected={carrier}
                  onPick={c => { setCarrier({ name: c.name, mvno: c.mvno }); setCarrierQuery(c.name); setShowSuggest(false); }} />
                {carrier && (
                  <div className="mt-5">
                    <ChoiceGroup label="약정이 걸려 있나요?" stack
                      options={[[true, '네, 약정 중이에요'], [false, '아니요, 무약정이에요']]}
                      value={contractHas} onChange={setContractHas} />
                    {contractHas && (
                      <div className="mt-4">
                        <label htmlFor="contract-end" className="mb-2 block text-sm font-semibold">약정 종료일</label>
                        <input id="contract-end" type="date" value={contractEnd}
                               onChange={e => setContractEnd(e.target.value)}
                               className="max-w-[220px] rounded-field border border-line px-3.5 py-3" />
                      </div>
                    )}
                  </div>
                )}
                <Actions onNext={nextFromStep1} />
              </>
            )}

            {step === 2 && (
              <>
                <Question kicker="디테일 모드 · 희망 조건"
                          sub="원하는 데이터 사용량과 지금 내는 통신비를 알려주시면 절감액까지 계산해요.">
                  지금 얼마나 쓰고 계세요?
                </Question>
                <div className="rounded-card border border-line px-6 py-7">
                  <output className="mb-4 block text-[28px] font-extrabold">{DATA_BUCKETS[dataIdx].label}</output>
                  <input type="range" min={0} max={DATA_BUCKETS.length - 1} step={1} value={dataIdx}
                         aria-label="희망 데이터 사용량 구간"
                         onChange={e => setDataIdx(Number(e.target.value))}
                         className="h-1.5 w-full accent-brand" />
                  <p className="mt-2 text-sm text-muted">데이터 사용량 구간을 조절해 주세요.</p>
                </div>

                <h2 className="mt-8 text-xl font-extrabold">지금 내는 월 통신비는요?</h2>
                <div className="mt-2.5 flex flex-wrap gap-2.5" role="group" aria-label="현재 월 통신비">
                  {FEE_BUCKETS.map(b => (
                    <Choice key={b.label} label={b.label} active={!customFee && fee?.label === b.label}
                            onClick={() => { setCustomFee(false); setFee({ label: b.label, amount: b.rep }); }} />
                  ))}
                  <Choice label="직접입력" active={customFee} onClick={() => setCustomFee(true)} />
                </div>
                {customFee && (
                  <input type="number" inputMode="numeric" min={0} step={100} placeholder="예: 55000" autoFocus
                         aria-label="통신비 직접 입력(원)"
                         onChange={e => {
                           const value = Number(e.target.value);
                           setFee(Number.isSafeInteger(value) && value > 0
                             ? { label: `${value.toLocaleString('ko-KR')}원`, amount: value } : null);
                         }}
                         className="field mt-3 max-w-[220px]" />
                )}

                <h2 className="mt-8 text-xl font-extrabold">아래를 알려주시면 더 정확해져요</h2>
                <p className="mt-1 text-sm text-muted">모르면 건너뛰어도 결과는 나와요. 아는 만큼만 골라주세요.</p>
                <ChoiceGroup label="선택약정 25% 할인" stack value={contractType} onChange={setContractType}
                  options={[['SELECTIVE_25', '받고 있어요'], ['NONE', '받고 있지 않아요'], [null, '잘 모르겠어요']]} />
                <ChoiceGroup label="사용 중인 통신망" value={networkType} onChange={setNetworkType}
                  options={[['5G', '5G'], ['LTE', 'LTE'], ['3G', '3G'], [null, '상관없어요']]} />
                <ChoiceGroup label="가족 결합" stack value={hasFamilyBundle} onChange={setHasFamilyBundle}
                  options={[[true, '하고 있어요'], [false, '하고 있지 않아요'], [null, '잘 모르겠어요']]} />
                <Actions onNext={() => go(3)} />
              </>
            )}

            {step === 3 && (
              <>
                <Question kicker="디테일 모드 · 구독" sub="유지할 서비스와 해지할 서비스를 정해주세요.">
                  희망하는 구독서비스를 말해주세요!
                </Question>
                <div className="mb-3.5 flex flex-col gap-2.5">
                  {wish.map(w => (
                    <div key={w.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-line px-4 py-3">
                      <span className="font-semibold">{w.service.icon}  {w.service.name}</span>
                      <select value={w.disposition} aria-label={`${w.service.name} 유지 여부`}
                              onChange={e => setWish(list => list.map(x => x.id === w.id ? { ...x, disposition: e.target.value } : x))}
                              className="rounded-lg border border-line bg-white px-2.5 py-1.5">
                        <option value="유지">유지</option>
                        <option value="해지">해지</option>
                      </select>
                      <button type="button" aria-label={`${w.service.name} 제거`}
                              onClick={() => setWish(list => list.filter(x => x.id !== w.id))}
                              className="cursor-pointer border-0 bg-transparent text-[15px] text-muted">✕</button>
                    </div>
                  ))}
                  {!wish.length && <p className="text-sm text-muted">아직 고른 서비스가 없어요. 아래에서 추가해 주세요.</p>}
                </div>
                <button type="button" onClick={() => setModalOpen(true)}
                        className="btn border-brand bg-white text-brand-ink hover:bg-brand-tint">+ 추가하기</button>
                <Actions onNext={analyze} nextLabel="분석 시작하기" />
              </>
            )}
          </div>
        </div>

        {modalOpen && (
          <AddModal catalog={catalog} chosen={wish.map(w => w.id)}
                    onClose={() => setModalOpen(false)}
                    onAdd={ids => {
                      setWish(list => [...list, ...ids.map(id => {
                        const s = catalog.find(x => x.id === id);
                        return { id: s.id, service: s, tierId: s.tiers[0].id, disposition: '유지' };
                      })]);
                      setModalOpen(false);
                    }} />
        )}
      </main>
    </>
  );
}

/* 통신사 — 검색 자동완성. 전체 목록을 나열하지 않고 입력하면 일치하는 것만 제안한다. */
function CarrierSearch({ query, onQuery, open, selected, onPick }) {
  const found = useMemo(
    () => (query.trim() ? CARRIERS.filter(c => matches(c.name, query) || (c.mvno && matches('알뜰폰', query))) : []),
    [query]);
  return (
    <div>
      <input value={query} onChange={e => onQuery(e.target.value)} onFocus={() => onQuery(query)}
             placeholder="통신사 이름을 입력하세요" aria-label="통신사 검색" className="field" />
      {open && query.trim() && (
        <div className="mt-2 overflow-hidden rounded-card border border-line">
          {found.length ? found.map(c => (
            <button key={c.name} type="button" onClick={() => onPick(c)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 border-b border-line px-4 py-3.5
                      text-left font-semibold last:border-b-0
                      ${selected?.name === c.name ? 'bg-brand-tint text-brand-ink' : 'bg-white hover:bg-bg-soft'}`}>
              <Highlight name={c.name} query={query} />
              {c.mvno && <small className="text-xs font-medium text-muted">알뜰폰</small>}
            </button>
          )) : <p className="px-4 py-3.5 text-sm text-muted">일치하는 통신사가 없어요. 다른 이름으로 검색해 보세요.</p>}
        </div>
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
function Statement({ carrier, contractHas, fee }) {
  return (
    <aside className="rounded-card border border-line bg-bg-soft p-[22px]" aria-label="입력 요약">
      <h2 className="border-b-2 border-black/10 pb-3 text-[15px] font-bold">지금까지 고른 것</h2>
      <dl className="m-0 mt-3 grid gap-2 text-sm">
        <Row label="통신사" value={carrier?.name || '—'} />
        <Row label="약정" value={contractHas === null ? '—' : contractHas ? 'Y' : 'N'} />
        <Row label="통신비" value={fee ? won(fee.amount) : '—'} />
      </dl>
    </aside>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between"><dt className="text-ink-soft">{label}</dt><dd className="m-0 font-semibold">{value}</dd></div>
);

/** 추가 모달. <dialog> 는 포커스 가둠·백드롭을 브라우저가 해준다 — 직접 만들지 않는다. */
function AddModal({ catalog, chosen, onClose, onAdd }) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState([]);
  useEffect(() => { ref.current?.showModal(); }, []);

  const shown = catalog.filter(s => !chosen.includes(s.id) && matches(s.name, query));
  return (
    <dialog ref={ref} onClose={onClose}
            className="w-[min(460px,92vw)] rounded-[18px] p-[22px] shadow-card backdrop:bg-ink/40">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">구독 서비스 추가</h2>
        <button type="button" onClick={onClose} aria-label="닫기"
                className="cursor-pointer border-0 bg-transparent text-base text-muted">✕</button>
      </div>
      <input value={query} onChange={e => setQuery(e.target.value)} autoFocus
             placeholder="서비스 검색" aria-label="서비스 검색" className="field mb-3.5" />
      <div className="mb-4 flex max-h-[320px] flex-col overflow-y-auto rounded-card border border-line">
        {shown.map(s => (
          <label key={s.id} className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <input type="checkbox" className="size-[18px] accent-brand"
                   checked={picked.includes(s.id)}
                   onChange={() => setPicked(p => p.includes(s.id) ? p.filter(x => x !== s.id) : [...p, s.id])} />
            <span className="font-semibold">{s.icon}  {s.name}</span>
            <span className="text-sm text-ink-soft">{tierPrice(s.tiers[0])}</span>
          </label>
        ))}
        {!shown.length && <p className="p-4 text-sm text-muted">추가할 서비스가 없어요.</p>}
      </div>
      <button type="button" onClick={() => onAdd(picked)} className="btn btn-brand btn-block">추가</button>
    </dialog>
  );
}
