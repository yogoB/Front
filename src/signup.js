// 회원가입 화면 (Tana 스타일 벤치마킹). 비주얼 프로토타입 — 실제 가입은 account.html(BE 이메일 인증).
// ponytail: 목업 흐름(이름·이메일 → 비밀번호 → 코드 인증). 운영 연동 시 /auth/email/verification·/auth/signup으로 교체.
const $ = id => document.getElementById(id);
const boxes = [...document.querySelectorAll('.code-box')];
const titles = { info: '요고비 회원가입', password: '비밀번호 만들기', verify: '이메일 인증' };

function step(name) {
  document.querySelectorAll('[data-step]').forEach(s => { s.hidden = s.dataset.step !== name; });
  $('auth-title').textContent = titles[name];
  $('back').hidden = name === 'info';
  $('back').dataset.to = name === 'verify' ? 'password' : 'info';
}

/* 1. 이름 + 이메일 → 비밀번호 */
$('info-form').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('email').value.trim();
  if (!$('first').value.trim() || !$('last').value.trim()) { $('first').focus(); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('email').focus(); return; }
  $('email-ro').value = email;
  step('password');
  $('password').focus();
});
$('google').addEventListener('click', () => { location.href = './account.html'; }); // 실제 Google OAuth는 account.html

/* 2. 비밀번호 → 인증 */
$('pw-toggle').addEventListener('click', () => {
  const pw = $('password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
  $('pw-toggle').setAttribute('aria-label', pw.type === 'password' ? '비밀번호 표시' : '비밀번호 숨기기');
});
$('password-form').addEventListener('submit', e => {
  e.preventDefault();
  if ($('password').value.length < 8) { $('pw-hint').classList.add('error'); $('password').focus(); return; }
  $('pw-hint').classList.remove('error');
  $('verify-email').textContent = $('email-ro').value;
  step('verify');
  boxes[0].focus();
  startResend();
});

/* 3. 6자리 코드 */
boxes.forEach((box, i) => {
  box.addEventListener('input', () => {
    box.value = box.value.replace(/\D/g, '').slice(0, 1);
    if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
    if (boxes.every(b => b.value)) verify();
  });
  box.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
  });
  box.addEventListener('paste', e => {
    const digits = (e.clipboardData.getData('text').match(/\d/g) || []).slice(0, 6);
    if (!digits.length) return;
    e.preventDefault();
    digits.forEach((d, j) => { if (boxes[j]) boxes[j].value = d; });
    boxes[Math.min(digits.length, boxes.length - 1)].focus();
    if (boxes.every(b => b.value)) verify();
  });
});
function verify() {
  $('verify-status').hidden = false;
  boxes.forEach(b => { b.disabled = true; });
  setTimeout(() => location.assign('./'), 1400); // 데모: 가입 완료 → 홈
}

/* 재전송 카운트다운 */
let timer;
function startResend() {
  let n = 30;
  const btn = $('resend'), label = $('resend-count');
  btn.disabled = true; label.hidden = false; label.textContent = `(${n})`;
  clearInterval(timer);
  timer = setInterval(() => {
    n -= 1;
    if (n <= 0) { clearInterval(timer); btn.disabled = false; label.hidden = true; }
    else label.textContent = `(${n})`;
  }, 1000);
}
$('resend').addEventListener('click', () => { if (!$('resend').disabled) startResend(); });

/* 뒤로 */
$('back').addEventListener('click', () => step($('back').dataset.to || 'info'));

step('info');
