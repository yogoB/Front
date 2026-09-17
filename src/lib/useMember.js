import { useEffect, useState } from 'react';
import { request, onUnauthorized, ApiError } from './api.js';

/* 세션 확인은 화면당 한 번이 아니라 **탭당 한 번**이다.
   헤더·게이트·본문이 각자 부르면 같은 요청이 3~6번 나가고, BE 콜드스타트에서는 그게 15초씩이다.
   모듈 수준에서 약속 하나를 공유한다. */
let pending = null;
const listeners = new Set();
// 401 만 비회원이다. 타임아웃·콜드스타트·5xx 를 null 로 뭉개면 로그인한 사람에게 로그인 게이트가 뜬다(QA 2026-09-18).
const fetchMember = () => (pending ??= request('/api/v1/me', { member: true })
  .then(({ data }) => data)
  .catch(e => (e instanceof ApiError && e.status === 401 ? null : false)));

/** 캐시를 버리고 다시 확인한다. 떠 있는 화면(헤더·게이트)도 새 결과로 바뀐다 — 로그아웃·닉네임 변경·세션 만료. */
export function forgetMember() {
  pending = null;
  if (listeners.size) fetchMember().then(m => listeners.forEach(l => l(m)));
}

// 회원 호출이 401 을 받으면 세션이 죽은 것이다. /me 자체의 401 은 이미 답(비회원)이라 다시 묻지 않는다.
onUnauthorized(path => { if (path !== '/api/v1/me') forgetMember(); });

/**
 * 로그인 여부와 회원 정보. 상태는 넷이다 — 확인 중(undefined) / 비회원(null) / 확인 실패(false) / 회원(객체).
 * "확인 중"을 비회원과 섞으면 새로고침마다 로그인 버튼이 깜빡이고, "확인 실패"를 비회원과 섞으면 회원에게 게이트가 뜬다.
 */
export function useMember() {
  const [member, setMember] = useState(undefined);
  useEffect(() => {
    listeners.add(setMember);
    fetchMember().then(setMember);
    return () => { listeners.delete(setMember); };
  }, []);
  return member;
}
