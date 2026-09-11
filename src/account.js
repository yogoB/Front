import { request, backendUrl } from './api.js';
import { validPassword } from './model.js';

const $ = id => document.getElementById(id);
const fragment = new URLSearchParams(location.hash.slice(1));
const action = fragment.get('action');
let proof = fragment.get('token');
history.replaceState(null, '', location.pathname); // Keep email proof out of history and persistent storage.
let member, busy = false;
const show = message => { $('message').textContent = message; };
const api = async (path, method = 'GET', body) => (await request(path, { method, body, member: true })).data;
const googleUrl = backendUrl('/oauth2/authorization/google');
$('google-login').href = googleUrl;

async function run(callback) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try { await callback(); }
  catch (error) {
    if (error.status === 401) { member = null; showMember(); }
    if (error.code === 'YGB-AUTH-LINK') {
      proof = null; $('confirm-form').reset(); $('confirmation').hidden = true;
      $('mail-action').value = action === 'reset' ? 'reset-request' : 'verification';
      $('mail-section').hidden = false;
    }
    show(error.message);
  } finally {
    busy = false;
    document.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}
function handle(id, callback) {
  $(id).addEventListener('submit', event => { event.preventDefault(); run(callback); });
}
function showMember() {
  $('member').hidden = !member; $('login-section').hidden = Boolean(member); $('mail-section').hidden = Boolean(member);
  $('sessions').replaceChildren();
  if (!member) { $('member-email').textContent = ''; $('link-password').value = ''; return; }
  $('member-email').textContent = member.email;
  $('link-form').hidden = member.localLogin && member.googleLogin;
  $('link-label').textContent = member.localLogin ? '현재 비밀번호 재확인' : '추가할 새 비밀번호';
  $('link-password').autocomplete = member.localLogin ? 'current-password' : 'new-password';
  $('link-button').textContent = member.localLogin ? 'Google 계정 연결' : '자체 비밀번호 추가';
}
async function refresh() {
  try { member = await api('/api/v1/me'); }
  catch (error) {
    if (error.status !== 401) throw error;
    member = null;
  }
  showMember();
  if (!member) return;
  const sessions = await api('/api/v1/me/sessions');
  for (const session of sessions) {
    const item = document.createElement('li');
    item.textContent = `${session.current ? '현재 브라우저 · ' : ''}${session.userAgent || '브라우저 정보 없음'} · ${new Date(session.createdAt).toLocaleString('ko-KR')} 로그인`;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '이 로그인 종료';
    button.addEventListener('click', () => run(async () => {
      await api(`/api/v1/me/sessions/${encodeURIComponent(session.id)}`, 'DELETE');
      await refresh(); show('로그인을 종료했습니다.');
    }));
    item.append(button); $('sessions').append(item);
  }
}
if (proof && (action === 'signup' || action === 'reset')) {
  $('confirmation').hidden = false;
  $('confirmation-title').textContent = action === 'signup' ? '이메일 확인 · 가입 완료' : '비밀번호 재설정';
} else {
  proof = null;
  if (fragment.get('auth') === 'success') show('로그인 또는 계정 연결이 완료되었습니다.');
  else if (fragment.get('auth') === 'account-conflict') show('같은 이메일의 계정이 있어요. 기존 방식으로 로그인한 뒤 Google 계정을 연결해 주세요.');
  else if (fragment.has('auth')) show('로그인을 완료하지 못했어요. 다시 시도해 주세요.');
}
handle('confirm-form', async () => {
  const password = $('new-password').value; validPassword(password);
  if (password !== $('confirm-password').value) throw new Error('두 비밀번호가 일치하지 않습니다.');
  if (!proof) throw new Error('본인 확인 메일을 다시 요청해 주세요.');
  await api(action === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/password/reset', 'POST', { token: proof, password });
  proof = null; $('confirm-form').reset(); $('confirmation').hidden = true;
  show(action === 'signup' ? '가입이 완료되었습니다.' : '비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.');
  await refresh();
});
handle('login-form', async () => {
  try { await api('/api/v1/auth/login', 'POST', { email: $('email').value, password: $('password').value }); }
  finally { $('password').value = ''; }
  show('로그인했습니다.'); await refresh();
});
handle('mail-form', async () => {
  const path = $('mail-action').value === 'verification' ? '/api/v1/auth/email/verification' : '/api/v1/auth/password/reset-request';
  const result = await api(path, 'POST', { email: $('mail-email').value }); show(result.message);
});
handle('link-form', async () => {
  const password = $('link-password').value;
  if (!member.localLogin) validPassword(password);
  let result;
  try { result = await api(member.localLogin ? '/api/v1/auth/google/link' : '/api/v1/auth/password', 'POST', { password }); }
  finally { $('link-password').value = ''; }
  if (result.authorizationUrl !== '/oauth2/authorization/google') throw new Error('연결을 시작하지 못했습니다.');
  location.assign(googleUrl);
});
for (const id of ['logout', 'logout-all']) $(id).addEventListener('click', () => run(async () => {
  await api(`/api/v1/auth/${id}`, 'POST', {}); member = null; showMember();
  show('로그아웃했습니다.');
}));
$('refresh-account').addEventListener('click', () => run(async () => { await refresh(); show(member ? '계정 상태를 갱신했습니다.' : '로그인이 필요합니다.'); }));
run(refresh);
