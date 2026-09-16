// 마이페이지. 화면의 값은 전부 BE 가 원본이다 — 프로필 GET /api/v1/me, 현재 요금제 POST /me/current-plan,
// 내 구독 GET/POST/DELETE /me/subscriptions, 중복 결제 GET /me/detections.
// 낭비 금액도 BE(DuplicateDetector)가 계산한 값을 그대로 쓴다 — 프론트는 숫자를 만들지 않는다(절대 원칙 2).
// 전환 일정은 이 화면에서 흉내 내지 않고 실제 캘린더 화면으로 보낸다(같은 숫자는 한 곳에서만 — 원칙 5-⑤).
import { request, ApiError } from './api.js';
import { loadCatalog } from './catalog-data.js';
import { won, integer, tierPrice, tierKrwGuess, matches } from './model.js';

const $ = id => document.getElementById(id);
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
const say = (id, message) => { $(id).textContent = message; };
const message = error => (error instanceof ApiError ? error.message : '요청을 처리하지 못했어요.');

/** BE 카탈로그의 통신망 코드 → 화면 표기. 모르는 값은 그대로 보여준다. */
const NETWORKS = { FIVE_G: '5G', LTE: 'LTE', THREE_G: '3G' };

/** BE 탐지 규칙(docs/domain.md §7)의 화면 문구. 금액·판정은 BE 가 하고 여기선 이름만 붙인다. */
const RULES = {
  BENEFIT_OVERLAP: ['요금제에 포함된 구독을 따로 결제 중', '요금제 혜택으로 이미 제공돼요. 개별 결제를 해지하면 그만큼 줄어요.'],
  TIER_DUPLICATE: ['같은 서비스를 두 등급으로 결제 중', '더 비싼 등급 하나만 남기면 나머지가 줄어요.'],
  BUNDLE_OVERLAP: ['묶음 상품이 더 싼 조합', '개별 결제 합계가 묶음 상품보다 비싸요.'],
};

let member = null;
let plans = [];       // GET /api/v1/catalog/plans — 현재 요금제 검색·이름 표시
let services = [];    // GET /api/v1/catalog/services — 구독 추가 폼의 서비스·등급
// 카탈로그는 회원 데이터와 따로 도착한다. 먼저 온 쪽을 그린 뒤 나머지가 오면 이름을 붙여 다시 그린다.
let subscriptions = [];
let findings = [];

start();

async function start() {
  try {
    ({ data: member } = await request('/api/v1/me', { member: true }));
  } catch {
    // 비회원도 화면은 열린다(원칙 5-①). 저장이 필요한 부분만 로그인 안내로 바꾼다.
    $('pc-name').textContent = '로그인이 필요해요';
    $('guest-note').hidden = false;
    return;
  }
  paintMember();
  wireNickname();
  for (const id of ['plan-card', 'subs-card', 'detect-card']) $(id).hidden = false;
  // 공개 카탈로그와 회원 데이터는 서로를 기다리지 않는다.
  loadPlans();
  loadServices();
  loadSubscriptions();
  loadDetections();
}

/* ── 프로필 ── */

function paintMember() {
  // 이름이 없는 계정(Google 로그인)은 닉네임을 이름 자리에 쓴다.
  const display = member.name || member.nickname || member.email.split('@')[0];
  $('pc-name').textContent = display;
  $('pc-avatar').textContent = [...display][0] ?? '·';
  $('pc-nick').textContent = member.nickname ? '@' + member.nickname : '';
  $('pc-email').textContent = member.email;
  $('pc-login').textContent = [member.localLogin && '비밀번호', member.googleLogin && 'Google']
    .filter(Boolean).join(' · ') || '—';
}

/** 닉네임 변경 (POST /api/v1/me/nickname). 중복이면 서버가 그 사실을 알려준다. */
function wireNickname() {
  $('nick-edit').addEventListener('click', () => {
    $('nick-input').value = member?.nickname ?? '';
    $('nick-form').hidden = false;
    $('nick-edit').hidden = true;
    $('nick-input').focus();
  });
  $('nick-cancel').addEventListener('click', () => {
    $('nick-form').hidden = true;
    $('nick-edit').hidden = false;
    say('nick-status', '');
  });
  $('nick-form').addEventListener('submit', async event => {
    event.preventDefault();
    const nickname = $('nick-input').value.trim();
    if (!nickname) { $('nick-input').focus(); return; }
    const button = $('nick-form').querySelector('button[type="submit"]');
    button.disabled = true;
    say('nick-status', '저장 중…');
    try {
      const { data } = await request('/api/v1/me/nickname', { method: 'POST', member: true, body: { nickname } });
      member = data;
      paintMember();
      $('nick-form').hidden = true;
      $('nick-edit').hidden = false;
      say('nick-status', '');
    } catch (error) {
      say('nick-status', message(error));
    } finally {
      button.disabled = false;
    }
  });
}

