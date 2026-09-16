import { useEffect, useState } from 'react';
import { request } from './api.js';

/* 세션 확인은 화면당 한 번이 아니라 **탭당 한 번**이다.
   헤더·게이트·본문이 각자 부르면 같은 요청이 3~6번 나가고, BE 콜드스타트에서는 그게 15초씩이다.
   모듈 수준에서 약속 하나를 공유한다. */
let pending = null;
const fetchMember = () => (pending ??= request('/api/v1/me', { member: true })
  .then(({ data }) => data)
  .catch(() => null));

/** 로그인 뒤 다시 확인해야 할 때만 쓴다(로그아웃·닉네임 변경 등). */
export const forgetMember = () => { pending = null; };

/**
 * 로그인 여부와 회원 정보. 상태는 셋이다 — 확인 중(undefined) / 비회원(null) / 회원(객체).
 * "확인 중"을 비회원과 섞으면 새로고침마다 로그인 버튼이 깜빡인다.
 */
export function useMember() {
  const [member, setMember] = useState(undefined);
  useEffect(() => {
    let alive = true;
    fetchMember().then(m => { if (alive) setMember(m); });
    return () => { alive = false; };
  }, []);
  return member;
}
