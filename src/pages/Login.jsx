import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';
import { backendUrl } from '../lib/api.js';
import { useMember } from '../lib/useMember.js';
import { takeNext } from '../lib/session.js';

/* D-34: 가입·로그인은 Google 버튼 하나다. 이메일·비밀번호·복구 코드 단계는 없앴고,
   가입 화면도 따로 없다 — 가입과 로그인이 같은 버튼이다. */
export default function Login() {
  const member = useMember();
  const navigate = useNavigate();

  // 이미 로그인한 사람이 이 화면에 오면 붙잡지 않는다.
  useEffect(() => {
    if (member) navigate(takeNext() ?? '/mypage', { replace: true });
  }, [member, navigate]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[400px] px-6 pb-20 pt-11 text-center">
        <div className="mx-auto mb-5 mt-2 grid size-16 place-items-center rounded-full bg-brand text-[26px] font-extrabold text-white">
          요
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-.01em]">요고비 시작하기</h1>
        <p className="my-2.5 mb-6 leading-relaxed text-muted">
          추천과 계산은 로그인 없이도 이용할 수 있어요.<br />
          결과 리포트와 전환 일정은 로그인한 뒤에 볼 수 있어요.
        </p>
        <button type="button" onClick={() => { location.href = backendUrl('/oauth2/authorization/google'); }}
                className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-line
                           bg-white px-4 py-[15px] font-semibold text-ink hover:bg-bg-soft">
          <GoogleMark />
          Google 로 계속하기
        </button>
        <p className="mx-auto mt-8 max-w-[340px] text-xs leading-relaxed text-muted">
          계속하면 <Link to="/terms" className="underline underline-offset-2">이용약관</Link>과{' '}
          <Link to="/privacy" className="underline underline-offset-2">개인정보처리방침</Link>에 동의하는 것으로 봅니다.
        </p>
      </main>
    </>
  );
}

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true" className="size-[18px] shrink-0">
    <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" />
    <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
    <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
  </svg>
);
