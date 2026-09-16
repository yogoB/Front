// 전환 액션 캘린더. 금액·요금제명은 결과 화면이 BE 응답에서 넘긴 값을 그대로 쓴다(같은 숫자는 같은 출처).
// 캘린더 담기는 **링크 방식**이다 — Google 캘린더의 일정 추가 화면을 열거나 .ics 를 내려준다.
// 사용자의 캘린더를 서버가 대신 쓰지 않으므로 OAuth 권한도 토큰 보관도 없다.
// **회원 전용**: 로그인해야 담기가 열린다(GET /api/v1/me 로 판단).
// 일정 날짜의 기준(anchor)은 세 가지 중 하나다 — 화면에도 무엇을 썼는지 적는다:
//   ① 약정 만료일  사용자가 디테일 모드에서 입력한 날. 서버는 이 날짜를 모른다(입력값이 유일한 소스).
//   ② 오늘          약정이 없거나 이미 지났을 때.
//   ③ 서버 판정     회원 + 현재 요금제 저장 시 /me/switch-timing 이 SWITCH_NOW / WAIT_UNTIL_EXPIRY 를 준다.
//                   WAIT 면 만료일을, SWITCH_NOW 면 오늘을 기준으로 삼는다. 실패해도 ①②로 동작한다.
import { request } from './api.js';

const $ = id => document.getElementById(id);
const won = n => `₩${n.toLocaleString('ko-KR')}`;
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const STEP_COLORS = ['#4f6bed', '#22c55e', '#a855f7', '#0ea5a3'];
const STEPS = [
  { when: '준비', title: '통신사 변경 준비', desc: '약정일·해지조건·명의서류를 체크합니다.' },
  { when: '가입', title: '추천 요금제 가입', desc: '통신사 공식 채널에서 번호이동 가입을 진행합니다.' },
  { when: '구독 정리', title: '구독 및 요금제 확인', desc: '가입 후 기존 구독을 해지·연동합니다.' },
  { when: '완료', title: '최종 납부액 체크', desc: '첫 청구서에서 정상 할인을 검증합니다.' },
];
// 오늘 기준(약정 없음/이미 만료): 지금부터 순서대로 진행한다.
const EVENTS_FROM_TODAY = [
  { offset: 0, label: '전환 준비 시작', step: 0 },
  { offset: 3, label: '명의확인 서류 준비', step: 0 },
  { offset: 8, label: '구독 결제일 확인', step: 2 },
  { offset: 14, label: '추천 요금제 가입 진행', step: 1 },
  { offset: 21, label: '첫 청구서 확인', step: 3 },
];
// 약정 만료일 기준: 만료 전에 준비를 끝내고 만료 당일에 옮긴다(위약금 없이).
const EVENTS_FROM_EXPIRY = [
  { offset: -14, label: '전환 준비 시작', step: 0 },
  { offset: -7, label: '명의확인 서류 준비', step: 0 },
  { offset: -3, label: '구독 결제일 확인', step: 2 },
  { offset: 0, label: '약정 만료 · 추천 요금제 가입', step: 1 },
  { offset: 30, label: '첫 청구서 확인', step: 3 },
];
let EVENTS = EVENTS_FROM_TODAY;

/* 금액 + 가이드 */
const result = JSON.parse(sessionStorage.getItem('yogobi:result') || 'null');
const input = JSON.parse(sessionStorage.getItem('yogobi:input') || 'null');
if (!result) {
  // 결과 화면을 거치지 않으면 보여줄 금액이 없다. 지어내지 않고 되돌려 보낸다.
  $('cur-amount').textContent = '—';
  $('rec-amount').textContent = '—';
} else {
  $('cur-amount').textContent = result.currentTotal === null ? '—' : won(result.currentTotal);
  $('rec-amount').textContent = won(result.monthlyTotal);
}
$('guide').replaceChildren(...STEPS.map((s, i) => {
  const li = document.createElement('li');
  const dot = document.createElement('span'); dot.className = 'guide-dot'; dot.style.background = STEP_COLORS[i];
  const body = document.createElement('div');
  const head = document.createElement('strong'); head.textContent = `${i + 1}단계 · ${s.when}`;
  const title = document.createElement('span'); title.className = 'guide-name'; title.textContent = s.title;
  const desc = document.createElement('p'); desc.textContent = s.desc;
  body.append(head, title, desc); li.append(dot, body);
  return li;
}));

/* 캘린더 */
const today = new Date(); today.setHours(0, 0, 0, 0);
let view = new Date(today.getFullYear(), today.getMonth(), 1);
let mode = 'month';
const sameMonthAsToday = (y, m) => today.getFullYear() === y && today.getMonth() === m;

/** 'YYYY-MM-DD' → 자정 Date. 형식이 아니거나 없는 날짜면 null. */
function parseDay(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return null;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) ? date : null;
}

