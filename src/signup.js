// 회원가입 화면. BE 는 본인 확인 메일의 링크 토큰으로 가입을 끝낸다(10분·단일 사용).
// 이 화면은 메일 발송까지 하고, 비밀번호 설정·가입 완료는 링크가 여는 account.html 이 처리한다.
// 메일이 꺼져 있으면(AUTH_EMAIL_ENABLED=false) 서버가 503 을 주며, 그 오류를 그대로 보여준다.
import { request, backendUrl, ApiError } from './api.js';

const $ = id => document.getElementById(id);
const titles = { info: '요고비 회원가입', verify: '메일함을 확인해 주세요' };

function step(name) {
  document.querySelectorAll('[data-step]').forEach(s => { s.hidden = s.dataset.step !== name; });
  $('auth-title').textContent = titles[name];
  $('back').hidden = name === 'info';
}

$('info-form').addEventListener('submit', event => {
  event.preventDefault();
  const email = $('email').value.trim();
  if (!$('name').value.trim()) { $('name').focus(); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('email').focus(); return; }
  if (!$('nickname').value.trim()) { $('nickname').focus(); return; }
  $('verify-email').textContent = email;
  step('verify');
  sendVerification();
});

$('google').addEventListener('click', () => { location.href = backendUrl('/oauth2/authorization/google'); });
$('back').addEventListener('click', () => { step('info'); $('email').focus(); });
$('resend').addEventListener('click', sendVerification);

/** 본인 확인 메일 발송. 계정 존재 여부는 응답으로 알려주지 않는다(BE 가 같은 응답을 준다). */
async function sendVerification() {
  const resend = $('resend');
  $('signup-error').hidden = true;
  $('verify-status').hidden = false;
  resend.disabled = true;
  try {
    await request('/api/v1/auth/email/verification', {
      method: 'POST', member: true, body: { email: $('verify-email').textContent },
    });
    $('verify-status').hidden = true;
  } catch (error) {
    $('verify-status').hidden = true;
    $('signup-error').textContent = error instanceof ApiError
      ? error.message : '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.';
    $('signup-error').hidden = false;
  } finally {
    resend.disabled = false;
  }
}
