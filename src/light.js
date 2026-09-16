import { loadCatalog, DATA_BUCKETS, FEE_BUCKETS } from './catalog-data.js';
import { tierPrice, tierKrwGuess, isForeign } from './model.js';

const $ = id => document.getElementById(id);
const won = n => `${n.toLocaleString('ko-KR')}원`;

const state = {
  step: 1,
  dataIdx: 2,          // 기본 5~15GB
  dataSkipped: false,
  fee: null,           // { label, amount } 또는 null
  subs: [],            // 카탈로그를 받은 뒤 채운다 (BE 가 원본)
};

/* 단계 전환 */
function showStep(step) {
  state.step = step;
  error();
  $('loading').hidden = true;
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = Number(p.dataset.panel) !== step; });
  document.querySelectorAll('#progress li').forEach(li => {
    const n = Number(li.dataset.step);
    li.classList.toggle('current', n === step);
    li.classList.toggle('done', n < step);
  });
  if (step === 3) renderSummary();
  const active = document.querySelector(`[data-panel="${step}"] .flow-q`);
  active?.setAttribute('tabindex', '-1'); active?.focus({ preventScroll: true });
  scrollTo(0, 0);
}
function error(message = '') { $('error').textContent = message; $('error').hidden = !message; }

/* 1. 데이터 슬라이더 */
function renderData() {
  const b = DATA_BUCKETS[state.dataIdx];
  $('data-value').textContent = state.dataSkipped ? '모름' : b.label;
}
$('data-range').addEventListener('input', e => {
  state.dataIdx = Number(e.target.value); state.dataSkipped = false; renderData();
});

/* 2. 통신비 칩 */
function renderFee() {
  $('fee-choices').replaceChildren(...FEE_BUCKETS.map(b => choice(b.label, () => selectFee(b))),
    choice('직접입력', () => selectFee(null, true)));
  syncFee();
}
function choice(label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'choice'; btn.textContent = label;
  btn.dataset.label = label; btn.addEventListener('click', onClick);
  return btn;
}
function selectFee(bucket, custom = false) {
  state.customFee = custom;
  state.fee = custom ? state.fee : { label: bucket.label, amount: bucket.rep };
  $('fee-custom').hidden = !custom;
  if (custom) $('fee-input').focus();
  syncFee();
}
function syncFee() {
  const active = state.customFee ? '직접입력' : state.fee?.label;
  document.querySelectorAll('#fee-choices .choice').forEach(b =>
    b.classList.toggle('active', b.dataset.label === active));
}
$('fee-input').addEventListener('input', e => {
  const v = e.target.value.trim();
  state.fee = /^\d+$/.test(v) ? { label: '직접입력', amount: Number(v) } : null;
});

/* 3. 구독 목록 + 요약 */
function renderSubs() {
  const q = $('sub-search').value.trim();
  $('sub-list').replaceChildren(...state.subs
    .filter(s => !q || s.service.name.includes(q))
    .map(row));
  renderSummary();
}
function row(sub) {
  const tier = sub.service.tiers.find(t => t.id === sub.tierId);
  const el = document.createElement('label');
  el.className = 'sub-row' + (sub.checked ? ' on' : '');
  const check = document.createElement('input');
  check.type = 'checkbox'; check.checked = sub.checked;
  check.addEventListener('change', () => { sub.checked = check.checked; renderSubs(); });
  const name = document.createElement('span');
  name.className = 'sub-name'; name.textContent = `${sub.service.icon}  ${sub.service.name}`;
  const price = document.createElement('span');
  price.className = 'sub-price'; price.textContent = tierPrice(tier);
  const select = document.createElement('select');
  select.setAttribute('aria-label', `${sub.service.name} 등급`);
  for (const t of sub.service.tiers) select.add(new Option(t.name, t.id));
  select.value = sub.tierId;
  select.disabled = sub.service.tiers.length < 2;
  select.addEventListener('click', e => e.preventDefault());
  select.addEventListener('change', () => { sub.tierId = Number(select.value); renderSubs(); });
  el.append(check, name, price, select);
  return el;
}
$('sub-search').addEventListener('input', renderSubs);

function renderSummary() {
  const chosen = state.subs.filter(s => s.checked);
  // 해외 결제 등급은 원화 확정 금액이 없어 환산 추정치로 더한다 — 아래에 추정 포함이라고 적는다.
  const picked = chosen.map(s => s.service.tiers.find(t => t.id === s.tierId));
  const subTotal = picked.reduce((sum, t) => sum + (tierKrwGuess(t) ?? 0), 0);
  const fee = state.fee?.amount ?? 0;
  const has = state.fee || chosen.length;
  $('sum-total').textContent = has ? won(fee + subTotal) : '—';
  $('sum-fee').textContent = state.fee ? won(state.fee.amount) : '—';
  $('sum-data').textContent = state.dataSkipped ? '모름' : DATA_BUCKETS[state.dataIdx].label;
  // 추정치가 섞였으면 숨기지 않고 그 자리에 적는다(절대 원칙 4 — 금액에는 출처가 붙는다).
  const estimated = picked.some(isForeign);
  $('sum-subs').textContent = chosen.length
    ? won(subTotal) + (estimated ? ' (해외 결제 추정 포함)' : '') : '—';
}

/* 분석 시작 */
function analyze() {
  const chosen = state.subs.filter(s => s.checked);
  if (!chosen.length) { error('구독 서비스를 하나 이상 골라주세요.'); return; }
  const b = DATA_BUCKETS[state.dataIdx];
  const input = {
    mode: 'light',
    data: state.dataSkipped ? null : { label: b.label, gb: b.rep },
    fee: state.fee,
    subs: chosen.map(s => {
      const t = s.service.tiers.find(t => t.id === s.tierId);
      return { id: s.id, name: s.service.name, tierId: t.id, tierName: t.name,
               price: tierKrwGuess(t) ?? 0, estimated: isForeign(t) };
    }),
  };
  sessionStorage.setItem('yogobi:input', JSON.stringify(input));
  runLoading();
}
function runLoading() {
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = true; });
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

/* 이벤트 배선 */
$('back').addEventListener('click', () => state.step > 1 ? showStep(state.step - 1) : (location.href = './#modes'));
document.querySelectorAll('#progress li').forEach(li =>
  li.addEventListener('click', () => showStep(Number(li.dataset.step))));
document.querySelectorAll('[data-next]').forEach(b =>
  b.addEventListener('click', () => showStep(state.step + 1)));
document.querySelectorAll('[data-skip]').forEach(b => b.addEventListener('click', () => {
  if (state.step === 1) { state.dataSkipped = true; renderData(); }
  if (state.step === 2) { state.fee = null; state.customFee = false; }
  showStep(state.step + 1);
}));
$('analyze').addEventListener('click', analyze);

/* 시작: 구독 카탈로그를 BE 에서 받아온 뒤 화면을 그린다. 목업 가격으로 대체하지 않는다. */
renderData(); renderFee(); showStep(1);
loadCatalog()
  .then(catalog => {
    state.subs = catalog.map(s => ({ id: s.id, service: s, tierId: s.tiers[0].id, checked: false }));
    renderSubs();
  })
  .catch(e => error(e.message || '구독 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
