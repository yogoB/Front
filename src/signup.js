// 회원가입. 메일 설정이 없어도 바로 가입한다(D-19) — 이름·이메일·비밀번호·닉네임만 받는다.
// 이메일 소유는 확인하지 않는다. BE 가 메일 기능을 켜면 그쪽에서 토큰 흐름을 요구하며 400을 준다.
import { request, backendUrl, ApiError } from './api.js';

const $ = id => document.getElementById(id);
const titles = { info: '요고비 회원가입', password: '비밀번호 만들기' };

function step(name) {
  document.querySelectorAll('[data-step]').forEach(s => { s.hidden = s.dataset.step !== name; });
  $('auth-title').textContent = titles[name];
  $('back').hidden = name === 'info';
}

/* 1. 이름·이메일·닉네임 */
$('info-form').addEventListener('submit', event => {
  event.preventDefault();
  const email = $('email').value.trim();
  if (!$('name').value.trim()) { $('name').focus(); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('email').focus(); return; }
  if (!$('nickname').value.trim()) { $('nickname').focus(); return; }
  $('password-email').textContent = email;
  step('password');
  $('password').focus();
});

$('google').addEventListener('click', () => { location.href = backendUrl('/oauth2/authorization/google'); });
$('back').addEventListener('click', () => { step('info'); $('email').focus(); });

/* 2. 비밀번호 → 가입. 서버가 이메일·닉네임 중복을 구분해 알려준다. */
$('password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('password-form').querySelector('button[type="submit"]');
  // 서버도 15자를 요구한다. 여기서 먼저 걸러 왕복을 아낀다.
  if ([...$('password').value].length < 15) {
    $('pw-hint').classList.add('error');
    $('password').focus();
    return;
  }
  $('pw-hint').classList.remove('error');
  $('signup-error').hidden = true;
  $('verify-status').hidden = false;
  button.disabled = true;
  try {
    await request('/api/v1/auth/signup', {
      method: 'POST', member: true,
      body: {
        name: $('name').value.trim(),
        email: $('password-email').textContent,
        password: $('password').value,
        nickname: $('nickname').value.trim(),
      },
    });
    location.assign('./account.html');            // 가입과 동시에 로그인 상태다
  } catch (error) {
    $('verify-status').hidden = true;
    button.disabled = false;
    $('signup-error').textContent = error instanceof ApiError
      ? error.message : '가입하지 못했어요. 잠시 후 다시 시도해 주세요.';
    $('signup-error').hidden = false;
    // 중복이면 고쳐야 할 칸으로 보낸다.
    if (error.field === 'email' || error.field === 'nickname') { step('info'); $(error.field).focus(); }
  }
});
