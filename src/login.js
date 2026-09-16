// 로그인 화면. 가입·로그인이 같은 버튼이다(D-34) — Google `sub` 가 있으면 로그인, 없으면 가입이다.
// 로그인 뒤 돌아갈 곳은 header-auth.js 가 `yogobi:next` 를 보고 처리한다(Google 은 랜딩으로 복귀한다).
import { backendUrl } from './api.js';

const $ = id => document.getElementById(id);

$('google').addEventListener('click', () => {
  // BE 가 Google 을 켜지 않았으면 그쪽에서 오류를 보여준다. 프론트가 성공한 척하지 않는다.
  document.querySelectorAll('[data-step]').forEach(s => { s.hidden = s.dataset.step !== 'redirect'; });
  location.href = backendUrl('/oauth2/authorization/google');
});
