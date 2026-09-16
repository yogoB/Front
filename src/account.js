import { request, backendUrl } from './api.js';

const $ = id => document.getElementById(id);
const fragment = new URLSearchParams(location.hash.slice(1));
history.replaceState(null, '', location.pathname);
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
    show(error.message);
  } finally {
    busy = false;
    document.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}
function showMember() {
  $('member').hidden = !member; $('login-section').hidden = Boolean(member);
  $('signup-hint').hidden = Boolean(member);
  $('sessions').replaceChildren();
  if (!member) { $('member-email').textContent = ''; return; }
  $('member-email').textContent = member.email;
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
if (fragment.get('auth') === 'success') show('로그인했습니다.');
else if (fragment.get('auth') === 'account-conflict') show('같은 이메일로 만든 다른 Google 계정이 이미 있어요. 처음 가입할 때 쓴 계정으로 로그인해 주세요.');
else if (fragment.has('auth')) show('로그인을 완료하지 못했어요. 다시 시도해 주세요.');
for (const id of ['logout', 'logout-all']) $(id).addEventListener('click', () => run(async () => {
  await api(`/api/v1/auth/${id}`, 'POST', {}); member = null; showMember();
  show('로그아웃했습니다.');
}));
$('refresh-account').addEventListener('click', () => run(async () => { await refresh(); show(member ? '계정 상태를 갱신했습니다.' : '로그인이 필요합니다.'); }));
run(refresh);