// 일정의 기준일. 기본은 오늘이며, 약정 만료일이 앞으로 남아 있으면 그 날로 옮긴다.
const expiry = input?.contract?.has ? parseDay(input.contract.endDate) : null;
const futureExpiry = expiry && expiry > today ? expiry : null;
let anchor = futureExpiry ?? today;
if (futureExpiry) EVENTS = EVENTS_FROM_EXPIRY;

const dayText = date => `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

/** 기준일을 바꾸고 화면(캘린더·담기 목록·안내)을 다시 그린다. */
function useAnchor(date, events, note) {
  anchor = date;
  EVENTS = events;
  $('cal-anchor').textContent = note;
  $('cal-anchor').hidden = false;
  render();
  if (!$('gcal-panel')?.hidden || $('gcal-list')?.children.length) renderAddList();
}

function eventsForMonth(y, m) {
  const map = new Map();
  for (const e of EVENTS) {
    const d = new Date(anchor); d.setDate(anchor.getDate() + e.offset);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const day = d.getDate();
      (map.get(day) || map.set(day, []).get(day)).push(e);
    }
  }
  return map;
}

function render() {
  const y = view.getFullYear(), m = view.getMonth();
  $('cal-title').textContent = `${y}년 ${m + 1}월`;
  const first = new Date(y, m, 1).getDay();
  const total = new Date(y, m + 1, 0).getDate();
  const evMap = eventsForMonth(y, m);
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  let weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  if (mode === 'week') {
    const wi = sameMonthAsToday(y, m) ? weeks.findIndex(w => w.includes(today.getDate())) : 0;
    weeks = [weeks[wi < 0 ? 0 : wi]];
  }

  const grid = $('cal-grid'); grid.replaceChildren();
  const head = document.createElement('div'); head.className = 'cal-week';
  for (const w of WD) { const c = document.createElement('div'); c.className = 'cal-wd'; c.textContent = w; head.append(c); }
  grid.append(head);
  for (const week of weeks) {
    const row = document.createElement('div'); row.className = 'cal-week';
    for (const day of week) {
      const cell = document.createElement('div'); cell.className = 'cal-cell';
      if (day == null) { cell.classList.add('empty'); row.append(cell); continue; }
      if (sameMonthAsToday(y, m) && day === today.getDate()) cell.classList.add('today');
      const num = document.createElement('span'); num.className = 'cal-num'; num.textContent = day; cell.append(num);
      for (const e of (evMap.get(day) || [])) {
        const chip = document.createElement('span'); chip.className = 'cal-ev'; chip.textContent = e.label;
        chip.style.background = STEP_COLORS[e.step] + '1f'; chip.style.color = STEP_COLORS[e.step];
        cell.append(chip);
      }
      row.append(cell);
    }
    grid.append(row);
  }
}

$('prev').addEventListener('click', () => { view.setMonth(view.getMonth() - 1); render(); });
$('next').addEventListener('click', () => { view.setMonth(view.getMonth() + 1); render(); });
$('today').addEventListener('click', () => { view = new Date(today.getFullYear(), today.getMonth(), 1); render(); });
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  mode = b.dataset.view;
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b));
  render();
}));
/* ── 캘린더 담기 (회원 전용) ── */

const plan = result?.planLabel ?? '추천 요금제';
const pad = n => String(n).padStart(2, '0');
/** 종일 일정용 날짜. Google·ICS 모두 시작일과 '다음 날'(끝은 배타적)을 쓴다. */
const dayStamp = date => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
const dateOf = offset => { const d = new Date(anchor); d.setDate(anchor.getDate() + offset); return d; };
const nextDay = date => { const d = new Date(date); d.setDate(d.getDate() + 1); return d; };

/** 일정 설명. 결과 화면이 넘긴 실제 금액만 쓰고, 없으면 그 문장을 빼 버린다(지어내지 않는다). */
function details(event) {
  const lines = [STEPS[event.step].desc, `추천: ${plan}`];
  if (result?.monthlyTotal != null) lines.push(`전환 후 예상 월 요금: ${won(result.monthlyTotal)}`);
  if (result?.monthlySavings > 0) lines.push(`정가 대비 월 ${won(result.monthlySavings)} 절감`);
  lines.push('요고비에서 만든 전환 일정입니다. 금액은 가입 전 통신사 공식 안내에서 확인해 주세요.');
  return lines.join('\n');
}

function googleUrl(event) {
  const start = dateOf(event.offset);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[요고비] ${event.label}`,
    dates: `${dayStamp(start)}/${dayStamp(nextDay(start))}`,   // 종일 일정
    details: details(event),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** 애플·아웃룩용. 한 파일에 5개 일정을 담는다. RFC 5545 는 CRLF 를 요구한다. */
