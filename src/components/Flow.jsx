import { useEffect, useRef } from 'react';

/** 단계 표시(시안) — 점 아래 라벨, 점 사이 가는 선. 지나온 단계는 눌러서 돌아갈 수 있다.
    `49d36eb` 가 "미사용" 으로 지웠다가 운영에서 /light·/detail 이 흰 화면이 됐다(2026-09-18).
    FlowHead 가 부르므로 미사용이 아니다 — export 를 떼 한 파일 안에서만 쓰게 두고 여기 남긴다. */
function Progress({ steps, current, onGo }) {
  return (
    <ol className="m-0 flex flex-1 list-none p-0">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current, now = n === current;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center">
            {n < steps.length && (
              <span aria-hidden="true" className={`absolute left-1/2 top-[13px] h-px w-full ${done ? 'bg-brand' : 'bg-[#cfd3da]'}`} />
            )}
            <button type="button" onClick={() => onGo(n)} aria-current={now ? 'step' : undefined}
                    className={`relative z-[1] flex min-h-11 cursor-pointer flex-col items-center gap-1.5 border-0 bg-transparent px-2 text-xs font-semibold
                      ${now ? 'text-brand-ink' : 'text-muted'}`}>
              <span className={`grid size-[26px] place-items-center rounded-full border text-xs
                ${now ? 'border-brand bg-brand text-ink' : done ? 'border-brand bg-white text-brand-ink' : 'border-line bg-white text-muted'}`}>
                {n}
              </span>
              <span>{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function FlowHead({ steps, current, onGo, onBack }) {
  return (
    <div className="mx-auto mb-10 mt-2 flex max-w-[560px] items-start gap-3">
      <button type="button" onClick={onBack} aria-label="뒤로"
              className="grid size-11 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-xl text-muted hover:bg-white">←</button>
      <Progress steps={steps} current={current} onGo={onGo} />
    </div>
  );
}

/** 질문 제목. 단계가 바뀌면 여기로 초점을 옮긴다 — 키보드·스크린리더가 새 질문을 읽는다.
    tip 이 있으면 제목 오른쪽에 ⓘ 말풍선(시안). */
export function Question({ kicker, children, sub, tip }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); scrollTo(0, 0); }, []);
  return (
    <div className="mb-8">
      {kicker && <span className="text-sm font-bold text-muted">{kicker}</span>}
      <div className="flex items-center justify-between gap-3">
        <h1 ref={ref} tabIndex={-1} className="mb-3 mt-2 text-2xl font-extrabold leading-snug tracking-[-.01em] outline-none md:text-[28px]">
          {children}
        </h1>
        {tip && <button type="button" className="info" aria-label="도움말" data-tip={tip}>i</button>}
      </div>
      {sub && <p className="max-w-prose text-sm leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

export function ErrorLine({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="mx-auto mb-6 max-w-[560px] rounded-[10px] bg-danger-tint px-4 py-3 text-sm leading-relaxed text-danger">
      {children}
    </p>
  );
}

/** 다음·건너뛰기. "모름"으로도 끝까지 간다(절대 원칙 5-①) — 건너뛰기를 없애지 않는다. */
export function Actions({ onNext, nextLabel = '다음', onSkip, skipLabel = '모르겠어요, 건너뛸게요' }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <button type="button" onClick={onNext} className="btn btn-primary btn-block btn-lg rounded-lg">{nextLabel}</button>
      {onSkip && (
        <button type="button" onClick={onSkip} className="btn-text text-[13px] hover:underline hover:underline-offset-[3px]">
          {skipLabel}
        </button>
      )}
    </div>
  );
}

/** 데이터 구간 슬라이더(시안). 채워진 트랙은 --pct 로 그린다. */
export function RangeCard({ label, value, idx, max, onChange, ariaLabel }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{label}</p>
      <output className="mb-4 block text-2xl font-extrabold tnum">{value}</output>
      <input type="range" min={0} max={max} step={1} value={idx} aria-label={ariaLabel}
             onChange={e => onChange(Number(e.target.value))}
             style={{ '--pct': `${(idx / max) * 100}%` }} className="range cursor-pointer" />
    </div>
  );
}

/** 검색 목록의 세 상태를 한 자리에서 그린다 — 로딩 / 실패 / 0건.
    사용자 피드백(2026-09-18): "처음에 눌렀는데 반응이 없어서 결과가 없는 건지 로딩이 오래 걸리는 건지 몰랐다."
    카탈로그가 도착하기 전에도 "없어요"를 띄우고 있었다. 로딩과 0건은 다른 말이어야 한다. */
export function SearchState({ status, empty, onRetry, className = 'px-4 py-3 text-sm' }) {
  if (status === 'loading') {
    return (
      <p className={`flex items-center gap-2 text-muted ${className}`}>
        <span aria-hidden="true" className="inline-block size-3.5 animate-spin rounded-full border-2 border-line border-t-brand" />
        불러오는 중이에요 · 잠시만 기다려 주세요
      </p>
    );
  }
  if (status === 'failed') {
    return (
      <p className={`flex flex-wrap items-center gap-2 text-muted ${className}`}>
        목록을 불러오지 못했어요.
        {onRetry && <button type="button" onClick={onRetry} className="btn-text font-semibold text-ink">다시 시도</button>}
      </p>
    );
  }
  return <p className={`text-muted ${className}`}>{empty}</p>;
}
