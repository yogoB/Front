import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMember } from '../lib/useMember.js';
import { takeNext } from '../lib/session.js';

/* Google 로그인 복귀 처리. BE 는 returnUrl + "#auth=success|failed|account-conflict" 로 돌려보낸다
   (GoogleLogin.java). 복귀 지점은 랜딩 하나뿐이라 여기서 받는다.

   이 화면이 없으면 게이트에서 출발한 사람이 로그인 뒤 랜딩에 멈춘다 — "같은 자리에서 이어진다"가 깨진다.
   목적지는 우리가 남긴 값(yogobi:next)만 쓴다. URL 파라미터로 받으면 외부에서 넘긴 주소로 튕겨 보내는
   통로가 된다. */
export default function AuthReturn() {
  const member = useMember();
  const navigate = useNavigate();
  const [state] = useState(() => new URLSearchParams(location.hash.slice(1)).get('auth'));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!state || member === undefined) return;

    // success 로 돌아왔는데 세션이 안 잡혔으면 로그인된 게 아니다 — 그렇게 적지 않는다.
    if (state === 'success' && !member) {
      setNote(member === null
        ? '로그인은 됐지만 이 브라우저에 세션이 남지 않았어요. 쿠키를 허용한 뒤 다시 시도해 주세요.'
        : '로그인 상태를 확인하지 못했어요. 잠시 후 새로고침해 주세요.');
    } else if (state === 'success') {
      const next = takeNext();
      if (next) { navigate(next, { replace: true }); return; }
      setNote(member.nickname
        ? `로그인됐어요. 닉네임은 "${member.nickname}"으로 설정되었습니다.`
        : '로그인됐어요.');
    } else if (state === 'account-conflict') {
      setNote('같은 이메일의 계정이 있어요. 기존 방식으로 로그인한 뒤 Google 계정을 연결해 주세요.');
    } else {
      setNote('로그인을 완료하지 못했어요. 다시 시도해 주세요.');
    }
    // 새로고침·뒤로가기에 같은 안내가 다시 뜨지 않게 흔적을 지운다.
    history.replaceState(null, '', location.pathname + location.search);
  }, [state, member, navigate]);

  if (!note) return null;
  const bad = state !== 'success';
  return (
    <p role="status" aria-live="polite"
       className={`mx-auto mt-3 w-full max-w-page rounded-xl px-4.5 py-3 text-sm font-semibold
         ${bad ? 'bg-warn-tint text-warn-ink' : 'bg-bg-soft text-ink'}`}>
      {note}
      {!bad && <> 변경은 <a href="/mypage" className="font-bold underline underline-offset-[3px]">마이페이지</a>!</>}
    </p>
  );
}
