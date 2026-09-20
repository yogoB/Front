import { useEffect, useRef } from 'react';
import { forgetMember } from '../lib/useMember.js';
import { won } from '../lib/model.js';
import { Header } from './Layout.jsx';
import GoogleConsent from './GoogleConsent.jsx';

/* 비회원 화면. 리포트 대신 이것 하나만 그린다(ux-flow D-36, 사용자 결정 2026-09-17).
   **금액은 한 줄도 비치지 않는다** — 그래서 결과를 아예 계산하지 않고 이 화면으로 끝낸다.
   입력값은 sessionStorage 에 남아 로그인 뒤 같은 자리에서 이어진다.
   화면 게이트일 뿐 API 는 공개다 — CBT 이탈율을 보고 되돌릴 수 있게 그렇게 둔다. */
export default function GuestGate({ onGoogle, onBack }) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[460px] px-6 pb-24 pt-20 text-center">
        <p className="mb-5 text-[52px] leading-none" aria-hidden="true">🔒</p>
        <h1 className="text-[26px] font-extrabold tracking-[-.01em]">분석이 끝났어요!</h1>
        <p className="mb-8 mt-4 text-[15px] leading-relaxed text-ink-soft">
          결과 리포트는 로그인한 뒤에 볼 수 있어요.<br />
          지금까지 답하신 내용은 그대로 남아 있어요.
        </p>
        <GoogleConsent onContinue={onGoogle} label="Google 로 계속하기" />
        {/* 막다른 길을 만들지 않는다 — 로그인하지 않기로 한 사람도 나갈 곳이 있어야 한다. */}
        <button type="button" onClick={onBack} className="btn-text mt-4 underline underline-offset-[3px]">
          조건 다시 고르기
        </button>
      </main>
    </>
  );
}

/* 결과 화면 전용 게이트(사용자 결정 2026-09-18, 시안). 계산까지 끝낸 뒤 **절감액 한 줄만** 보여주고 로그인을 청한다.
   D-36 의 "금액은 한 줄도 비치지 않는다"를 티저 한 줄로 바꾼 것이다 — 그 정책이 "이탈이 높으면 꺼낼 카드"로
   남겨 두었던 선택지다(UX_POLICY 1-10 개정, ux-flow A10).
   뒤의 리포트는 흐려 두고, <dialog>.showModal() 이 나머지 화면을 inert 로 만든다 — 탭으로도 닿지 않는다.
   ESC 로 닫히면 게이트가 아니므로 취소만 막는다(닫을 길은 '조건 다시 고르기' 하나다). */
export function LoginTeaser({ amount, basis, onGoogle, onBack }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onCancel={e => e.preventDefault()} aria-labelledby="teaser-title"
            className="m-auto max-h-[90dvh] w-[min(560px,92vw)] overflow-y-auto rounded-[20px] bg-ink px-6 py-10 text-center text-white
                       backdrop:bg-ink/20 md:px-10">
      <p className="mb-6 text-[44px] leading-none" aria-hidden="true">🧾💸</p>
      <h2 id="teaser-title" className="text-[21px] font-extrabold leading-relaxed md:text-[23px]">
        고객님의 분석이 끝났어요!
        {/* 절감이 0 이면 숫자를 적지 않는다 — "최대 0원 절감"은 티저가 아니라 오해다. */}
        {amount > 0 && (
          <>
            <br />
            <mark className="rounded bg-brand px-2 py-0.5 text-ink">최대 {won(amount)}</mark> 절감 받을 수 있네요.
          </>
        )}
        <br />
        구체적인 내용과 일정플랜이 궁금하신가요?
      </h2>
      <div className="mt-7">
        <GoogleConsent onContinue={onGoogle} dark label="로그인" />
      </div>
      <p className="mt-5 text-sm text-white/70">로그인해서 구체적인 내용을 확인해보세요!</p>
      {/* 금액에는 기준을 붙인다(절대 원칙 4) — 무엇에 견준 절감인지 적지 않으면 숫자가 혼자 걸어다닌다. */}
      {amount > 0 && <p className="mt-1 text-xs text-white/45">{basis} 월 절감액이에요</p>}
      {/* 막다른 길을 만들지 않는다 — 로그인하지 않기로 한 사람도 나갈 곳이 있어야 한다. */}
      <button type="button" onClick={onBack} className="btn-text mt-3 text-white/60 underline underline-offset-[3px] hover:text-white">
        조건 다시 고르기
      </button>
    </dialog>
  );
}

/** 로그인 여부 확인 실패(useMember → false) 화면. 게이트가 아니다 — 회원일 수도 있으니 로그인을 시키지 않고 다시 묻는다. */
export function MemberCheckFailed() {
  return (
    <main className="mx-auto my-20 max-w-[560px] px-6 text-center">
      <h1 className="text-[22px] font-extrabold">로그인 상태를 확인하지 못했어요</h1>
      <p className="mt-3 text-muted">서버 응답이 늦거나 연결이 끊겼어요. 잠시 후 다시 시도해 주세요.</p>
      <button type="button" onClick={forgetMember} className="btn btn-dark mt-6">다시 시도</button>
    </main>
  );
}
