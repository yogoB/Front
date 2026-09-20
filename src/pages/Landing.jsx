import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Footer } from '../components/Layout.jsx';
import { request } from '../lib/api.js';
import { nextSampleIndex } from '../lib/roulette.js';
import AuthReturn from '../components/AuthReturn.jsx';

/** 표본 기준 코드 → 화면 문구. 서버는 코드로 주고 한국어는 화면이 정한다(model.js 의 provenance 와 같은 패턴).
    BE 확정 2026-09-18: 표본은 '지금 쓰는 요금제 대비' 차액이고, 현재 요금제를 모르는 건은 표본에서 빠진다. */
const BASIS = {
  CURRENT_PLAN: '지금 쓰는 요금제 대비 월 절감액',
  LIST_PRICE: '정가 대비 월 절감액',
};

const SOURCE = '로그인 후 결과를 확인한 이용자의 진단 절감액 표본입니다. 계정당 최신 1건만 사용하며 이름 등 식별 정보는 포함하지 않습니다. 실제 요금 변경 후 청구액은 아닙니다.';

export default function Landing() {
  const navigate = useNavigate();
  // 이용자 절감액 표본(계정당 1건). 없거나 서버가 아직 이 경로를 안 열었으면 숫자 블록을 그리지 않는다 —
  // 랜딩에 지어낸 금액을 두지 않는다(절대 원칙 2·4, 가상 인물 카피 삭제 2026-09-18).
  const [stats, setStats] = useState();
  useEffect(() => {
    request('/api/v1/stats/savings').then(({ data }) => setStats(data)).catch(() => setStats(null));
  }, []);

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-white">
      <Header />
      {/* Google 은 랜딩으로 복귀한다 — 게이트에서 출발했으면 그 화면으로 돌려보낸다. */}
      <AuthReturn />
      <main className="mx-auto flex min-h-0 w-full max-w-page flex-1 flex-col px-5 pb-0 sm:px-6">
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center py-5 text-center sm:py-7">
          <h1 className="text-[40px] font-extrabold leading-[1.08] tracking-[-.04em] text-ink sm:text-[56px] md:text-[68px]">
            <span className="block">통신요금+구독료</span>
            <span className="block"><span className="text-brand">다이어트</span> 솔루션</span>
          </h1>

          <div className="mt-7 sm:mt-9">
            {stats === undefined
              ? <SavingsStatus>절감액 표본을 불러오는 중</SavingsStatus>
              : stats?.samples?.length > 0
                ? <SavingsRoulette samples={stats.samples} basis={stats.basis} />
                : <SavingsStatus>공개할 절감액 표본을 모으는 중이에요.</SavingsStatus>}
          </div>

          <button type="button" onClick={() => navigate('/modes')} className="btn btn-dark btn-lg mt-7 min-w-44 active:translate-y-px">
            다이어트 시작
          </button>
        </section>
        <Footer compact />
      </main>
    </div>
  );
}

/* 서버가 준 실제 1인 표본만 무작위로 순환한다. 금액을 계산하거나 보간하지 않는다(절대 원칙 2·4). */
function SavingsRoulette({ samples, basis }) {
  const amount = useRollingSample(samples);
  const source = `${BASIS[basis] ?? '월 절감액'}. ${SOURCE}`;
  return (
    <div>
      <p className="text-sm font-semibold text-ink/60">진단에서 확인한 1인당 월 절감액</p>
      <div className="mt-2 h-[4.15rem] overflow-hidden sm:h-[5.25rem]">
        <p key={amount} className="roulette-number tnum whitespace-nowrap text-[54px] font-extrabold leading-none tracking-[-.04em] text-ink sm:text-[72px]">
          {amount.toLocaleString('ko-KR')}<span className="ml-1 text-[.38em] font-bold">원</span>
        </p>
      </div>
      <span className="sr-only">실제 이용자 절감액 표본을 무작위로 순환 표시합니다.</span>
      <div className="group relative mx-auto mt-3 w-fit">
        <button type="button" aria-describedby="savings-source" aria-label="절감액 출처 보기"
                className="grid size-11 cursor-help place-items-center rounded-full bg-white text-ink">
          <span className="grid size-5 place-items-center rounded-full border border-ink/45 text-[11px] font-extrabold leading-none transition-colors group-hover:border-brand group-hover:bg-brand group-focus-within:border-brand">
            !
          </span>
        </button>
        <div id="savings-source" role="tooltip"
             className="pointer-events-none invisible absolute bottom-[calc(100%+10px)] left-1/2 z-20 w-[min(320px,calc(100vw-32px))] -translate-x-1/2 translate-y-1 rounded-lg bg-ink px-3.5 py-3 text-left text-xs font-medium leading-relaxed text-white opacity-0 shadow-[0_12px_28px_rgb(23_24_42_/.18)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
          {source}
        </div>
      </div>
    </div>
  );
}

function SavingsStatus({ children }) {
  return (
    <div className="flex h-[7.9rem] items-center justify-center sm:h-[9rem]" role="status">
      <p className="text-sm font-semibold text-ink/60">{children}</p>
    </div>
  );
}

const ROULETTE_INTERVAL_MS = 1200;

/** 서버 표본을 1.2초마다 하나씩 무작위로 바꾼다. */
function useRollingSample(samples) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    // 움직임을 줄여 달라는 설정이면 첫 표본에서 멈춘다 — index.css 의 전역 규칙은 CSS 애니메이션만 멈춘다.
    if (samples.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setIdx(i => nextSampleIndex(i, samples.length)), ROULETTE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [samples]);
  return samples[idx] ?? samples[0];
}
