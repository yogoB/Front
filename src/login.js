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

/* 복구 코드로 비밀번호 재설정 (메일이 없으므로 유일한 자기복구 경로) */
$('to-recover').addEventListener('click', () => {
  $('recover-email').textContent = $('login-email').textContent;
  $('recover-error').hidden = true;
  step('recover');
  $('recover-code').focus();
});
$('recover-back').addEventListener('click', () => { step('password'); $('password').focus(); });

$('recover-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('recover-form').querySelector('button[type="submit"]');
  $('recover-error').hidden = true;
  $('recover-status').hidden = false;
  button.disabled = true;
  try {
    const { data } = await request('/api/v1/auth/password/recover', {
      method: 'POST', member: true,
      body: {
        email: $('recover-email').textContent,
        recoveryCode: $('recover-code').value.trim(),
        newPassword: $('recover-password').value,
      },
    });
    // 코드는 1회용이라 서버가 새 코드를 준다. 놓치면 다음 복구 수단이 없으므로 화면에 남긴다.
    $('new-recovery-code').textContent = data.recoveryCode ?? '—';
    $('recover-status').hidden = true;
    step('recovered');
  } catch (error) {
    $('recover-status').hidden = true;
    button.disabled = false;
    $('recover-error').textContent = error instanceof ApiError
      ? error.message : '재설정하지 못했어요. 코드를 다시 확인해 주세요.';
    $('recover-error').hidden = false;
  }
});

$('new-recovery-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('new-recovery-code').textContent);
    $('new-recovery-status').textContent = '복사했어요.';
  } catch {
    $('new-recovery-status').textContent = '복사하지 못했어요. 코드를 직접 적어 주세요.';
  }
});
$('new-recovery-done').addEventListener('click', () => { location.assign('./account.html'); });
