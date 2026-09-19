import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Footer } from '../components/Layout.jsx';
import { request } from '../lib/api.js';
import AuthReturn from '../components/AuthReturn.jsx';

const TRUST = ['카드·계좌 연결 없음', '금액마다 출처 표시', '안 쓰는 혜택은 0원으로 계산'];

/** 표본 기준 코드 → 화면 문구. 서버는 코드로 주고 한국어는 화면이 정한다(model.js 의 provenance 와 같은 패턴).
    BE 확정 2026-09-18: 표본은 '지금 쓰는 요금제 대비' 차액이고, 현재 요금제를 모르는 건은 표본에서 빠진다. */
const BASIS = {
  CURRENT_PLAN: '지금 쓰는 요금제 대비 월 절감액',
  LIST_PRICE: '정가 대비 월 절감액',
};

export default function Landing() {
  const navigate = useNavigate();
  // 이용자 절감액 표본(계정당 1건). 없거나 서버가 아직 이 경로를 안 열었으면 숫자 블록을 그리지 않는다 —
  // 랜딩에 지어낸 금액을 두지 않는다(절대 원칙 2·4, 가상 인물 카피 삭제 2026-09-18).
  const [stats, setStats] = useState(null);
  useEffect(() => {
    request('/api/v1/stats/savings').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {/* Google 은 랜딩으로 복귀한다 — 게이트에서 출발했으면 그 화면으로 돌려보낸다. */}
      <AuthReturn />
      <main className="mx-auto flex w-full max-w-page flex-1 flex-col px-6">
        <section className="flex flex-1 flex-col items-center justify-center gap-8 py-14 text-center md:py-20">
          <span className="rounded-full bg-brand-tint px-3 py-1.5 text-[13px] font-bold text-brand-ink">
            통신비 · 구독료 최적화 진단
          </span>

          <h1 className="max-w-[24ch] text-[34px] font-extrabold leading-[1.24] tracking-[-.03em] md:text-[52px]">
            통신비와 구독료를 <span className="text-brand">최대한 줄여드려요</span>
          </h1>

          {/* 1인당 평균이 있으면 그것이 히어로 숫자다(사용자 지시 2026-09-19). 표본이 적으면 BE 가 null 로 주므로 저절로 숨는다 —
              한두 명의 금액을 "1인당 평균"이라는 이름으로 랜딩에 띄우지 않는다. 평균이 없을 때만 예전 표본 굴리기를 쓴다. */}
          {stats?.monthlyAverage != null
            ? <SavingsAverage average={stats.monthlyAverage} median={stats.monthlyMedian} count={stats.sampleCount} basis={stats.basis} />
            : stats?.samples?.length > 0 && <SavingsTicker samples={stats.samples} count={stats.sampleCount} basis={stats.basis} />}

          <p className="max-w-prose text-base leading-relaxed text-ink-soft md:text-lg">
            질문 세 개면 내 통신비와 구독료가 정리되고, 지금보다 나은 조합이 나옵니다.
          </p>

          <button type="button" onClick={() => navigate('/modes')} className="btn btn-dark btn-lg">
            내 요금제 진단받기
          </button>

          <ul className="flex list-none flex-wrap justify-center gap-2.5 p-0">
            {TRUST.map(text => (
              <li key={text} className="chip">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </section>
        <Footer />
      </main>
    </div>
  );
}

/* 이용자들이 진단에서 확인한 절감액. 표본을 순환하며 보여준다 —
   **모든 프레임이 BE 가 준 실제 표본**이고 중간값을 만들지 않는다(절대 원칙 2: 화면은 금액을 만들지 않는다).
   그래서 카운트업(보간)이 아니라 표본 갈아치우기다. 빠르게 돌다 느려지고, 멈췄다가 다시 돈다. */
/* 이용자 1인당 평균 절감액. 평균·중앙값·표본 수 전부 BE 값이다 — 화면은 나누지도 더하지도 않는다(절대 원칙 2). */
function SavingsAverage({ average, median, count, basis }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-muted">이용자 1인당 평균 월 절감액</p>
      <p className="tnum text-[52px] font-extrabold leading-none tracking-[-.03em] text-ink md:text-[76px]">
        <span className="text-brand-strong">{average.toLocaleString('ko-KR')}</span>
        <span className="text-[.42em] font-bold text-ink-soft"> 원</span>
      </p>
      {/* 금액에는 기준을 붙인다(절대 원칙 4). 진단에서 확인한 금액이고 실제로 옮겼는지는 우리가 모른다. */}
      <p className="text-[13px] leading-relaxed text-muted">
        {BASIS[basis] ?? '월 절감액'} · 진단에서 확인한 절감액
        {count > 0 && ` · 이용자 ${count.toLocaleString('ko-KR')}명 기준(계정당 1건)`}
        {median != null && median !== average && <><br />중앙값은 월 {median.toLocaleString('ko-KR')}원이에요.</>}
      </p>
    </div>
  );
}

function SavingsTicker({ samples, count, basis }) {
  const amount = useRollingSample(samples);
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-muted">요고비로 진단한 사람들이 확인한 절감액</p>
      <p className="tnum text-[52px] font-extrabold leading-none tracking-[-.03em] text-ink md:text-[76px]">
        {/* 5자리 기준으로 폭을 미리 잡아 숫자가 바뀌어도 줄이 흔들리지 않는다(자리수는 표본 그대로 보여준다). */}
        <span key={amount} className="tick inline-block min-w-[6.4ch] text-right text-brand-strong">
          {amount.toLocaleString('ko-KR')}
        </span>
        <span className="text-[.42em] font-bold text-ink-soft"> 원</span>
      </p>
      {/* 금액에는 기준을 붙인다(절대 원칙 4). 실제로 옮겼는지까지는 우리가 알 수 없으므로 '확인한'이라고 적는다. */}
      <p className="text-[13px] text-muted">
        {BASIS[basis] ?? '월 절감액'}
        {count > 0 && ` · 이용자 ${count.toLocaleString('ko-KR')}명의 표본(계정당 1건)`}
      </p>
    </div>
  );
}

const SPINS = 8;   // 한 바퀴에 몇 번 빠르게 굴릴지

/** 표본 배열을 돌려주는 훅. 인덱스만 바꾼다 — 금액을 계산하지 않는다. */
function useRollingSample(samples) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    // 움직임을 줄여 달라는 설정이면 첫 표본에서 멈춘다 — index.css 의 전역 규칙은 CSS 애니메이션만 멈춘다.
    if (samples.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer;
    const spin = n => {
      setIdx(i => (i + 1) % samples.length);
      const landed = n >= SPINS;
      timer = setTimeout(() => spin(landed ? 0 : n + 1), landed ? 2200 : 70 + n * 30);
    };
    timer = setTimeout(() => spin(0), 1200);
    return () => clearTimeout(timer);
  }, [samples]);
  return samples[idx] ?? samples[0];
}
