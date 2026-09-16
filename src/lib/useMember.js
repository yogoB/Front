import { useEffect, useState } from 'react';
import { request } from './api.js';

/**
 * 로그인 여부와 회원 정보. 헤더·게이트·마이페이지가 같은 판정을 쓴다.
 * 상태는 셋이다 — 확인 중(undefined) / 비회원(null) / 회원(객체).
 * "확인 중"을 비회원과 섞으면 새로고침마다 로그인 버튼이 깜빡인다.
 */
export function useMember() {
  const [member, setMember] = useState(undefined);
  useEffect(() => {
    let alive = true;
    request('/api/v1/me', { member: true })
      .then(({ data }) => { if (alive) setMember(data); })
      .catch(() => { if (alive) setMember(null); });
    return () => { alive = false; };
  }, []);
  return member;
}
