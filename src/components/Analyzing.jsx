import { useEffect, useState } from 'react';

const STEPS = [
  '요금제 데이터베이스 조회 중…',
  '통신사 결합 조건 분석 중…',
  '번들 할인 탐색 중…',
  '개인화된 절감 조합 계산 중…',
  '결과 준비 완료!',
];

/** 분석 연출. 실제 계산은 결과 화면이 BE 에 요청한다 — 여기서는 기다림을 설명만 한다. */
export default function Analyzing({ onDone }) {
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done > STEPS.length) { onDone(); return; }
    const timer = setTimeout(() => setDone(d => d + 1), 550);
    return () => clearTimeout(timer);
  }, [done, onDone]);

  return (
    <section aria-live="polite" className="mx-auto my-16 max-w-[460px] text-center">
      <span className="inline-grid size-12 place-items-center rounded-xl bg-bg-soft" aria-hidden="true">
        <span className="size-[22px] animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
      </span>
      <h1 className="my-5 text-[22px] font-extrabold">최적 요금 조합 탐색 중</h1>
      <ul className="mb-[22px] grid list-none gap-2.5 p-0 text-left">
        {STEPS.map((text, i) => (
          <li key={text}
              className={`rounded-[10px] border px-3.5 py-3 text-sm transition-opacity
                ${i < done ? 'border-line text-ink opacity-100' : 'border-line text-muted opacity-50'}`}>
            {i < done && <span className="font-extrabold text-ink">✓ </span>}{text}
          </li>
        ))}
      </ul>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#eceef2]">
        <i className="block h-full bg-brand transition-[width] duration-[400ms]"
           style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>
    </section>
  );
}
