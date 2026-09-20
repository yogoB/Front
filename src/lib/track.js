import { request } from './api.js';

/** 보고서 §9.4 이벤트 중 **화면만 아는 것**을 보낸다 — 입력 시작·완료 둘뿐이다.
    결과·캘린더·저장은 서버가 스스로 세므로 보내지 않는다(보낼 수 있게 두면 누구나 조회 수를 부풀릴 수 있다).
    session:true — 쿠키를 실어 회원은 회원으로 세게 한다(CSRF 면제 경로라 토큰 왕복은 없다).
    실패는 삼킨다. 지표 때문에 입력 화면이 멈추면 안 된다(BE FunnelCounter 와 같은 원칙). */
export const track = kind => {
  request('/api/v1/events', { method: 'POST', session: true, body: { kind } }).catch(() => {});
};
