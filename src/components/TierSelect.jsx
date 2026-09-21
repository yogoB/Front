import { useEffect, useRef, useState } from 'react';

/* 등급 고르기. 브라우저 기본 select 는 운영체제 위젯이라 나머지 화면과 따로 놀았고(사용자 지적 2026-09-21),
   무엇보다 **닫힌 폭이 글자 길이에 따라 94~185px 로 변해** 옆에 있는 금액을 밀어냈다.
   Mobbin 레퍼런스(Wise·Dropbox Dash): 닫힌 모양은 입력창과 같고, 열리면 아래로 목록이 펼쳐진다.
   폭을 바깥에서 고정할 수 있게 만들어 금액 열이 한 줄로 서게 한다.

   목록이 스크롤 영역 안에 있어 바깥으로 삐져나온 말풍선은 잘린다 — 그래서 행 안에 자리를 잡고
   길어지면 그 안에서 스크롤한다. */
export default function TierSelect({ tiers, value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const only = tiers.length < 2;
  const current = tiers.find(t => t.id === value) ?? tiers[0];

  // 바깥을 누르거나 Esc 를 누르면 닫는다. 목록이 열린 채로 남으면 옆 행을 가린다.
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (only) {
    return <span className="truncate text-sm text-muted">{current?.name ?? '—'}</span>;
  }

  return (
    <span ref={box} className="relative block">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={label}
              /* label 이 이 버튼을 감싼 <label> 의 클릭으로 번지면 체크박스가 같이 토글된다 — 막는다. */
              onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
              className={`flex min-h-10 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border px-2.5 text-left text-sm
                border-line bg-white text-ink-soft hover:border-brand`}>
        <span className="truncate">{current?.name}</span>
        <span aria-hidden="true" className="shrink-0 text-[10px] opacity-60">▾</span>
      </button>
      {open && (
        <span role="listbox" aria-label={label}
              className="absolute right-0 top-[calc(100%+4px)] z-20 block max-h-56 w-[max(100%,11rem)] overflow-y-auto
                         rounded-lg border border-line bg-white py-1 shadow-[0_12px_28px_rgb(23_24_42_/.18)]">
          {tiers.map(t => (
            <button key={t.id} type="button" role="option" aria-selected={t.id === value}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(t.id); setOpen(false); }}
                    className={`block w-full cursor-pointer border-0 px-3 py-2 text-left text-sm
                      ${t.id === value ? 'bg-brand-tint font-semibold text-brand-ink' : 'bg-white text-ink-soft hover:bg-bg-soft'}`}>
              {t.name}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
