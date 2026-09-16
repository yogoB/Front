// 로그인 화면 (v0 스타일 벤치마킹). 비주얼 프로토타입 — 실제 이메일/비밀번호·Google 인증은 account.html(BE 연동).
// ponytail: 목업 흐름(이메일 → 코드 → 확인 → 이동). 운영 연동 시 이메일 단계는 /auth/login 또는 코드 발송으로 교체.
const $ = id => document.getElementById(id);
const step = name => document.querySelectorAll('[data-step]').forEach(s => { s.hidden = s.dataset.step !== name; });
const boxes = [...document.querySelectorAll('.code-box')];

/* 1. 이메일 → 코드 단계 */
$('email-form').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('email').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('email').focus(); return; }
  $('code-email').textContent = email;
  step('code');
  boxes[0].focus();
});
$('google').addEventListener('click', () => {
  // 실제 Google OAuth는 account.html에서 BE의 /oauth2/authorization/google로 진행한다.
  step('redirect');
  setTimeout(() => { location.href = './account.html'; }, 1200);
});
$('code-back').addEventListener('click', () => {
  boxes.forEach(b => { b.value = ''; });
  $('verify-status').hidden = true; $('code-warn').hidden = true;
  step('email'); $('email').focus();
});

/* 2. 6자리 코드 입력 UX */
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

/* 3. 확인 중 → 이동 */
function verify() {
  $('code-warn').hidden = true;
  $('verify-status').hidden = false;
  boxes.forEach(b => { b.disabled = true; });
  // 데모: 실제로는 코드 검증 응답을 기다린다. 미가입 경고 예시도 함께 보여준다.
  setTimeout(() => { $('code-warn').hidden = false; }, 700);
  setTimeout(() => { step('redirect'); location.assign('./'); }, 1600);
}
