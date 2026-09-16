import { loadCatalog, CARRIERS, DATA_BUCKETS, FEE_BUCKETS } from './catalog-data.js';
import { tierPrice, tierKrwGuess, isForeign } from './model.js';

const $ = id => document.getElementById(id);
const won = n => `${n.toLocaleString('ko-KR')}원`;
let catalog = [];                    // BE 카탈로그 (로드 전에는 비어 있다)
const svc = id => catalog.find(s => s.id === id);

const state = {
  step: 1,
  carrier: null,        // { name, mvno }
  contractHas: null,    // true | false | null
  contractEnd: '',
  dataIdx: 2,
  fee: null,            // { label, amount } 또는 null(모름)
  customFee: false,
  networkType: null,    // '5G' | 'LTE' | '3G' | null(상관없음) — BE optional.networkType
  contractType: null,   // 'SELECTIVE_25' | 'NONE' | null(모름) — BE optional.contractType
  hasFamilyBundle: null,// true | false | null(모름) — BE optional.hasFamilyBundle
  // 카탈로그를 받기 전에는 비어 있다. 여기서 svc(id)를 부르면 로드 전이라 undefined 가 나와 화면 전체가 멈춘다.
  wish: [],
};

/** 카탈로그 도착 후 기본 선택을 채운다. 없는 서비스는 조용히 건너뛴다. */
const DEFAULT_WISH = [1, 2, 6];
function seedWish() {
  state.wish = DEFAULT_WISH
    .map(id => svc(id))
    .filter(Boolean)
    .map(service => ({ id: service.id, service, tierId: service.tiers[0].id, disposition: '유지' }));
}

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

/* 1. 통신사 — 검색 자동완성. 전체 목록을 나열하지 않고, 입력하면 일치하는 통신사만 제안한다. */
function carrierMatches(q) {
  const s = q.toLowerCase();
  return CARRIERS.filter(c => c.name.toLowerCase().includes(s) || (c.mvno && '알뜰폰'.includes(q)));
}
function highlight(name, q) {
  const frag = document.createDocumentFragment();
  const i = name.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) { frag.append(name); return frag; }
  frag.append(name.slice(0, i));
  const strong = document.createElement('strong');
  strong.textContent = name.slice(i, i + q.length);
  frag.append(strong, name.slice(i + q.length));
  return frag;
}
function selectCarrier(c) {
  state.carrier = { name: c.name, mvno: c.mvno };
  $('carrier-search').value = c.name;
  const list = $('carrier-list');
  list.replaceChildren(); list.hidden = true;
  $('contract-block').hidden = false;
  updateStatement();
}
function renderCarriers() {
  const q = $('carrier-search').value.trim();
  const list = $('carrier-list');
  if (!q) { list.replaceChildren(); list.hidden = true; return; }  // 빈 입력이면 제안 숨김
  const matches = carrierMatches(q);
  list.hidden = false;
  if (!matches.length) {
    list.replaceChildren(Object.assign(document.createElement('p'),
      { className: 'hint', textContent: '일치하는 통신사가 없어요. 다른 이름으로 검색해 보세요.', style: 'padding:14px 16px' }));
    return;
  }
  list.replaceChildren(...matches.map(c => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'pick-row' + (state.carrier?.name === c.name ? ' on' : '');
    row.append(highlight(c.name, q));
    if (c.mvno) { const t = document.createElement('small'); t.textContent = '알뜰폰'; row.append(t); }
    row.addEventListener('click', () => selectCarrier(c));
    return row;
  }));
}
$('carrier-search').addEventListener('input', renderCarriers);
$('carrier-search').addEventListener('focus', renderCarriers);

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
  const fee = $('st-fee');
  if (fee) fee.textContent = state.fee ? won(state.fee.amount) : '—';
}

/* 2. 희망 데이터 + 현재 통신비 + 선택 입력 */
function renderData() { $('data-value').textContent = DATA_BUCKETS[state.dataIdx].label; }
$('data-range').addEventListener('input', e => { state.dataIdx = Number(e.target.value); renderData(); });

// 통신비 구간 칩. 라이트 모드와 같은 구간을 쓴다(같은 질문은 같은 선택지).
function renderFee() {
  $('fee-choices').replaceChildren(
    ...FEE_BUCKETS.map(b => feeChip(b.label, () => selectFee(b))),
    feeChip('직접입력', () => selectFee(null, true)));
  syncFee();
}
function feeChip(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'choice'; button.textContent = label;
  button.dataset.label = label; button.addEventListener('click', onClick);
  return button;
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
  $('fee-choices').querySelectorAll('.choice')
    .forEach(b => b.classList.toggle('active', b.dataset.label === active));
  updateStatement();
}
$('fee-input').addEventListener('input', event => {
  const won = Number(event.target.value);
  state.fee = Number.isSafeInteger(won) && won > 0 ? { label: `${won.toLocaleString('ko-KR')}원`, amount: won } : null;
  updateStatement();
});

// 선택 입력: 고르면 BE optional 로 넘어가고, "잘 모르겠어요"(빈 값)면 보내지 않는다 — 안내로 남는다.
function pickGroup(containerId, attribute, apply) {
  // attribute 는 HTML 표기(data-contract-type), dataset 키는 카멜(contractType)이라 따로 변환한다.
  const key = attribute.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  $(containerId).addEventListener('click', event => {
    const button = event.target.closest(`[data-${attribute}]`);
    if (!button) return;
    apply(button.dataset[key]);
    $(containerId).querySelectorAll('.choice').forEach(b => b.classList.toggle('active', b === button));
    updateStatement();
  });
}
pickGroup('contract-type-choices', 'contract-type', value => { state.contractType = value || null; });
pickGroup('network-choices', 'network', value => { state.networkType = value || null; });
pickGroup('family-choices', 'family', value => {
  state.hasFamilyBundle = value === '' ? null : value === 'true';
});

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
  $('modal-list').replaceChildren(...catalog
    .filter(s => !chosen.has(s.id) && (!q || s.name.includes(q)))
    .map(s => {
      const el = document.createElement('label');
      el.className = 'sub-row';
      const check = document.createElement('input');
      check.type = 'checkbox'; check.dataset.id = s.id;
      const name = document.createElement('span');
      name.className = 'sub-name'; name.textContent = `${s.icon}  ${s.name}`;
      const price = document.createElement('span');
      price.className = 'sub-price'; price.textContent = tierPrice(s.tiers[0]);
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
    fee: state.fee,
    // BE optional 로 그대로 넘어간다. null 은 보내지 않아 missingInputs 안내가 유지된다.
    networkType: state.networkType,
    contractType: state.contractType,
    hasFamilyBundle: state.hasFamilyBundle,
    subs: state.wish.map(w => {
      const t = w.service.tiers.find(t => t.id === w.tierId);
      return { id: w.id, name: w.service.name, tierId: t.id, tierName: t.name,
               price: tierKrwGuess(t) ?? 0, estimated: isForeign(t), disposition: w.disposition };
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

/* 시작: 구독 카탈로그를 BE 에서 받아온 뒤 화면을 그린다. */
renderCarriers(); renderData(); renderFee(); renderWish(); updateStatement(); showStep(1);
loadCatalog()
  .then(list => { catalog = list; seedWish(); renderWish(); renderModal(); })
  .catch(e => error(e.message || '구독 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