function icsText() {
  const stamp = `${dayStamp(today)}T000000Z`;
  const body = EVENTS.flatMap((event, index) => {
    const start = dateOf(event.offset);
    return [
      'BEGIN:VEVENT',
      `UID:yogobi-${dayStamp(start)}-${index}@yogob.fly.dev`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dayStamp(start)}`,
      `DTEND;VALUE=DATE:${dayStamp(nextDay(start))}`,
      `SUMMARY:${icsEscape(`[요고비] ${event.label}`)}`,
      `DESCRIPTION:${icsEscape(details(event))}`,
      'END:VEVENT',
    ];
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yogobi//transfer-plan//KO',
    'CALSCALE:GREGORIAN', ...body, 'END:VCALENDAR'].join('\r\n');
}

// ICS 는 쉼표·세미콜론·역슬래시가 구분자다. 줄바꿈은 \n 으로 넣는다.
const icsEscape = text => text.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');

function renderAddList() {
  const list = $('gcal-list');
  list.replaceChildren(...EVENTS.map(event => {
    const item = document.createElement('li');
    const when = document.createElement('span');
    const date = dateOf(event.offset);
    when.className = 'gcal-when';
    when.textContent = `${date.getMonth() + 1}월 ${date.getDate()}일`;
    const link = document.createElement('a');
    link.className = 'gcal-link';
    link.href = googleUrl(event);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = event.label;
    item.append(when, link);
    return item;
  }));
}

function downloadIcs() {
  const blob = new Blob([icsText()], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '요고비-전환일정.ics';
  anchor.click();
  URL.revokeObjectURL(url);
}

/** 로그인 확인 후에만 담기를 연다. 비회원에게는 버튼 대신 로그인 안내를 보여준다. */
request('/api/v1/me', { member: true })
  .then(member => {
    $('gcal').hidden = false;
    $('gcal-guest').hidden = true;
    renderAddList();
    $('gcal').addEventListener('click', () => { $('gcal-panel').hidden = !$('gcal-panel').hidden; });
    $('gcal-ics').addEventListener('click', downloadIcs);
    return confirmWithServer(member.data);
  })
  .catch(() => { $('gcal').hidden = true; $('gcal-guest').hidden = false; });

/**
 * 현재 요금제를 저장한 회원이면 서버 판정으로 기준일을 확정한다(GET /me/switch-timing).
 * SWITCH_NOW = 지금 옮겨도 이득 → 오늘 기준. WAIT_UNTIL_EXPIRY = 만료까지 기다림 → 만료일 기준.
 * 판정은 서버가 하고 프론트는 날짜만 옮긴다. 실패하면 입력 기반 기준일을 그대로 둔다(fail-soft).
 */
async function confirmWithServer(member) {
  if (!member?.currentPlanId || !result?.planId) return;
  // 약정 잔여 개월은 사용자가 넣은 만료일에서 센다. 서버는 이 날짜를 모른다.
  const months = futureExpiry
    ? Math.max(0, Math.round((futureExpiry - today) / (1000 * 60 * 60 * 24 * 30.4375)))
    : 0;
  const query = new URLSearchParams({
    targetPlanId: String(result.planId),
    remainingContractMonths: String(months),
  });
  try {
    const { data } = await request(`/api/v1/me/switch-timing?${query}`, { member: true });
    if (data.status === 'SWITCH_NOW') {
      useAnchor(today, EVENTS_FROM_TODAY,
        `지금 옮기는 게 이득이라 오늘 기준으로 잡았어요 (전환비용 회수 ${data.paybackMonths}개월, 약정 잔여 ${months}개월).`);
    } else if (data.status === 'WAIT_UNTIL_EXPIRY' && futureExpiry) {
      useAnchor(futureExpiry, EVENTS_FROM_EXPIRY,
        `약정 만료일 ${dayText(futureExpiry)}까지 기다리는 게 이득이에요. 그 날에 맞춰 일정을 잡았어요.`);
    } else if (data.status === 'NO_BENEFIT') {
      $('cal-anchor').textContent = '지금 조건에서는 옮겨도 절감이 없어요. 아래 일정은 참고용이에요.';
    }
  } catch {
    /* 현재 요금제 미저장·서버 오류 — 입력 기반 기준일을 유지한다 */
  }
}

// 첫 그림: 기준일이 무엇인지 화면에 적고, 기준일이 있는 달을 보여준다.
$('cal-anchor').textContent = futureExpiry
  ? `약정 만료일 ${dayText(futureExpiry)} 기준으로 일정을 잡았어요.`
  : expiry ? '입력하신 약정 만료일이 이미 지나서 오늘 기준으로 잡았어요.'
    : '약정 정보가 없어 오늘 기준으로 잡았어요. 디테일 모드에서 약정 만료일을 넣으면 그 날에 맞춰 드려요.';
$('cal-anchor').hidden = false;
if (futureExpiry) view = new Date(futureExpiry.getFullYear(), futureExpiry.getMonth(), 1);

render();
