// 결과 비교표. 금액·순서·출처는 전부 BE(POST /api/v1/recommendations)가 만든다 — 절대 원칙 2·4.
// '현재' 열만 사용자가 입력한 값의 합계이며, 화면에도 그렇게 적는다.
import { request, ApiError } from './api.js';
import { provenance, splitLines } from './model.js';

const $ = id => document.getElementById(id);
const won = n => `₩${n.toLocaleString('ko-KR')}`;
// 데이터 사용량을 건너뛴 경우의 계산 기준. 숨기지 않고 화면에 근거로 적는다(절대 원칙 5-①).
const DEFAULT_GB = 10;

/** 한 줄씩 끊어 넣는다. 배열이면 그 항목대로, 문자열이면 문장(./!/?) 경계로 잘라
    긴 설명이 줄 중간에서 끊기지 않게 한다. textContent 만 쓰므로 마크업으로 해석되지 않는다. */
function lines(parent, parts) {
  parent.replaceChildren(...splitLines(parts).map(text => {
    const line = document.createElement('span');
    line.className = 'line';
    line.textContent = text;
    return line;
  }));
}

const input = JSON.parse(sessionStorage.getItem('yogobi:input') || 'null');
if (!input) {
  $('empty').hidden = false;
} else {
  start(input);
}

/** 유지하기로 한 구독만 추천 대상이다(디테일 모드의 '해지'는 제외). */
function keptSubs(source) {
  return (source.subs || []).filter(s => !s.disposition || s.disposition === '유지');
}

function buildRequest(source) {
  const optional = {};
  // 알뜰폰 브랜드는 BE 가 개별로 알지 못하므로 묶어서 보낸다(catalog-data.js CARRIERS 와 같은 규칙).
  if (source.carrier) optional.currentCarrier = source.mvno ? '알뜰폰' : source.carrier;
  // 디테일 모드에서 고른 값만 보낸다. 모른다고 한 값은 빼서 missingInputs 안내가 그대로 남는다(5-①).
  if (source.networkType) optional.networkType = source.networkType;
  if (source.contractType) optional.contractType = source.contractType;
  if (typeof source.hasFamilyBundle === 'boolean') optional.hasFamilyBundle = source.hasFamilyBundle;
  return {
    required: {
      monthlyDataGb: source.data?.gb ?? DEFAULT_GB,
      wantedServiceIds: keptSubs(source).map(s => s.id),
    },
    optional,
  };
}