/* ── 현재 요금제 (POST /api/v1/me/current-plan) ── */

async function loadPlans() {
  try {
    ({ data: plans } = await request('/api/v1/catalog/plans'));
    paintCurrentPlan();
  } catch (error) {
    say('plan-status', message(error));
  }
}

function paintCurrentPlan() {
  const current = plans.find(plan => plan.id === member.currentPlanId);
  $('plan-now').textContent = current
    ? `${current.carrier} ${current.name}`
    : (member.currentPlanId ? `요금제 #${member.currentPlanId}` : '아직 저장하지 않았어요');
  $('plan-now').classList.toggle('on', Boolean(member.currentPlanId));
}

/** 1,700여 개 중 검색어에 맞는 8개만 보여준다 — 목록 전체를 그리면 화면이 못 쓰게 된다. */
function renderPlanMatches() {
  const query = $('plan-search').value.trim();
  const box = $('plan-list');
  if (!query) { box.hidden = true; box.replaceChildren(); return; }
  // 공백·대소문자를 무시한다 — "요고38"로도 "KT 요고 38"을 찾는다.
  const found = plans
    .filter(plan => matches(`${plan.carrier} ${plan.name}`, query))
    .slice(0, 8);
  box.replaceChildren(...(found.length ? found.map(planRow)
    : [el('p', 'hint', '검색 결과가 없어요. 통신사나 요금제명 일부로 다시 찾아보세요.')]));
  box.hidden = false;
}

function planRow(plan) {
  const row = el('button', 'pick-row' + (plan.id === member.currentPlanId ? ' on' : ''));
  row.type = 'button';
  row.append(el('span', undefined, `${plan.carrier} ${plan.name}`),
    el('small', undefined, `${NETWORKS[plan.networkType] ?? plan.networkType} · 월 ${won(plan.basePrice)}`));
  row.addEventListener('click', () => saveCurrentPlan(plan));
  return row;
}

async function saveCurrentPlan(plan) {
  say('plan-status', '저장 중…');
  try {
    await request('/api/v1/me/current-plan', { method: 'POST', member: true, body: { planId: plan.id } });
    member.currentPlanId = plan.id;
    paintCurrentPlan();
    $('plan-search').value = '';
    renderPlanMatches();
    say('plan-status', '저장했어요. 이 요금제 기준으로 점검해요.');
    loadDetections();                         // 혜택 중복은 현재 요금제에 달려 있다
  } catch (error) {
    say('plan-status', message(error));
  }
}

$('plan-search').addEventListener('input', renderPlanMatches);

/* ── 내 구독 (GET/POST/DELETE /api/v1/me/subscriptions) ── */

async function loadServices() {
  try {
    services = await loadCatalog();
    const select = $('sub-service');
    select.replaceChildren(...services.map(service => {
      const option = el('option', undefined, `${service.icon} ${service.name}`);
      option.value = String(service.id);
      return option;
    }));
    renderTierOptions();
    // 이미 그려진 목록이 있으면 서비스 이름을 붙여 다시 그린다(빈 목록이면 회원 데이터를 기다린다).
    if (subscriptions.length) renderSubscriptions(subscriptions);
    if (findings.length) renderDetections(findings);
  } catch (error) {
    say('sub-status', message(error));
  }
}

/** 등급을 고르면 공식 가격을 채운다 — 빈 입력창을 사용자에게 떠넘기지 않는다(원칙 5-②). */
function renderTierOptions() {
  const service = services.find(item => String(item.id) === $('sub-service').value);
  const select = $('sub-tier');
  select.replaceChildren(...(service?.tiers ?? []).map(tier => {
    const option = el('option', undefined, `${tier.name} · ${tierPrice(tier)}`);
    option.value = String(tier.id);
    return option;
  }));
  fillPrice();
}

function fillPrice() {
  const tier = services.flatMap(service => service.tiers).find(item => String(item.id) === $('sub-tier').value);
  if (!tier) return;
  // 해외 결제는 환율 환산 추정치를 채워 주고 사용자가 실제 결제액으로 고치게 한다(원칙 5-②).
  const guess = tierKrwGuess(tier);
  $('sub-price').value = guess === null ? '' : String(guess);
  say('sub-status', guess === null || tier.currency === 'KRW'
    ? '등급을 고르면 공식 가격을 채워드려요. 실제 내는 금액과 다르면 고쳐 주세요.'
    : `해외 결제라 원화가 확정되지 않아 ${tier.krwRateDate} 환율로 환산한 추정치예요. 실제 결제액으로 고쳐 주세요.`);
}

