// 헤더 로그인 상태 전환. 실제 세션(GET /api/v1/me)으로 판단한다.
// 기본은 게스트(로그인 버튼)로 두고, 로그인 확인되면 회원(마이페이지·로그아웃)으로 바꾼다.
import { request } from './api.js';

const set = (auth, on) => document.querySelectorAll(`[data-auth="${auth}"]`).forEach(e => { e.hidden = !on; });

request('/api/v1/me', { member: true })
  .then(({ data }) => { set('member', true); set('guest', false); return data; })   // 로그인됨
  .catch(() => { set('guest', true); set('member', false); return null; })          // 미로그인/무세션
  .then(noteOAuthReturn);

/* Google 로그인 복귀 안내. BE 가 returnUrl + "#auth=success|failed|account-conflict" 로 돌려보낸다.
   닉네임은 서버가 자동 발급하므로(D-22) 무엇으로 정해졌는지 여기서 한 번 알려준다.
   안내 자리(#auth-note)가 있는 화면에서만 뜬다 — 없는 화면은 아무 일도 하지 않는다. */
function noteOAuthReturn(member) {
  const box = document.getElementById('auth-note');
  const state = new URLSearchParams(location.hash.slice(1)).get('auth');
  if (!box || !state) return;
  // success 로 돌아왔는데 세션이 안 잡혔으면(쿠키 차단 등) 로그인된 게 아니다 — 그렇게 적지 않는다.
  if (state === 'success' && !member) {
    box.textContent = '로그인은 됐지만 이 브라우저에 세션이 남지 않았어요. 쿠키를 허용한 뒤 다시 시도해 주세요.';
    box.className = 'auth-note auth-note-warn';
  } else if (state === 'success') {
    box.className = 'auth-note auth-note-ok';
    if (member?.nickname) {
      // 닉네임은 서버 문자열이므로 textContent 로만 넣는다. 링크는 우리가 만든 노드로 붙인다.
      const head = document.createTextNode(`로그인됐어요. 닉네임은 "${member.nickname}"으로 설정되었습니다. 변경은 `);
      const link = document.createElement('a');
      link.href = './mypage.html';
      link.className = 'auth-note-link';
      link.textContent = '마이페이지';
      box.replaceChildren(head, link, document.createTextNode('!'));
    } else {
      box.textContent = '로그인됐어요.';
    }
  } else if (state === 'account-conflict') {
    box.textContent = '같은 이메일의 계정이 있어요. 기존 방식으로 로그인한 뒤 Google 계정을 연결해 주세요.';
    box.className = 'auth-note auth-note-warn';
  } else {
    box.textContent = '로그인을 완료하지 못했어요. 다시 시도해 주세요.';
    box.className = 'auth-note auth-note-warn';
  }
  box.hidden = false;
  // 결과 화면의 비회원 게이트에서 출발했다면 그리로 돌려보낸다(Google 은 랜딩으로 복귀한다).
  // 목적지는 우리가 남긴 값만 쓴다 — 외부에서 넘긴 주소를 따라가지 않는다.
  const next = sessionStorage.getItem('yogobi:next');
  sessionStorage.removeItem('yogobi:next');
  if (member && ['results.html', 'calendar.html', 'mypage.html'].includes(next)) {
    location.replace(`./${next}`);
    return;
  }
  // 새로고침·뒤로가기에 같은 안내가 다시 뜨지 않게 흔적을 지운다(랜딩의 #modes 전환과도 섞이지 않는다).
  history.replaceState(null, '', location.pathname + location.search);
}

// 로그아웃: 실제 세션 종료 후 홈으로.
document.querySelectorAll('[data-logout]').forEach(btn => btn.addEventListener('click', async () => {
  btn.disabled = true;
  try { await request('/api/v1/auth/logout', { method: 'POST', member: true, body: {} }); }
  catch { /* 이미 만료됐어도 화면은 로그아웃 상태로 보낸다 */ }
  location.href = './';
}));
