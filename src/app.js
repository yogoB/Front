import { request, ApiError } from './api.js';
import { won, provenance, integer, optionalInputs, recommendationRequest, calculatorRequest, comparisonCsv } from './model.js';

const $ = id => document.getElementById(id);
const form = $('recommend-form');
const state = { step: 1, catalog: [], subs: [], response: null, selected: null, snapshot: null };
let pending, benefitsPending;
const values = () => Object.fromEntries(new FormData(form));
// All API/user strings enter the DOM through textContent or native option values.
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action, className) {
  const node = element('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
}
function error(message = '') { $('form-error').textContent = message; $('form-error').hidden = !message; }
function focusTitle() {
  const heading = state.step === 4 ? $('loading').querySelector('h1') : state.step === 5 ? $('results-title') : $(`step${state.step}-title`);
  heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start' });
}
function displayStep(step, focus = true) {
  state.step = step;
  document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.panel) !== step; });
  form.hidden = step > 3; $('loading').hidden = step !== 4; $('results').hidden = step !== 5;
  $('step-nav').hidden = step > 3; $('spend-summary').hidden = step > 3;
  $('workspace').classList.toggle('show-results', step > 3);
  $('chat-panel').hidden = step === 4;
  $('previous').disabled = step === 1;
  $('next').textContent = step === 3 ? '추천 조합 받기' : '다음';
  $('step-count').textContent = `${step} / 3 단계`;
  document.querySelectorAll('[data-step]').forEach(node => {
    if (Number(node.dataset.step) === step) node.setAttribute('aria-current', 'step');
    else node.removeAttribute('aria-current');
  });
  if (step === 3) renderPriorities();
  if (focus) focusTitle();
}
function validateFirst() {
  integer(values().monthlyDataGb, '월 데이터 사용량', 1, 2147483647);
  if (values().fee.trim()) integer(values().fee, '현재 월 통신비', 0, 1000000000);
}
function validateSubscriptions() {
  if (!state.subs.length) throw new Error('구독 서비스를 하나 이상 골라주세요.');
  for (const sub of state.subs) if (sub.price.trim()) integer(sub.price, `${sub.name} 월 금액`, 0, 1000000000);
}
function go(step) {
  error();
  try {
    if (step > 1) validateFirst();
    if (step > 2) validateSubscriptions();
    displayStep(step);
  } catch (e) { error(e.message); }
}
function restart() {
  pending?.abort(); pending = null; benefitsPending?.abort();
  $('chat-send').disabled = false; $('exact-calculate').disabled = false;
  error(); displayStep(1);
}
function renderSummary() {
  const v = values();
  const parse = text => /^\d+$/.test(String(text).trim()) && Number.isSafeInteger(Number(text)) ? Number(text) : null;
  const fee = parse(v.fee), prices = state.subs.map(s => parse(s.price));
  const subTotal = prices.reduce((sum, p) => sum + (p ?? 0), 0);
  const hasAmount = fee !== null || prices.some(p => p !== null);
  $('current-total').textContent = hasAmount ? won((fee ?? 0) + subTotal) : '—';
  $('fee-summary').textContent = fee === null ? '—' : won(fee);
  $('sub-summary').textContent = prices.some(p => p !== null) ? won(subTotal) : '—';
  $('carrier-summary').textContent = v.currentCarrier || '모름';
  $('data-summary').textContent = v.monthlyDataGb ? `${v.monthlyDataGb}GB` : '—';
  $('contract-summary').textContent = $('contract').selectedOptions[0].textContent;
  $('budget-label').textContent = won(Number(v.budget));
}
async function loadCatalog() {
  $('reload-catalog').disabled = true; $('catalog-status').textContent = '서비스 목록을 불러오고 있어요.';
  try {
    const { data } = await request('/api/v1/catalog/services');
    if (!Array.isArray(data)) throw new Error('서비스 목록의 형식이 올바르지 않아요.');
    state.catalog = data;
    // Preserve user-entered prices while refreshing catalog IDs and tiers.
    state.subs = state.subs.map(sub => {
      const service = data.find(s => s.id === sub.id);
      if (!service?.tiers.some(t => t.id === sub.tierId)) return { ...sub, unavailable: true };
      return { ...sub, name: service.name, service, unavailable: false };
    });
    $('catalog-status').textContent = data.length ? '등록된 서비스와 구독 등급을 불러왔어요.' : '등록된 구독 서비스가 없어요. 나중에 목록을 다시 불러와 주세요.';
    renderSubscriptions();
  } catch (e) { $('catalog-status').textContent = e.message; }
  finally { $('reload-catalog').disabled = false; }
}
async function loadPlans() {
  $('reload-plans').disabled = true; $('plans-status').textContent = '요금제를 불러오고 있어요.';
  try {
    const { data } = await request('/api/v1/catalog/plans');
    $('calculator-plan').replaceChildren(new Option('요금제를 선택해 주세요', ''), ...data.map(p => new Option(`${p.carrier} · ${p.name} · 기본료 ${won(p.basePrice)} (공식 가격)`, p.id)));
    $('plans-status').textContent = data.length ? `${data.length}개 요금제를 불러왔어요.` : '등록된 요금제가 없어요. 나중에 다시 불러와 주세요.';
  } catch (e) { $('plans-status').textContent = e.message; }
  finally { $('reload-plans').disabled = false; }
}
function addSubscription(service) {
  if (state.subs.some(s => s.id === service.id) || !service.tiers.length) return;
  const tier = service.tiers[0];
  state.subs.push({ id: service.id, name: service.name, service, tierId: tier.id, price: String(tier.price), wanted: true });
  renderSubscriptions();
  $('subscriptions').lastElementChild.querySelector('select').focus();
}
function renderSubscriptions() {
  $('catalog').replaceChildren(...state.catalog.map(service => {
    const added = state.subs.some(s => s.id === service.id);
    const node = button(`${service.name}${added ? ' · 추가됨' : ' +'}`, () => addSubscription(service));
    node.disabled = added || !service.tiers.length;
    return node;
  }));
  $('sub-count').textContent = `${state.subs.length}개`; $('subs-empty').hidden = state.subs.length > 0;
  $('subscriptions').replaceChildren(...state.subs.map(sub => {
    const row = element('div', undefined, 'subscription');
    const name = element('div', undefined, 'service-name'); name.append(element('strong', sub.name), element('small', sub.service.category));
    try {
      const url = new URL(sub.service.officialUrl);
      if (['https:', 'http:'].includes(url.protocol)) { const link = element('a', '공식 가격 확인'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; name.append(link); }
    } catch { /* Missing official links do not block catalog selection. */ }
    const tierField = element('div', undefined, 'tier-field'), select = element('select'); select.id = `tier-${sub.id}`;
    const tierLabel = element('label', '구독 등급'); tierLabel.htmlFor = select.id;
    for (const tier of sub.service.tiers) select.add(new Option(`${tier.name} · ${won(tier.price)}`, tier.id));
    select.value = sub.tierId;
    select.addEventListener('change', () => {
      sub.tierId = Number(select.value); const tier = sub.service.tiers.find(t => t.id === sub.tierId);
      sub.price = String(tier.price); price.value = sub.price; note.textContent = tier.note || '카탈로그 공식 가격'; renderSummary();
    });
    const note = element('p', sub.unavailable ? '목록이 변경됐어요. 이 구독을 삭제하고 다시 선택해 주세요.' : sub.service.tiers.find(t => t.id === sub.tierId)?.note || '카탈로그 공식 가격', sub.unavailable ? 'error' : 'hint');
    select.disabled = Boolean(sub.unavailable);
    tierField.append(tierLabel, select, note);
    const priceField = element('div', undefined, 'price-field'), price = element('input'); price.id = `price-${sub.id}`; price.inputMode = 'numeric'; price.value = sub.price;
    const priceLabel = element('label', '현재 월 금액 (원)'); priceLabel.htmlFor = price.id;
    price.addEventListener('input', () => { sub.price = price.value; renderSummary(); });
    priceField.append(priceLabel, price, element('p', '현재 지출 메모용', 'hint'));
    const remove = button('삭제', () => { state.subs = state.subs.filter(s => s.id !== sub.id); renderSubscriptions(); $('reload-catalog').focus(); }, 'remove');
    remove.setAttribute('aria-label', `${sub.name} 삭제`);
    row.append(name, tierField, priceField, remove); return row;
  }));
  renderPriorities(); renderSummary();
}
function renderPriorities() {
  $('priorities').replaceChildren(...state.subs.map(sub => {
    const row = element('div', undefined, 'priority-row');
    const label = element('label', undefined, 'checkbox-label'), input = element('input'); input.type = 'checkbox'; input.checked = sub.wanted;
    input.addEventListener('change', () => { sub.wanted = input.checked; });
    label.append(input, document.createTextNode(`${sub.name} 포함`));
    row.append(label, element('small', sub.service.tiers.find(t => t.id === sub.tierId)?.name)); return row;
  }));
}
function warnings(items, target = $('warnings')) {
  target.replaceChildren(...items.map(w => element('p', w.message, 'callout')));
}
function renderResults(response, warningItems, message = '', mode = 'recommendation') {
  error();
  state.response = response;
  state.selected = response.results[0] || null;
  $('results-title').textContent = mode === 'calculator' ? '선택한 구독 등급의 계산 결과' : `조건에 맞는 추천 ${response.results.length}가지`;
  $('results-caption').textContent = mode === 'calculator'
    ? '선택한 요금제와 구독 등급의 서버 계산값이에요.'
    : '월 지불 총액이 낮은 순서예요. 추천은 서비스별 대표 등급을 사용해요.';
  $('results-caption').textContent += response.accuracy === 'FULL' ? ' 선택 정보가 모두 입력됐어요.' : ' 일부 선택 정보가 비어 있어요.';
  $('result-message').textContent = message;
  warnings(warningItems);
  $('missing-section').hidden = !response.missingInputs.length;
  $('missing-section').open = response.missingInputs.length > 0;
  $('missing-inputs').replaceChildren(...response.missingInputs.map(m => element('li', `${m.impact} · ${m.howToFind}`)));
  $('result-cards').replaceChildren(...response.results.map((r, i) => {
    const card = button('', () => { state.selected = r; renderDetail(); }, 'result-card'); card.dataset.planId = r.planId;
    card.append(element('small', `${i + 1} · ${r.carrier}`), element('strong', r.planName), element('span', `${won(r.monthlyTotal)} / 월`, 'total'),
      element('span', `정가 대비 월 ${won(r.monthlySavings)} · 연 ${won(r.annualSavings)} 절감`, 'saving'),
      element('span', `정가 합계 ${won(r.baseline)} · 계산값`, 'hint'));
    if (state.snapshot?.budget) card.append(element('span', r.monthlyTotal <= state.snapshot.budget ? '설정한 예산 이내' : '설정한 예산 초과', 'hint'));
    return card;
  }));
  if (!response.results.length) $('result-cards').append(element('p', '조건에 맞는 결과가 없어요. 데이터 용량이나 원하는 서비스를 바꿔주세요.', 'empty'));
  displayStep(5); renderDetail();
}
function renderDetail() {
  const r = state.selected;
  $('result-detail').hidden = !r;
  if (!r) return;
  document.querySelectorAll('.result-card').forEach(card => card.setAttribute('aria-pressed', String(Number(card.dataset.planId) === r.planId)));
  $('detail-title').textContent = `${r.carrier} · ${r.planName}`;
  $('detail-summary').textContent = `정가 합계 ${won(r.baseline)} → 월 ${won(r.monthlyTotal)} · 서버 계산값`;
  $('breakdown').replaceChildren(...r.breakdown.map(line => {
    const row = element('div'), label = element('dt', line.label);
    label.append(element('small', `${provenance[line.provenance] || line.provenance}${line.note ? ' · ' + line.note : ''}`));
    row.append(label, element('dd', won(line.amount))); return row;
  }));
  $('exact-calculate').hidden = !state.snapshot;
  $('exact-calculate').disabled = false;
  $('benefits-section').open = false;
  loadBenefits(r.planId);
}
async function loadBenefits(id) {
  benefitsPending?.abort(); const controller = new AbortController(); benefitsPending = controller;
  $('benefits').replaceChildren(); $('benefits-status').textContent = '혜택을 불러오고 있어요.'; $('reload-benefits').disabled = true;
  try {
    const { data } = await request(`/api/v1/catalog/plans/${id}/benefits`, { signal: controller.signal });
    if (controller.signal.aborted || state.selected?.planId !== id) return;
    const names = { FREE: '무료 제공', FIXED_DISCOUNT: '정액 할인', RATE_DISCOUNT: '정률 할인', BUNDLE_INCLUDED: '번들 포함' };
    $('benefits-status').textContent = data.length ? '제공 조건을 함께 확인해 주세요.' : '등록된 제휴 혜택이 없어요.';
    $('benefits').replaceChildren(...data.map(b => element('li', `${b.serviceName} · ${names[b.benefitType] || b.benefitType}${b.exclusive ? ' · 택1 혜택' : ''}`)));
  } catch (e) { if (!controller.signal.aborted) $('benefits-status').textContent = e.message; }
  finally { if (!controller.signal.aborted) $('reload-benefits').disabled = false; }
}
async function recommend() {
  error();
  try {
    validateFirst(); validateSubscriptions();
    const body = recommendationRequest(values(), state.subs);
    state.snapshot = { optional: body.optional, subs: state.subs.map(s => ({ ...s })), budget: Number(values().budget) };
    pending?.abort(); const controller = new AbortController(); pending = controller;
    displayStep(4);
    try {
      const response = await request('/api/v1/recommendations', { method: 'POST', body, signal: controller.signal });
      if (!controller.signal.aborted) renderResults(response.data, response.warnings);
    } catch (e) {
      if (!controller.signal.aborted) { displayStep(3); error(e.status === 422 ? `${e.message} 데이터 용량이나 통신망 조건을 바꿔 다시 시도해 주세요.` : e.message); }
    } finally { if (pending === controller) pending = null; }
  } catch (e) { error(e.message); }
}
async function calculate(planId = state.selected?.planId, snapshot = state.snapshot, fromInput = false) {
  if (pending || !snapshot) return;
  let body;
  try { body = calculatorRequest(planId, snapshot.optional, snapshot.subs); }
  catch (e) { error(e.message); return; }
  const controller = new AbortController(); pending = controller; $('exact-calculate').disabled = true; error();
  if (fromInput) displayStep(4);
  try {
    const { data, warnings: notices } = await request('/api/v1/calculator', { method: 'POST', body, signal: controller.signal });
    if (!controller.signal.aborted) { state.snapshot = snapshot; renderResults({ ...data, results: [data.result] }, notices, '', 'calculator'); }
  } catch (e) { if (!controller.signal.aborted) { if (fromInput) displayStep(3); error(e.message); } }
  finally { if (pending === controller) { pending = null; $('exact-calculate').disabled = false; } }
}
async function chat(event) {
  event.preventDefault(); if (pending) return;
  const text = $('chat-text').value.trim();
  if (!text || [...text].length > 4000) { $('chat-message').textContent = '메시지를 1~4,000자로 입력해 주세요.'; return; }
  const controller = new AbortController(); pending = controller;
  $('chat-send').disabled = true; $('chat-message').textContent = '문장의 조건을 확인하고 있어요.'; $('chat-fallback').hidden = true;
  try {
    const { data, warnings: notices } = await request('/api/v1/chat/messages', { method: 'POST', body: { text }, signal: controller.signal });
    if (controller.signal.aborted) return;
    $('chat-message').textContent = [data.message, ...notices.map(w => w.message)].join('\n');
    if (data.status === 'RECOMMENDED' && data.recommendation) {
      // The chat contract does not return parsed tier/optional inputs; do not mix in stale filter inputs.
      state.snapshot = null; renderResults(data.recommendation, notices, data.message);
    } else $('chat-fallback').hidden = false;
  } catch (e) { if (!controller.signal.aborted) { $('chat-message').textContent = e.message; $('chat-fallback').hidden = false; } }
  finally { if (pending === controller) { pending = null; $('chat-send').disabled = false; } }
}
function download() {
  if (!state.response?.results.length) return;
  const url = URL.createObjectURL(new Blob([comparisonCsv(state.response.results)], { type: 'text/csv;charset=utf-8' }));
  const link = element('a'); link.href = url; link.download = '요고비-비교표.csv'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function memberStatus() {
  try {
    const { data } = await request('/api/v1/me', { member: true });
    $('member-status').textContent = data.email; $('account-link').textContent = '내 계정';
  } catch (e) {
    $('member-status').textContent = e instanceof ApiError && e.status === 401 ? '로그인 없이 이용 중' : '계정 상태 확인 불가';
  }
}
form.addEventListener('submit', event => { event.preventDefault(); if (pending) return; state.step === 3 ? recommend() : go(state.step + 1); });
form.addEventListener('input', renderSummary); form.addEventListener('change', renderSummary);
$('previous').addEventListener('click', () => go(state.step - 1));
$('cancel-request').addEventListener('click', restart);
document.querySelectorAll('[data-step]').forEach(node => node.addEventListener('click', () => { if (!pending) go(Number(node.dataset.step)); }));
document.querySelectorAll('[data-gb]').forEach(node => node.addEventListener('click', () => { $('monthly-data').value = node.dataset.gb; renderSummary(); }));
document.querySelectorAll('[data-restart]').forEach(node => node.addEventListener('click', restart));
$('reload-catalog').addEventListener('click', loadCatalog);
$('reload-benefits').addEventListener('click', () => loadBenefits(state.selected.planId));
$('exact-calculate').addEventListener('click', () => calculate()); $('download').addEventListener('click', download);
$('reload-plans').addEventListener('click', loadPlans);
$('calculator-panel').addEventListener('toggle', () => { if ($('calculator-panel').open && $('calculator-plan').options.length === 1 && !$('reload-plans').disabled) loadPlans(); });
$('calculate-chosen').addEventListener('click', () => calculate($('calculator-plan').value, { optional: optionalInputs(values()), subs: state.subs.map(s => ({ ...s })), budget: Number(values().budget) }, true));
$('chat-form').addEventListener('submit', chat); $('chat-fallback').addEventListener('click', restart);
const fragment = new URLSearchParams(location.hash.slice(1));
if (fragment.has('auth') || fragment.has('action')) location.replace('./account.html' + location.hash);
else { displayStep(1, false); renderSummary(); loadCatalog(); memberStatus(); }
