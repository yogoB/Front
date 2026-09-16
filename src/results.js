// 결과 비교표. 금액·순서·출처는 전부 BE(POST /api/v1/recommendations)가 만든다 — 절대 원칙 2·4.
// '현재' 열만 사용자가 입력한 값의 합계이며, 화면에도 그렇게 적는다.
import { request, ApiError } from './api.js';
import { provenance } from './model.js';

const $ = id => document.getElementById(id);
const won = n => `₩${n.toLocaleString('ko-KR')}`;
// 데이터 사용량을 건너뛴 경우의 계산 기준. 숨기지 않고 화면에 근거로 적는다(절대 원칙 5-①).
const DEFAULT_GB = 10;

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
  renderReasons(source, data, best);
  renderBreakdown(best);
  renderPeriodTabs(source, best);
  wireReport(best);
}

/* 결론을 먼저 낸다(절대 원칙 5-③): 입력하신 금액 대비 월·연 절감을 한 문장으로.
   두 수의 뺄셈만 하며 금액을 새로 만들지 않는다 — 추천 금액은 BE, 현재 금액은 사용자 입력이다. */
function renderHeadline(source, best) {
  const box = $('headline');
  if (!box) return;
  const current = currentTotal(source);
  if (current === null) {
    box.textContent = `추천 조합은 월 ${won(best.monthlyTotal)}이에요. 현재 내는 금액을 입력하면 절감액까지 보여드려요.`;
    box.hidden = false;
    return;
  }
  const saving = current - best.monthlyTotal;
  box.textContent = saving > 0
    ? `입력하신 금액보다 매달 ${won(saving)}, 1년이면 ${won(saving * 12)} 아낄 수 있어요.`
    : `입력하신 금액이 이미 추천 조합(월 ${won(best.monthlyTotal)})보다 저렴해요.`;
  box.hidden = false;
}

/** 사용자가 입력한 현재 월 지출 합계. 통신비를 건너뛰었으면 null(지어내지 않는다). */
function currentTotal(source) {
  if (source.fee?.amount === undefined) return null;
  return source.fee.amount + keptSubs(source).reduce((sum, s) => sum + (s.price || 0), 0);
}

/* 현재 열 — 사용자가 입력한 값의 합계다. 입력이 없으면 지어내지 않는다. */
function renderCurrentColumn(source) {
  $('cur-plan').textContent = source.carrier ? `${source.carrier} · 현재 요금제` : '현재 요금제';
  $('cur-data').textContent = source.data ? source.data.label : '모름';
  $('cur-contract').textContent = source.contract?.has
    ? `약정 있음${source.contract.endDate ? ` (종료 ${source.contract.endDate})` : ''}` : '무약정';
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
  $('rec-benefit').textContent = benefits.length
    ? benefits.map(line => `${line.label} ${won(line.amount)}`).join(', ') : '포함된 구독 혜택 없음';
  $('rec-discount').textContent = discounts.length
    ? discounts.map(line => `${line.label} ${won(line.amount)}`).join(', ') : '적용된 할인 없음';
}

function renderReasons(source, data, best) {
  const reasons = [];
  // 정가 대비 절감은 제휴 혜택·할인이 있을 때만 생긴다. 0원을 "절감"이라고 적지 않는다.
  reasons.push(best.monthlySavings > 0
    ? `💰 ${best.carrier} ${best.planName} 기준 월 ${won(best.monthlyTotal)}이에요. `
      + `정가 합계 ${won(best.baseline)}보다 월 ${won(best.monthlySavings)}·연 ${won(best.annualSavings)} 적어요.`
    : `💰 ${best.carrier} ${best.planName} 기준 월 ${won(best.monthlyTotal)}이에요. `
      + '이 요금제에 붙는 구독 제휴 혜택이 아직 카탈로그에 없어 정가 그대로예요.');
  if (data.results.length > 1) {
    const next = data.results[1];
    reasons.push(`📊 후보 ${data.results.length}개 중 가장 싼 조합이에요. 2순위는 ${next.carrier} ${next.planName} `
      + `월 ${won(next.monthlyTotal)}이에요.`);
  }
  reasons.push(source.contract?.has
    ? `🗓️ 약정이 남아 있어 위약금을 확인한 뒤 옮기는 게 안전해요${source.contract.endDate ? ` (종료 ${source.contract.endDate})` : ''}.`
    : '🗓️ 약정이 없어 언제든 옮길 수 있어요.');
  $('reason-list').replaceChildren(...reasons.map(text => {
    const li = document.createElement('li'); li.textContent = text; return li;
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

/* 모르면 막히지 않는다(절대 원칙 5-①): 빠진 입력과 카탈로그 결손을 그대로 안내한다. */
function renderNotices(source, data, best) {
  const notices = [];
  if (!source.data) notices.push(`데이터 사용량을 건너뛰어 ${DEFAULT_GB}GB 기준으로 계산했어요. 실제 사용량을 넣으면 결과가 정확해져요.`);
  for (const missing of data.missingInputs || []) notices.push(`${missing.impact} — ${missing.howToFind}`);
  if (!best) notices.push('조건에 맞는 요금제를 아직 찾지 못했어요. 조건을 바꾸거나 잠시 후 다시 시도해 주세요.');
  const box = $('notices');
  if (!box) return;
  box.replaceChildren(...notices.map(text => {
    const item = document.createElement('li'); item.textContent = text; return item;
  }));
  box.hidden = notices.length === 0;
}

function renderPeriodTabs(source, best) {
  const current = currentTotal(source);
  let period = 1;
  const paint = () => {
    $('cur-total').textContent = current === null ? '—' : won(current * period);
    $('rec-total').textContent = won(best.monthlyTotal * period);
    $('low-total').textContent = won(best.baseline * period);
    const label = period === 1 ? '월' : `${period}개월`;
    const versusInput = current === null ? 0 : current - best.monthlyTotal;
    $('rec-save').textContent = best.monthlySavings > 0
      ? `정가 대비 ${label} ${won(best.monthlySavings * period)} 절감`
      : versusInput > 0 ? `입력 금액 대비 ${label} ${won(versusInput * period)} 절감` : '';
  };
  $('period-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-period]');
    if (!button) return;
    period = Number(button.dataset.period);
    document.querySelectorAll('#period-tabs button').forEach(b => b.classList.toggle('active', b === button));
    paint();
  });
  paint();

  // 캘린더가 같은 숫자를 쓰도록 결과를 넘긴다(절대 원칙 5-⑤: 같은 숫자는 같은 출처).
  sessionStorage.setItem('yogobi:result', JSON.stringify({
    currentTotal: current, planLabel: `${best.carrier} ${best.planName}`,
    monthlyTotal: best.monthlyTotal, monthlySavings: best.monthlySavings, annualSavings: best.annualSavings,
  }));
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
