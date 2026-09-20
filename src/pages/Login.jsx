import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';
import GoogleConsent from '../components/GoogleConsent.jsx';
import { backendUrl } from '../lib/api.js';
import { useMember } from '../lib/useMember.js';
import { takeNext } from '../lib/session.js';

/* D-34: 가입·로그인은 Google 버튼 하나다. 이메일·비밀번호·복구 코드 단계는 없앴고,
   가입 화면도 따로 없다 — 가입과 로그인이 같은 버튼이다.
   시안: "YogoB" 한 줄, 왼쪽 정렬 작은 라벨, 검은 Google 버튼. 시안의 이메일 입력은 넣지 않는다(BE 에 없다). */
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
      <main className="mx-auto max-w-[400px] px-6 pb-20 pt-32 text-center">
        <h1 className="mb-10 text-[28px] font-extrabold tracking-[-.01em]">YogoB</h1>
        <span className="mb-4 block text-left text-xs font-semibold text-ink-soft">Login</span>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          처음이면 그대로 가입됩니다. 가입과 로그인이 같은 버튼이에요.<br />
          결과 리포트와 전환 일정은 로그인한 뒤에 볼 수 있어요.
        </p>
        <GoogleConsent onContinue={() => { location.href = backendUrl('/oauth2/authorization/google'); }} />
      </main>
    </>
  );
}
