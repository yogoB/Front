import { CATALOG, CARRIERS, DATA_BUCKETS } from './catalog-data.js';

const $ = id => document.getElementById(id);
const won = n => `${n.toLocaleString('ko-KR')}원`;
const svc = id => CATALOG.find(s => s.id === id);

const state = {
  step: 1,
  carrier: null,        // { name, mvno }
  contractHas: null,    // true | false | null
  contractEnd: '',
  dataIdx: 2,
  wish: [1, 2, 6].map(id => ({ id, service: svc(id), tierId: svc(id).tiers[0].id, disposition: '유지' })),
};

/* 단계 전환 */
function showStep(step) {
  state.step = step;
  error();
  $('loading').hidden = true;
  document.querySelector('.flow-cols').hidden = false;
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = Number(p.dataset.panel) !== step; });
  document.querySelectorAll('#progress li').forEach(li => {
    const n = Number(li.dataset.step);
    li.classList.toggle('current', n === step);
    li.classList.toggle('done', n < step);
  });
  const q = document.querySelector(`[data-panel="${step}"] .flow-q`);
  q?.setAttribute('tabindex', '-1'); q?.focus({ preventScroll: true });
  scrollTo(0, 0);
}
function error(message = '') { $('error').textContent = message; $('error').hidden = !message; }

/* 1. 통신사 */
function renderCarriers() {
  const q = $('carrier-search').value.trim();
  $('carrier-list').replaceChildren(...CARRIERS
    .filter(c => !q || c.name.includes(q))
    .map(c => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'pick-row' + (state.carrier?.name === c.name ? ' on' : '');
      row.textContent = c.name;
      if (c.mvno) { const t = document.createElement('small'); t.textContent = '알뜰폰'; row.append(t); }
      row.addEventListener('click', () => {
        state.carrier = { name: c.name, mvno: c.mvno };
        $('contract-block').hidden = false;
        renderCarriers(); updateStatement();
      });
      return row;
    }));
}
$('carrier-search').addEventListener('input', renderCarriers);

/* 약정 */
document.querySelectorAll('[data-contract]').forEach(b => b.addEventListener('click', () => {
  state.contractHas = b.dataset.contract === 'yes';
  document.querySelectorAll('[data-contract]').forEach(x => x.classList.toggle('active', x === b));
  $('contract-detail').hidden = !state.contractHas;
  updateStatement();
}));
$('contract-end').addEventListener('change', e => { state.contractEnd = e.target.value; });

function updateStatement() {
  $('st-carrier').textContent = state.carrier?.name || '—';
  $('st-contract').textContent = state.contractHas === null ? '—' : state.contractHas ? 'Y' : 'N';
}

/* 2. 희망 데이터 */
function renderData() { $('data-value').textContent = DATA_BUCKETS[state.dataIdx].label; }
$('data-range').addEventListener('input', e => { state.dataIdx = Number(e.target.value); renderData(); });

/* 3. 희망 구독 */
function renderWish() {
  $('wish-list').replaceChildren(...state.wish.map(w => {
    const row = document.createElement('div');
    row.className = 'wish-row';
    const name = document.createElement('span');
    name.className = 'sub-name'; name.textContent = `${w.service.icon}  ${w.service.name}`;
    const select = document.createElement('select');
    select.setAttribute('aria-label', `${w.service.name} 유지 여부`);
    for (const opt of ['유지', '해지']) select.add(new Option(opt, opt));
    select.value = w.disposition;
    select.addEventListener('change', () => { w.disposition = select.value; });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'remove'; remove.textContent = '✕';
    remove.setAttribute('aria-label', `${w.service.name} 제거`);
    remove.addEventListener('click', () => { state.wish = state.wish.filter(x => x.id !== w.id); renderWish(); });
    row.append(name, select, remove);
    return row;
  }));
}

/* 추가하기 모달 */
function openModal() {
  const dlg = $('add-modal');
  renderModal();
  dlg.showModal();
  $('modal-search').focus();
}
function renderModal() {
  const q = $('modal-search').value.trim();
  const chosen = new Set(state.wish.map(w => w.id));
  $('modal-list').replaceChildren(...CATALOG
    .filter(s => !chosen.has(s.id) && (!q || s.name.includes(q)))
    .map(s => {
      const el = document.createElement('label');
      el.className = 'sub-row';
      const check = document.createElement('input');
      check.type = 'checkbox'; check.dataset.id = s.id;
      const name = document.createElement('span');
      name.className = 'sub-name'; name.textContent = `${s.icon}  ${s.name}`;
      const price = document.createElement('span');
      price.className = 'sub-price'; price.textContent = won(s.tiers[0].price);
      el.append(check, name, price);
      return el;
    }));
  if (!$('modal-list').children.length)
    $('modal-list').append(Object.assign(document.createElement('p'),
      { className: 'hint', textContent: '추가할 서비스가 없어요.', style: 'padding:16px' }));
}
$('add-sub').addEventListener('click', openModal);
$('modal-search').addEventListener('input', renderModal);
$('modal-close').addEventListener('click', () => $('add-modal').close());
$('modal-add').addEventListener('click', () => {
  for (const c of $('modal-list').querySelectorAll('input:checked')) {
    const s = svc(Number(c.dataset.id));
    state.wish.push({ id: s.id, service: s, tierId: s.tiers[0].id, disposition: '유지' });
  }
  $('add-modal').close(); renderWish();
});

/* 분석 */
function analyze() {
  if (!state.carrier) { error('통신사를 먼저 선택해 주세요.'); showStep(1); return; }
  const keep = state.wish.filter(w => w.disposition === '유지');
  if (!keep.length) { error('유지할 구독 서비스를 하나 이상 골라주세요.'); return; }
  const b = DATA_BUCKETS[state.dataIdx];
  const input = {
    mode: 'detail',
    carrier: state.carrier.name,
    mvno: state.carrier.mvno,
    contract: { has: state.contractHas === true, endDate: state.contractEnd || null },
    data: { label: b.label, gb: b.rep },
    subs: state.wish.map(w => {
      const t = w.service.tiers.find(t => t.id === w.tierId);
      return { id: w.id, name: w.service.name, tierName: t.name, price: t.price, disposition: w.disposition };
    }),
  };
  sessionStorage.setItem('yogobi:input', JSON.stringify(input));
  runLoading();
}
function runLoading() {
  document.querySelector('.flow-cols').hidden = true;
  $('loading').hidden = false; scrollTo(0, 0);
  const items = [...$('load-list').children];
  let i = 0;
  const tick = () => {
    if (i < items.length) items[i].classList.add('done');
    $('load-bar-fill').style.width = `${((i + 1) / items.length) * 100}%`;
    i += 1;
    if (i <= items.length) setTimeout(tick, 550);
    else location.href = './results.html';
  };
  tick();
}

/* 배선 */
$('back').addEventListener('click', () => state.step > 1 ? showStep(state.step - 1) : (location.href = './#modes'));
document.querySelectorAll('#progress li').forEach(li =>
  li.addEventListener('click', () => showStep(Number(li.dataset.step))));
document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
  if (state.step === 1 && !state.carrier) { error('통신사를 선택해 주세요.'); return; }
  showStep(state.step + 1);
}));
$('analyze').addEventListener('click', analyze);

renderCarriers(); renderData(); renderWish(); updateStatement(); showStep(1);
