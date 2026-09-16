// 전환 액션 캘린더. 금액·요금제명은 결과 화면이 BE 응답에서 넘긴 값을 그대로 쓴다(같은 숫자는 같은 출처).
// 단계 가이드·날짜는 아직 화면 예시다. Google 캘린더 연동은 없다.

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
const EVENTS = [
  { offset: 0, label: '전환 준비 시작', step: 0 },
  { offset: 3, label: '명의확인 서류 준비', step: 0 },
  { offset: 8, label: '구독 결제일 확인', step: 2 },
  { offset: 14, label: '추천 요금제 가입 진행', step: 1 },
  { offset: 21, label: '첫 청구서 확인', step: 3 },
];

/* 금액 + 가이드 */
const result = JSON.parse(sessionStorage.getItem('yogobi:result') || 'null');
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

function eventsForMonth(y, m) {
  const map = new Map();
  for (const e of EVENTS) {
    const d = new Date(today); d.setDate(today.getDate() + e.offset);
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
$('gcal').addEventListener('click', () => { $('gcal-note').hidden = !$('gcal-note').hidden; });

render();
