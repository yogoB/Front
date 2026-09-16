import { useEffect, useRef } from 'react';

/** 단계 표시. 지나온 단계는 눌러서 돌아갈 수 있다(원래 동작 유지). */
export function Progress({ steps, current, onGo }) {
  return (
    <ol className="m-0 flex list-none items-center gap-2.5 p-0">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current, now = n === current;
        return (
          <li key={label} onClick={() => onGo(n)}
              className={`flex cursor-pointer items-center gap-2 text-sm font-semibold
                ${now ? 'text-ink' : 'text-muted'}`}>
            <span className={`grid size-[26px] place-items-center rounded-full text-[13px]
              ${now ? 'bg-brand text-white' : done ? 'bg-brand-tint text-brand-ink' : 'bg-[#eceef2] text-muted'}`}>
              {n}
            </span>
            <span>{label}</span>
            {n < steps.length && <span className={`ml-1 h-0.5 w-10 ${done ? 'bg-brand' : 'bg-[#eceef2]'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

export function FlowHead({ steps, current, onGo, onBack }) {
  return (
    <div className="my-2 mb-8 flex items-center gap-4">
      <button type="button" onClick={onBack} aria-label="뒤로"
              className="cursor-pointer border-0 bg-transparent text-xl text-muted">←</button>
      <Progress steps={steps} current={current} onGo={onGo} />
    </div>
  );
}

/** 질문 제목. 단계가 바뀌면 여기로 초점을 옮긴다 — 키보드·스크린리더가 새 질문을 읽는다. */
export function Question({ kicker, children, sub }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); scrollTo(0, 0); }, []);
  return (
    <>
      {kicker && <span className="inline-block rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand-ink">{kicker}</span>}
      <h1 ref={ref} tabIndex={-1} className="my-3.5 mb-2 text-[26px] font-extrabold tracking-[-.01em] outline-none">
        {children}
      </h1>
      {sub && <p className="mb-6 text-muted">{sub}</p>}
    </>
  );
}

export function ErrorLine({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="mx-auto mb-4 max-w-[560px] rounded-[10px] bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
      {children}
    </p>
  );
}

/** 다음·건너뛰기. "모름"으로도 끝까지 간다(절대 원칙 5-①) — 건너뛰기를 없애지 않는다. */
export function Actions({ onNext, nextLabel = '다음', onSkip, skipLabel = '모르겠어요, 건너뛸게요' }) {
  return (
    <div className="mt-7 flex flex-col items-center gap-3.5">
      <button type="button" onClick={onNext} className="btn btn-brand btn-block">{nextLabel}</button>
      {onSkip && (
        <button type="button" onClick={onSkip}
                className="cursor-pointer border-0 bg-transparent text-sm text-muted underline underline-offset-[3px]">
          {skipLabel}
        </button>
      )}
    </div>
  );
}
