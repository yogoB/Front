import { Header } from './Layout.jsx';

/* 비회원 화면. 리포트 대신 이것 하나만 그린다(ux-flow D-36, 사용자 결정 2026-09-17).
   **금액은 한 줄도 비치지 않는다** — 그래서 결과를 아예 계산하지 않고 이 화면으로 끝낸다.
   입력값은 sessionStorage 에 남아 로그인 뒤 같은 자리에서 이어진다.
   화면 게이트일 뿐 API 는 공개다 — CBT 이탈율을 보고 되돌릴 수 있게 그렇게 둔다. */
export default function GuestGate({ onGoogle, onBack }) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[460px] px-6 pb-24 pt-[72px] text-center">
        <p className="mb-4.5 text-[52px]" aria-hidden="true">🔒</p>
        <h1 className="text-[26px] font-extrabold tracking-[-.01em]">분석이 끝났어요!</h1>
        <p className="my-3.5 mb-7 text-[15px] leading-[1.7] text-ink-soft">
          결과 리포트는 로그인한 뒤에 볼 수 있어요.<br />
          지금까지 답하신 내용은 그대로 남아 있어요.
        </p>
        <button type="button" onClick={onGoogle}
                className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl
                           border-0 bg-ink px-4 py-[17px] text-base font-bold text-white hover:bg-black">
          <GoogleMark />
          Google 로 계속하기
        </button>
        {/* 막다른 길을 만들지 않는다 — 로그인하지 않기로 한 사람도 나갈 곳이 있어야 한다. */}
        <button type="button" onClick={onBack}
                className="mt-4 cursor-pointer border-0 bg-transparent text-sm text-muted underline underline-offset-[3px] hover:text-ink-soft">
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
