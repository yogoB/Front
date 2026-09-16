// 로그인 화면. 실제 BE 인증(POST /api/v1/auth/login)에 연결한다 — 쿠키 인증이라 credentials·CSRF 가 필요하다.
// 가입·비밀번호 재설정은 메일 토큰 흐름이라 account.html 이 담당한다.
import { request, backendUrl, ApiError } from './api.js';

const $ = id => document.getElementById(id);
const step = name => document.querySelectorAll('[data-step]').forEach(s => { s.hidden = s.dataset.step !== name; });

/* 1. 이메일 → 비밀번호 단계 (BE 는 이메일만으로 계정 존재를 알려주지 않는다) */
$('email-form').addEventListener('submit', event => {
  event.preventDefault();
  const email = $('email').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('email').focus(); return; }
  $('login-email').textContent = email;
  step('password');
  $('password').focus();
});

$('google').addEventListener('click', () => {
  // BE 가 Google 을 켜지 않았으면 그쪽에서 오류를 보여준다. 프론트가 성공한 척하지 않는다.
  location.href = backendUrl('/oauth2/authorization/google');
});

$('code-back').addEventListener('click', () => {
  $('password').value = '';
  $('login-error').hidden = true;
  step('email');
  $('email').focus();
});

/* 2. 실제 로그인 */
$('password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('password-form').querySelector('button[type="submit"]');
  $('login-error').hidden = true;
  $('verify-status').hidden = false;
  button.disabled = true;
  try {
    await request('/api/v1/auth/login', {
      method: 'POST', member: true,
      body: { email: $('login-email').textContent, password: $('password').value },
    });
    step('redirect');
    location.assign('./account.html');
  } catch (error) {
    $('verify-status').hidden = true;
    button.disabled = false;
    $('login-error').textContent = error instanceof ApiError
      ? error.message : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.';
    $('login-error').hidden = false;
    $('password').focus();
  }
});
