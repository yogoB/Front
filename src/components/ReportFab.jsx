import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { request, ApiError } from '../lib/api.js';
import { loadCatalog } from '../lib/catalog-data.js';
import { matches } from '../lib/model.js';

/* 모든 화면에 뜨는 "오류 제보" 플로팅 버튼(시안). 평소엔 봉투 아이콘 원, 올리면 알약으로 늘어나 글자가 나온다.
   상품 관련 카테고리는 /api/v1/catalog/reports(상품 지정 필수), 화면 오류·기타는 /api/v1/reports(D-41)로 보낸다.
   둘 다 비회원도 되지만 CSRF 가 필요하다 — request 의 member:true 가 토큰을 붙인다. */
const CATEGORIES = [
  ['PRICE', '요금·가격이 실제와 달라요', true],
  ['DATA', '데이터·통화 정보가 달라요', true],
  ['BENEFIT', '포함 혜택이 달라요', true],
  ['AVAILABILITY', '지금 가입할 수 없는 상품이에요', true],
  ['SYSTEM', '화면·기능 오류 (버튼이 안 눌려요, 화면이 깨져요 등)', false],
  ['OTHER', '기타', false],
];
const TARGETS = [['MOBILE_PLAN', '요금제'], ['SUBSCRIPTION_SERVICE', '구독 서비스']];
const message = e => (e instanceof ApiError ? e.message : '제보를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');