$('sub-service').addEventListener('change', renderTierOptions);
$('sub-tier').addEventListener('change', fillPrice);

async function loadSubscriptions() {
  try {
    const { data } = await request('/api/v1/me/subscriptions', { member: true });
    renderSubscriptions(data);
  } catch (error) {
    say('sub-status', message(error));
  }
}

function renderSubscriptions(rows) {
  subscriptions = rows;
  $('sub-rows').replaceChildren(...(rows.length ? rows.map(subscriptionRow)
    : [el('li', 'empty-row', '등록한 구독이 없어요. 아래에서 추가하면 중복 결제를 점검해 드려요.')]));
  const total = rows.reduce((sum, row) => sum + row.monthlyPrice, 0);
  $('subs-total').textContent = rows.length ? `${rows.length}개 · 월 ${won(total)}` : '';
}

/** BE 는 등급 이름만 준다. 어떤 서비스의 등급인지는 카탈로그에서 찾아 붙인다(못 찾으면 등급 이름만). */
function tierLabel(tierId, tierName) {
  const service = services.find(item => item.tiers.some(tier => tier.id === tierId));
  return service ? `${service.icon} ${service.name} · ${tierName}` : tierName;
}

function subscriptionRow(row) {
  const item = el('li', 'sub-row');
  item.append(el('span', 'sub-name', tierLabel(row.tierId, row.tierName)),
    el('span', 'sub-price', won(row.monthlyPrice)));
  const remove = el('button', 'sub-remove', '삭제');
  remove.type = 'button';
  remove.addEventListener('click', async () => {
    remove.disabled = true;
    try {
      await request(`/api/v1/me/subscriptions/${row.id}`, { method: 'DELETE', member: true });
      await loadSubscriptions();
      loadDetections();
    } catch (error) {
      say('sub-status', message(error));
      remove.disabled = false;
    }
  });
  item.append(remove);
  return item;
}

$('sub-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('sub-form').querySelector('button[type="submit"]');
  let body;
  try {
    body = {
      tierId: integer($('sub-tier').value, '구독 등급', 1),
      monthlyPrice: integer($('sub-price').value, '월 결제액'),
    };
  } catch (error) {
    say('sub-status', error.message);
    return;
  }
  button.disabled = true;
  say('sub-status', '추가하는 중…');
  try {
    await request('/api/v1/me/subscriptions', { method: 'POST', member: true, body });
    await loadSubscriptions();
    say('sub-status', '추가했어요.');
    loadDetections();
  } catch (error) {
    say('sub-status', message(error));
  } finally {
    button.disabled = false;
  }
});

/* ── 중복 결제 점검 (GET /api/v1/me/detections) ── */

async function loadDetections() {
  say('detect-status', '점검하는 중…');
  try {
    const { data } = await request('/api/v1/me/detections', { member: true });
    renderDetections(data);
  } catch (error) {
    say('detect-status', message(error));
  }
}

function renderDetections(rows) {
  findings = rows;
  const total = rows.reduce((sum, finding) => sum + finding.wastedAmount, 0);
  // 결론을 먼저 낸다(원칙 5-③): 월·연 낭비 금액 한 줄.
  $('detect-total').textContent = total ? `월 ${won(total)} · 1년 ${won(total * 12)}` : '';
  $('detect-total').classList.toggle('warn-now', total > 0);
  $('detect-rows').replaceChildren(...rows.map(detectionRow));
  say('detect-status', rows.length
    ? '해지·변경은 각 서비스에서 직접 해주세요. 요고비는 금액만 알려드려요.'
    : (member.currentPlanId ? '중복으로 새는 금액이 없어요.'
      : '현재 요금제를 저장하면 요금제 혜택과 겹치는 구독까지 찾아드려요.'));
}

function detectionRow(finding) {
  const [title, how] = RULES[finding.rule] ?? [finding.rule, ''];
  const item = el('li', 'detect-row');
  const head = el('div', 'detect-head');
  head.append(el('strong', undefined, title), el('span', 'detect-amount', `월 ${won(finding.wastedAmount)}`));
  item.append(head, el('p', 'detect-target', targetName(finding.targetRef)), el('p', 'detect-how', how));
  return item;
}

/** BE 가 주는 참조는 `service:{id}` / `bundle:{id}` 다. 서비스는 카탈로그 이름으로 바꾸고, 나머지는 그대로 둔다. */
function targetName(targetRef) {
  const [kind, id] = String(targetRef).split(':');
  if (kind === 'service') {
    const service = services.find(item => String(item.id) === id);
    return service ? `${service.icon} ${service.name}` : `서비스 #${id}`;
  }
  return kind === 'bundle' ? '묶음 상품' : targetRef;
}
