// 마이페이지. 회원 이메일은 실제 GET /api/v1/me 로 채우되, 미로그인/무BE 면 데모로 폴백한다.
// 리포트 아카이브와 Google 캘린더 연동은 아직 대응 BE 가 없어 프로토타입(데모)이다.
import { request } from './api.js';

const $ = id => document.getElementById(id);
const won = n => `${n.toLocaleString('ko-KR')}원`;
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* 회원 정보: /me 로 이메일만 실제 반영(이름·닉네임은 BE 미제공이라 데모 유지) */
request('/api/v1/me', { member: true })
  .then(({ data }) => {
    if (data?.email) {
      $('pc-email').textContent = data.email;
      $('pc-nick').textContent = '@' + data.email.split('@')[0];
    }
  })
  .catch(() => { /* 미로그인/무BE → 데모 유지 */ });

/* 분석 리포트 아카이브 (데모). 운영: 회원별 저장 리포트 목록 API 필요(BE 신설). */
const REPORTS = [
  { date: '2026.09.16', mode: 'light', save: 8100, plan: 'KT 다이렉트 5G (30GB)', keep: 3 },
  { date: '2026.09.10', mode: 'detail', save: 12400, plan: 'SKT 0 청년 요금제', keep: 2 },
  { date: '2026.08.28', mode: 'light', save: 5500, plan: 'LG U+ 유쓰 요금제', keep: 4 },
];
function renderReports() {
  const cards = REPORTS.map(r => {
    const card = el('article', 'report-card');
    const top = el('div', 'rc-top');
    top.append(el('span', 'rc-date', r.date), el('span', `rc-mode ${r.mode}`, r.mode === 'light' ? '라이트' : '디테일'));
    const foot = el('div', 'rc-foot');
    const open = el('a', 'rc-open', '리포트 열기 →'); open.href = './results.html';
    foot.append(el('span', undefined, `구독 ${r.keep}개 유지`), open);
    card.append(top, el('div', 'rc-save', `월 ${won(r.save)} 절감`), el('div', 'rc-plan', r.plan), foot);
    return card;
  });
  const add = el('a', 'report-card new'); add.href = './#modes';
  add.append(el('span', 'rc-plus', '+'), el('span', undefined, '새 분석 시작'));
  $('report-grid').replaceChildren(...cards, add);
  $('report-count').textContent = `${REPORTS.length}개`;
}

/* Google 캘린더 연동 (데모). 실제 OAuth·이벤트 등록은 BE·Google 연동 필요. */
const GKEY = 'yogobi:gcal';
const SYNCS = ['구독 결제일 자동 등록', '요금·약정 변경 알림', '절감 리마인더'];
function renderGcal() {
  const on = localStorage.getItem(GKEY) === '1';
  const card = $('gcal-card');
  const head = el('div', 'gcal-head');
  head.append(el('span', 'gcal-ico', '📅'), el('h3', undefined, on ? 'Google 캘린더' : 'Google 캘린더 연동'));
  if (on) head.append(el('span', 'gcal-on', '연동됨'));
  card.replaceChildren(head);

  if (!on) {
    card.append(el('p', undefined, '구독 결제일과 요고비 알림을 내 캘린더에서 한눈에 관리하세요.'));
    const btn = el('button', 'btn btn-brand btn-block', 'Google 캘린더 연동하기'); btn.type = 'button';
    btn.addEventListener('click', () => { localStorage.setItem(GKEY, '1'); renderGcal(); });
    card.append(btn, el('p', 'hint', '원하는 분만 연동해요. 언제든 해제할 수 있어요.'));
  } else {
    card.append(el('p', undefined, '이 항목을 내 Google 캘린더에 등록·알림으로 받아요.'));
    const list = el('ul', 'gcal-syncs');
    SYNCS.forEach((label, i) => {
      const li = el('li'); const id = `sync-${i}`;
      const lab = el('label', undefined, label); lab.htmlFor = id;
      const cb = el('input'); cb.type = 'checkbox'; cb.id = id; cb.checked = true;
      li.append(lab, cb); list.append(li);
    });
    const off = el('button', 'btn btn-ghost btn-block', '연동 해제'); off.type = 'button';
    off.addEventListener('click', () => { localStorage.removeItem(GKEY); renderGcal(); });
    card.append(list, off, el('p', 'hint', '데모예요. 실제 Google 캘린더 연동은 준비 중이에요.'));
  }
}

renderReports();
renderGcal();