async function start(source) {
  if (!keptSubs(source).length) { fail('추천에 포함할 구독 서비스를 고르지 않았어요. 다시 선택해 주세요.'); return; }
  try {
    const { data } = await request('/api/v1/recommendations', { method: 'POST', body: buildRequest(source) });
    render(source, data);
  } catch (error) {
    fail(error instanceof ApiError ? error.message : '추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

function fail(message) {
  $('empty').hidden = false;
  const paragraph = $('empty').querySelector('p');
  if (paragraph) paragraph.textContent = message;
}

function render(source, data) {
  $('results').hidden = false;
  $('upsell').hidden = source.mode !== 'light';

  const best = data.results[0];
  renderNotices(source, data, best);
  if (!best) return;                       // 카탈로그 결손(G-12): 안내만 남기고 표는 채우지 않는다

  renderHeadline(source, best);
  renderCurrentColumn(source);
  renderPlanRows(source, best);
  renderReasons(data);
  renderBreakdown(best);
  renderCrossCheck(best);
  renderTotals(source, best);
  gateForGuests(best);
  wireReport(best);
  fillPlanSpecs(source, best);
}

/* 요금제가 실제로 주는 양(데이터·음성·문자)은 카탈로그가 원본이다(GET /api/v1/catalog/plans).
   금액 표시를 붙잡아 두지 않도록 표를 먼저 그린 뒤 배경에서 받아 채운다. 실패하면 있던 문구를 그대로 둔다. */
const UNLIMITED = 999999;                     // 시드 규칙: 무제한은 숫자 999999 (docs/data.md §7)
const amountText = (value, unit) =>
  value === null || value === undefined ? '공식 표기 없음'
    : value >= UNLIMITED ? '무제한' : `${value.toLocaleString('ko-KR')}${unit}`;
const dataText = mb =>
  mb >= UNLIMITED ? '무제한'
    : mb % 1024 === 0 ? `${mb / 1024}GB` : `${(mb / 1024).toFixed(1)}GB`;

async function fillPlanSpecs(source, best) {
  let plan;
  try {
    const { data } = await request('/api/v1/catalog/plans');
    plan = data.find(row => row.id === best.planId);
  } catch { /* 카탈로그를 못 받으면 기존 문구를 유지한다 */ }
  const voice = plan
    ? `음성 ${amountText(plan.voiceMin, '분')} · 문자 ${amountText(plan.smsCnt, '건')}`
    : '확인 필요';
  $('rec-voice').textContent = voice;
  $('low-voice').textContent = voice;
  if (!plan) return;
  const asked = source.data ? source.data.label : `${DEFAULT_GB}GB`;
  const label = `${dataText(plan.dataMb)} (요청 ${asked} 충족)`;
  $('rec-data').textContent = label;
  $('low-data').textContent = label;
}

/* 결론 먼저(절대 원칙 5-③) — 다만 금액은 하나도 만들지 않는다(절대 원칙 2).
   월·연 절감은 BE 의 monthlySavings·annualSavings 를 그대로 쓴다. 기준은 정가(baseline)이며
   사용자의 현재 청구액이 아니다(integration.md 결과 해석). 현재 지출은 표의 '현재' 열에만 둔다. */
function renderHeadline(source, best) {
  const box = $('save-hero');
  if (!box) return;

  if (best.monthlySavings > 0) {
    $('save-label').textContent = '정가 대비 매달';
    $('save-amount').textContent = won(best.monthlySavings);
    $('save-annual').textContent = `1년이면 ${won(best.annualSavings)}`;
  } else {
    $('save-label').textContent = '추천 조합은 매달';
    $('save-amount').textContent = won(best.monthlyTotal);
    $('save-annual').textContent = '정가보다 싼 조합을 찾지 못했어요';
  }
  $('save-rec').textContent = won(best.monthlyTotal);
  $('save-base').textContent = won(best.baseline);
  box.hidden = false;
}

/** 사용자가 입력한 현재 월 지출 합계 — 화면의 메모다(integration.md 입력 해석).
    표의 '현재' 열 표시에만 쓰고, 절감액 계산에는 절대 쓰지 않는다. 통신비를 건너뛰었으면 null. */
function currentTotal(source) {
  if (source.fee?.amount === undefined) return null;
  return source.fee.amount + keptSubs(source).reduce((sum, s) => sum + (s.price || 0), 0);
}

/* 현재 열 — 사용자가 입력한 값의 합계다. 입력이 없으면 지어내지 않는다. */
function renderCurrentColumn(source) {
  $('cur-plan').textContent = source.carrier ? `${source.carrier} · 현재 요금제` : '현재 요금제';
  $('cur-data').textContent = source.data ? source.data.label : '모름';
  lines($('cur-contract'), source.contract?.has
    ? ['약정 있음', source.contract.endDate && `종료 ${source.contract.endDate}`].filter(Boolean)
    : ['무약정']);
  $('cur-penalty').textContent = source.contract?.has ? '확인 필요' : '없음';
}

/* 추천·최저 열 — BE 값만 쓴다. 모르는 항목은 '확인 필요'로 두고 채워 넣지 않는다. */
function renderPlanRows(source, best) {
  const planLabel = `${best.carrier} ${best.planName}`;
  $('rec-plan').textContent = planLabel;
  $('low-plan').textContent = planLabel;                       // 같은 요금제의 정가 기준 열
  const dataLabel = source.data ? `${source.data.label} 충족` : `${DEFAULT_GB}GB 기준 충족`;
  $('rec-data').textContent = dataLabel;
  $('low-data').textContent = dataLabel;

  // 내역 줄의 금액은 '비용'이다. 제휴 혜택은 note 로 표시되므로 그 줄만 혜택으로 센다(비용을 혜택으로 적지 않는다).
  const benefits = best.breakdown.filter(line => line.note === '제휴 혜택 적용');
  const discounts = best.breakdown.filter(line => line.amount < 0);
  const asLines = (rows, empty) => rows.length
    ? rows.map(line => `${line.label} ${won(line.amount)}`) : [empty];
  lines($('rec-benefit'), asLines(benefits, '포함된 구독 혜택 없음'));
  lines($('rec-discount'), asLines(discounts, '적용된 할인 없음'));
}

// 추천 사유는 BE(/recommendations 응답의 reasons)가 만든다 — AI 큐레이션이며 요청에 없는 금액은
// BE·AI가 폐기한다(절대 원칙 1·2, D-19). AI 장애 시 빈 배열로 내려오고, 그때는 섹션을 숨긴다
// (보조 정보이므로 결과·금액은 그대로 유효 — 절대 원칙 5-④).
function renderReasons(data) {
  const reasons = Array.isArray(data.reasons) ? data.reasons : [];
  $('reason-list').closest('.reason').hidden = reasons.length === 0;
  $('reason-list').replaceChildren(...reasons.map(text => {
    const li = document.createElement('li'); lines(li, text); return li;
  }));
}

/* 근거는 접되 버리지 않는다(절대 원칙 5-④): 기본은 금액만, 펼치면 계산 과정과 출처. */
function renderBreakdown(best) {
  const list = $('breakdown-list');
  if (!list) return;
  list.replaceChildren(...best.breakdown.map(line => {
    const item = document.createElement('li');
    const label = document.createElement('span'); label.textContent = line.label;
    const amount = document.createElement('strong'); amount.textContent = won(line.amount);
    const source = document.createElement('em');
    source.textContent = provenance[line.provenance] ?? line.provenance;
    item.append(label, amount, source);
    if (line.note) { const note = document.createElement('p'); note.textContent = line.note; item.append(note); }
    return item;
  }));
  $('breakdown').hidden = false;
}

/* 스마트초이스 공식 시세 대조 결과(BE priceCrossCheck). 표시 전용이며 금액을 바꾸지 않는다.
   확인 못 한 경우를 "틀렸다"로 보이게 적지 않는다 — 서버가 준 status 를 그대로 옮긴다. */
function renderCrossCheck(best) {
  const box = $('cross-check');
  const check = best.priceCrossCheck;
  if (!box || !check) return;
  if (check.status === 'MATCH') {
    box.textContent = `요금제 기본료가 스마트초이스 공식 시세(${won(check.officialPrice)})와 같아요.`;
    box.className = 'cross-check ok';
  } else if (check.status === 'MISMATCH') {
    box.textContent = `스마트초이스 공식 시세는 ${won(check.officialPrice)}로 나와요. 카탈로그 값과 달라서 확인 중이에요.`;
    box.className = 'cross-check warn';
  } else if (check.status === 'NOT_APPLICABLE') {
    // 알뜰폰은 스마트초이스가 응답에 주지 않는다. "나중에 확인될 수도 있다"는 기대를 주지 않는다.
    box.textContent = '알뜰폰 요금제는 스마트초이스 시세 대조 대상이 아니에요(통신 3사만 제공). 금액 출처는 계산 근거에서 볼 수 있어요.';
    box.className = 'cross-check';
  } else {
    box.textContent = '이 요금제는 아직 스마트초이스 시세로 대조하지 못했어요. 값이 틀렸다는 뜻은 아니에요.';
    box.className = 'cross-check';
  }
  box.hidden = false;
}

/* 모르면 막히지 않는다(절대 원칙 5-①): 빠진 입력과 카탈로그 결손을 그대로 안내한다. */
function renderNotices(source, data, best) {
  const notices = [];
  if (!source.data) notices.push(`데이터 사용량을 건너뛰어 ${DEFAULT_GB}GB 기준으로 계산했어요. 실제 사용량을 넣으면 결과가 정확해져요.`);
  for (const missing of data.missingInputs || []) notices.push(`${missing.impact} — ${missing.howToFind}`);
  if (!best) notices.push('조건에 맞는 요금제를 아직 찾지 못했어요. 조건을 바꾸거나 잠시 후 다시 시도해 주세요.');
  const box = $('notices');
  if (!box) return;
  box.replaceChildren(...notices.map(text => {
    const item = document.createElement('li'); lines(item, text); return item;
  }));
  box.hidden = notices.length === 0;
}

/* 총액은 전부 그대로 출력한다. 기간 환산(6·12개월)은 프론트 곱셈으로만 존재하던 값이라 없앴다 —
   BE 가 주는 기간은 월과 연(annualSavings)뿐이다. 필요해지면 계약 변경을 먼저 제안한다. */
function renderTotals(source, best) {
  const current = currentTotal(source);
  $('cur-total').textContent = current === null ? '—' : won(current);   // 입력값 합계(메모)
  $('rec-total').textContent = won(best.monthlyTotal);
  $('low-total').textContent = won(best.baseline);
  $('rec-save').textContent = best.monthlySavings > 0 ? `정가 대비 월 ${won(best.monthlySavings)} 절감` : '';

  // 캘린더가 같은 숫자를 쓰도록 결과를 넘긴다(절대 원칙 5-⑤: 같은 숫자는 같은 출처).
  sessionStorage.setItem('yogobi:result', JSON.stringify({
    planId: best.planId,                       // 캘린더가 /me/switch-timing 에 넘길 대상 요금제
    currentTotal: current, planLabel: `${best.carrier} ${best.planName}`,
    monthlyTotal: best.monthlyTotal, monthlySavings: best.monthlySavings, annualSavings: best.annualSavings,
  }));
}

/* 비회원 게이트. 결과는 계산해서 **절감액까지 보여주고** 상세는 로그인 뒤에 본다(제품 결정).
   블러는 가림막이지 접근 통제가 아니다 — 금액도 표도 공개 API 가 이미 내려준 값이고,
   개발자도구로 걷어낼 수 있다. 정말 막아야 할 값이 생기면 BE 가 내려주지 않아야 한다. */
function gateForGuests(best) {
  const gate = $('gate');
  if (!gate) return;
  request('/api/v1/me', { member: true })
    .then(() => { /* 회원이면 그대로 본다 */ })
    .catch(() => openGate(gate, best));
}

function openGate(gate, best) {
  document.getElementById('results').classList.add('gated');
  const lead = $('gate-lead');
  // 절감액은 BE 값 그대로다. 없으면 금액을 지어내지 않고 문장을 바꾼다.
  if (best.monthlySavings > 0) {
    lead.replaceChildren(document.createTextNode('최대 '));
    const amount = document.createElement('b');
    amount.textContent = won(best.monthlySavings);
    lead.append(amount, document.createTextNode(' 절감 받을 수 있어요.'));
  } else {
    lead.textContent = '지금 조건에 맞는 조합을 찾았어요.';
  }
  $('gate-login').addEventListener('click', () => {
    // 로그인 뒤 이 화면으로 돌아온다. 입력은 sessionStorage 에 있어 같은 탭이면 그대로 다시 계산된다.
    sessionStorage.setItem('yogobi:next', 'results.html');
    location.assign('./login.html');
  });
  $('gate-back').addEventListener('click', () => { location.assign('./#modes'); });
  // Esc 로 닫으면 블러만 남은 막다른 화면이 된다 — 나가는 길은 위 두 버튼뿐이다.
  gate.addEventListener('cancel', event => event.preventDefault());
  gate.showModal();
}

/* 정보 오류 제보(POST /api/v1/catalog/reports). 접수만 하고 카탈로그를 바꾸지 않는다 — BE 가 PENDING 으로 저장한다. */
function wireReport(best) {
  const form = $('report-form');
  if (!form) return;
  $('report-target').textContent = `${best.carrier} ${best.planName}`;
  $('report').hidden = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = $('report-status');
    const description = $('report-description').value.trim();
    if (!description) { status.textContent = '무엇이 다른지 적어주세요.'; return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = '보내는 중…';
    try {
      const { data } = await request('/api/v1/catalog/reports', {
        method: 'POST', member: true,          // 비회원도 되지만 CSRF 토큰은 필수다
        body: {
          targetType: 'MOBILE_PLAN', targetId: best.planId,
          field: $('report-field').value, description,
          sourceUrl: $('report-source').value.trim() || null,
        },
      });
      form.hidden = true;
      status.textContent = `접수됐어요 (번호 ${data.id}). 운영자가 공식 자료를 확인한 뒤 반영해요.`;
    } catch (error) {
      status.textContent = error instanceof ApiError ? error.message : '제보를 보내지 못했어요. 잠시 후 다시 시도해 주세요.';
      button.disabled = false;
    }
  });
}