export default function ReportFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="오류 제보"
              className="group fixed bottom-6 right-6 z-40 flex h-16 cursor-pointer items-center gap-3 rounded-full border-0
                         bg-brand pl-2.5 pr-2.5 text-white shadow-[0_14px_30px_rgba(170,150,255,.45)] transition-all duration-200
                         hover:pr-7 focus-visible:pr-7">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20">
          <Envelope />
        </span>
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-[22px] font-extrabold tracking-[-.01em] opacity-0
                         transition-all duration-200 group-hover:max-w-40 group-hover:opacity-100 group-focus-visible:max-w-40 group-focus-visible:opacity-100">
          오류 제보
        </span>
      </button>
      {open && <ReportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

const Envelope = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

/** <dialog> 는 포커스 가둠·백드롭·ESC 를 브라우저가 해준다 — 직접 만들지 않는다. */
function ReportDialog({ onClose }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  const [category, setCategory] = useState('SYSTEM');
  const [targetType, setTargetType] = useState('MOBILE_PLAN');
  const [target, setTarget] = useState(null);          // { id, label }
  const [query, setQuery] = useState('');
  const [plans, setPlans] = useState([]);
  const [services, setServices] = useState([]);
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { ref.current?.showModal(); }, []);
  const needsTarget = CATEGORIES.find(([v]) => v === category)?.[2];

  // 상품 목록은 상품 카테고리를 고른 뒤에만 받는다. 실패해도 폼은 열려 있다 — 화면 오류 제보까지 막지 않는다.
  useEffect(() => {
    if (!needsTarget) return;
    if (!plans.length) request('/api/v1/catalog/plans').then(({ data }) => setPlans(data)).catch(() => {});
    if (!services.length) loadCatalog().then(setServices).catch(() => {});
  }, [needsTarget]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 1,700여 개 중 검색어에 맞는 8개만 보여준다(마이페이지 요금제 검색과 같은 규칙).
  const found = !query.trim() ? [] : targetType === 'MOBILE_PLAN'
    ? plans.filter(p => matches(`${p.carrier} ${p.name}`, query)).slice(0, 8).map(p => ({ id: p.id, label: `${p.carrier} ${p.name}` }))
    : services.filter(s => matches(s.name, query)).slice(0, 8).map(s => ({ id: s.id, label: `${s.icon} ${s.name}` }));

  async function submit(e) {
    e.preventDefault();
    if (needsTarget && !target) { setStatus('어떤 상품인지 골라주세요.'); return; }
    setBusy(true); setStatus('');
    try {
      const source = sourceUrl.trim() || undefined;
      if (needsTarget) {
        await request('/api/v1/catalog/reports', { method: 'POST', member: true,
          body: { targetType, targetId: target.id, field: category, description: description.trim(), sourceUrl: source } });
      } else {
        await request('/api/v1/reports', { method: 'POST', member: true,
          body: { category, description: description.trim(), pageUrl: pathname, sourceUrl: source } });
      }
      setDone(true);
    } catch (err) { setStatus(message(err)); } finally { setBusy(false); }
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="report-title"
            className="m-auto w-[min(520px,92vw)] rounded-[18px] p-6 shadow-card backdrop:bg-ink/40">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="report-title" className="text-lg font-extrabold">오류 제보</h2>
        <button type="button" onClick={onClose} aria-label="닫기"
                className="-mr-2 grid size-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-base text-muted hover:bg-bg-soft">✕</button>
      </div>

      {done ? (
        <>
          <p className="text-sm leading-relaxed text-ink-soft">접수했어요. 확인한 뒤 고칠게요. 고맙습니다.</p>
          <button type="button" onClick={onClose} className="btn btn-brand mt-5">닫기</button>
        </>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <p className="text-[13px] leading-relaxed text-muted">
            개인정보(이름·전화번호·계약번호)는 적지 말아 주세요. 접수만 하고 답장은 드리지 않아요.
          </p>

          <div>
            <label htmlFor="report-category" className="mb-2 block text-sm font-bold">어떤 오류인가요?</label>
            <select id="report-category" value={category} className="field"
                    onChange={e => { setCategory(e.target.value); setTarget(null); setQuery(''); }}>
              {CATEGORIES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>

          {needsTarget && (
            <div>
              <p className="mb-2 text-sm font-bold">어떤 상품인가요?</p>
              <div className="mb-2 flex gap-2" role="group" aria-label="상품 종류">
                {TARGETS.map(([v, label]) => (
                  <button key={v} type="button" onClick={() => { setTargetType(v); setTarget(null); setQuery(''); }} aria-pressed={targetType === v}
                          className={`min-h-10 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors duration-150
                            ${targetType === v ? 'border-brand bg-brand-tint text-brand-ink' : 'border-line bg-white text-ink-soft hover:bg-bg-soft'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {target ? (
                <div className="flex items-center justify-between gap-3 rounded-field border border-brand bg-brand-tint px-3.5 py-2.5 text-sm font-semibold text-brand-ink">
                  <span>{target.label}</span>
                  <button type="button" onClick={() => setTarget(null)} className="btn-text min-h-8 text-brand-ink">바꾸기</button>
                </div>
              ) : (
                <>
                  <input value={query} onChange={e => setQuery(e.target.value)} className="field"
                         placeholder={targetType === 'MOBILE_PLAN' ? '통신사나 요금제명으로 검색' : '구독 서비스명으로 검색'}
                         aria-label="상품 검색" />
                  {query.trim() && (
                    <div className="mt-2 max-h-56 overflow-y-auto rounded-card border border-line bg-white">
                      {found.length ? found.map(item => (
                        <button key={item.id} type="button" onClick={() => setTarget(item)}
                                className="block w-full cursor-pointer border-b border-line px-4 py-3 text-left text-sm font-semibold last:border-b-0 hover:bg-bg-soft">
                          {item.label}
                        </button>
                      )) : <p className="px-4 py-3 text-sm text-muted">검색 결과가 없어요. 이름 일부로 다시 찾아보세요.</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <label htmlFor="report-description" className="mb-2 block text-sm font-bold">무엇이 잘못됐나요?</label>
            <textarea id="report-description" value={description} onChange={e => setDescription(e.target.value)}
                      rows={4} maxLength={2000} required className="field"
                      placeholder={needsTarget ? '예: 월 39,000원이 아니라 41,000원이에요.' : '예: 결과 화면에서 "이렇게 진행해보세요" 버튼을 눌러도 아무 일도 없어요.'} />
          </div>

          <div>
            <label htmlFor="report-source" className="mb-2 block text-sm font-bold">출처 링크 <span className="font-medium text-muted">(선택)</span></label>
            <input id="report-source" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} inputMode="url"
                   placeholder="https://… 통신사 공식 페이지 등" className="field" />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={!description.trim() || busy}
                    className="btn btn-brand disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? '보내는 중…' : '제보 보내기'}
            </button>
            {status && <span role="alert" className="text-[13px] text-danger">{status}</span>}
          </div>
        </form>
      )}
    </dialog>
  );
}
