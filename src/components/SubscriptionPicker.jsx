import { tierPrice, matches } from '../lib/model.js';

/** 구독 목록. 검색 + 멀티셀렉트가 기본이고 나열은 그 결과다(ux-flow A3). */
export default function SubscriptionPicker({ subs, query, onQuery, onToggle, onTier }) {
  const shown = subs.filter(s => matches(s.service.name, query));
  return (
    <>
      <div className="mb-4">
        <input value={query} onChange={e => onQuery(e.target.value)}
               placeholder="서비스 검색" aria-label="서비스 검색"
               className="field" />
      </div>
      <div className="flex max-h-[420px] flex-col overflow-y-auto rounded-card border border-line bg-white">
        {shown.map(sub => {
          const tier = sub.service.tiers.find(t => t.id === sub.tierId);
          return (
            <label key={sub.id}
                   className={`grid min-h-14 cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-3
                     border-b border-line px-4 py-2.5 last:border-b-0 transition-colors duration-150
                     ${sub.checked ? 'bg-brand-tint' : 'hover:bg-bg-soft'}`}>
              <input type="checkbox" checked={sub.checked} onChange={() => onToggle(sub.id)}
                     className="size-[18px] accent-brand" />
              <span className="font-semibold">{sub.service.icon}  {sub.service.name}</span>
              <span className="text-sm text-ink-soft">{tierPrice(tier)}</span>
              <select value={sub.tierId} aria-label={`${sub.service.name} 등급`}
                      disabled={sub.service.tiers.length < 2}
                      onClick={e => e.preventDefault()}
                      onChange={e => onTier(sub.id, Number(e.target.value))}
                      className="min-h-10 rounded-lg border border-line bg-white px-2 py-1.5 text-ink-soft">
                {sub.service.tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          );
        })}
        {!shown.length && <p className="px-4 py-6 text-center text-sm text-muted">검색 결과가 없어요.</p>}
      </div>
    </>
  );
}
