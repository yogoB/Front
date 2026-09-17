import { forgetMember } from '../lib/useMember.js';
import { Header } from './Layout.jsx';

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
        <button type="button" onClick={onGoogle}
                className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl
                           border-0 bg-ink px-4 py-4 text-base font-bold text-white transition-colors duration-150 hover:bg-black">
          <GoogleMark />
          Google 로 계속하기
        </button>
        {/* 막다른 길을 만들지 않는다 — 로그인하지 않기로 한 사람도 나갈 곳이 있어야 한다. */}
        <button type="button" onClick={onBack} className="btn-text mt-4 underline underline-offset-[3px]">
          조건 다시 고르기
        </button>
      </main>
    </>
  );
}

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true" className="size-5 shrink-0 rounded-sm bg-white p-0.5">
    <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" />
    <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
    <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
  </svg>
);

/** 로그인 여부 확인 실패(useMember → false) 화면. 게이트가 아니다 — 회원일 수도 있으니 로그인을 시키지 않고 다시 묻는다. */
export function MemberCheckFailed() {
  return (
    <main className="mx-auto my-20 max-w-[560px] px-6 text-center">
      <h1 className="text-[22px] font-extrabold">로그인 상태를 확인하지 못했어요</h1>
      <p className="mt-3 text-muted">서버 응답이 늦거나 연결이 끊겼어요. 잠시 후 다시 시도해 주세요.</p>
      <button type="button" onClick={forgetMember} className="btn btn-brand mt-6">다시 시도</button>
    </main>
  );
}
