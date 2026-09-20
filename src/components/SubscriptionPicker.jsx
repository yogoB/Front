import { tierPrice, foreignNote, matches } from '../lib/model.js';
import { SearchState } from './Flow.jsx';

/** 금액 옆의 작은 ⓘ — 마우스를 올리면 근거가 뜬다(사용자 결정 2026-09-18). 글자보다 작게 둔다.
    목록이 overflow-y-auto 안이라 CSS 말풍선(.info)은 잘린다 — 브라우저 기본 툴팁을 쓴다.
    title 을 못 읽는 스크린리더도 있으니 aria-label 을 함께 준다. */
export const PriceNote = ({ note }) => note ? (
  <span role="img" aria-label={note} title={note}
        className="ml-1 cursor-help align-middle text-[11px] leading-none text-muted">ⓘ</span>
) : null;

/** 구독 목록. 검색 + 멀티셀렉트가 기본이고 나열은 그 결과다(ux-flow A3). */
export default function SubscriptionPicker({ subs, query, onQuery, onToggle, onTier, status = 'ready', onRetry }) {
  const shown = subs.filter(s => matches(s.service.name, query));
  return (
    <>
      <div className="mb-4">
        <input value={query} onChange={e => onQuery(e.target.value)}
               placeholder={status === 'loading' ? '구독 목록을 불러오는 중이에요…' : '서비스 검색'}
               aria-label="서비스 검색" aria-busy={status === 'loading'}
               className="field" />
      </div>
      <div className="flex max-h-[420px] flex-col overflow-y-auto rounded-card border border-line bg-white">
        {shown.map(sub => {
          const tier = sub.service.tiers.find(t => t.id === sub.tierId);
          return (
            /* 폰에서는 이름+금액 한 줄, 등급 선택은 아래 줄 전체 폭이다.
               셋을 한 줄에 두면 360px 에서 이름이 아이콘 밑으로 밀리고 셀렉트가 잘렸다(사용자 제보 2026-09-20). */
            <label key={sub.id}
                   className={`flex min-h-14 shrink-0 cursor-pointer items-center gap-3
                     border-b border-line px-4 py-2.5 last:border-b-0 transition-colors duration-150
                     ${sub.checked ? 'bg-ink text-white [&_[role=img]]:text-white/70' : 'hover:bg-bg-soft'}`}>
              <input type="checkbox" checked={sub.checked} onChange={() => onToggle(sub.id)}
                     className="size-[18px] shrink-0 accent-brand" />
              <span className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[1fr_auto_auto]">
                <span className="min-w-0 font-semibold">{sub.service.icon}  {sub.service.name}</span>
                <span className={`whitespace-nowrap justify-self-end text-sm sm:justify-self-auto ${sub.checked ? 'text-white/75' : 'text-ink-soft'}`}>
                  {tierPrice(tier)}
                  <PriceNote note={foreignNote(tier)} />
                </span>
                <select value={sub.tierId} aria-label={`${sub.service.name} 등급`}
                        disabled={sub.service.tiers.length < 2}
                        onClick={e => e.preventDefault()}
                        onChange={e => onTier(sub.id, Number(e.target.value))}
                        className="col-span-2 min-h-10 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-ink-soft sm:col-span-1 sm:w-auto">
                  {sub.service.tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </span>
            </label>
          );
        })}
        {/* 로딩·실패를 0건으로 적지 않는다(사용자 피드백 2026-09-18). */}
        {!shown.length && <SearchState status={status} onRetry={onRetry} empty="검색 결과가 없어요." className="px-4 py-6 text-center text-sm" />}
      </div>
    </>
  );
}
