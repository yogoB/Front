// 헤더 로그인 상태 전환. 실제 세션(GET /api/v1/me)으로 판단한다.
// 기본은 게스트(로그인 버튼)로 두고, 로그인 확인되면 회원(마이페이지·로그아웃)으로 바꾼다.
import { request } from './api.js';

const set = (auth, on) => document.querySelectorAll(`[data-auth="${auth}"]`).forEach(e => { e.hidden = !on; });

request('/api/v1/me', { member: true })
  .then(() => { set('member', true); set('guest', false); })   // 로그인됨
  .catch(() => { set('guest', true); set('member', false); });  // 미로그인/무세션

// 로그아웃: 실제 세션 종료 후 홈으로.
document.querySelectorAll('[data-logout]').forEach(btn => btn.addEventListener('click', async () => {
  btn.disabled = true;
  try { await request('/api/v1/auth/logout', { method: 'POST', member: true, body: {} }); }
  catch { /* 이미 만료됐어도 화면은 로그아웃 상태로 보낸다 */ }
  location.href = './';
}));
