export const won = amount => `${amount.toLocaleString('ko-KR')}원`;
/** 문장(./!/?) 경계로 자른 줄 목록. 배열이면 그대로 쓴다.
    긴 설명·목록이 줄 중간에서 끊기지 않도록 화면이 한 줄씩 그린다. */
export const splitLines = parts =>
  (Array.isArray(parts) ? parts : String(parts).split(/(?<=[.!?])\s+/)).filter(Boolean);

/** 검색 비교용으로 다듬는다 — 공백과 대소문자를 무시한다.
    "요고38"로도 "KT 요고 38"을 찾게 한다. 사용자는 공식 표기의 띄어쓰기를 기억하지 않는다. */
export const searchKey = text => String(text ?? '').toLowerCase().replace(/\s+/g, '');

/** needle 이 haystack 에 들어 있는가(공백·대소문자 무시). 빈 검색어는 항상 참. */
export const matches = (haystack, needle) => {
  const key = searchKey(needle);
  return !key || searchKey(haystack).includes(key);
};

/** 해외 결제 등급인가. 원화 확정 금액이 없어 계산에는 사용자가 확인한 금액이 필요하다. */
export const isForeign = tier => Boolean(tier?.currency) && tier.currency !== 'KRW';

/** 등급 금액 표시. 해외 결제는 표기 통화와 원화 환산(추정)을 함께 보여준다 — 환산값을 정가처럼 적지 않는다.
    표기가가 세금 별도면(해외 사업자 관행) 그 사실을 적는다. 환산값에는 이미 부가세 10%가 들어 있다. */
export const tierPrice = tier => !isForeign(tier) ? won(tier.price)
  : `${tier.currency === 'USD' ? '$' : tier.currency + ' '}${tier.price.toLocaleString('en-US')}`
    + (tier.taxIncluded === false ? ' + 세금 10%' : '')
    + (tier.krwEstimate ? ` · 약 ${won(tier.krwEstimate)}(추정)` : '');

/** 입력창에 채워 줄 기본 금액(원). 해외 결제는 환산 추정치를 넣고 사용자가 고치게 한다(원칙 5-②). */
export const tierKrwGuess = tier => isForeign(tier) ? (tier.krwEstimate ?? null) : tier.price;

export const provenance = { OFFICIAL: '공식 가격', DERIVED: '계산값', USER_PROVIDED: '사용자 입력', ESTIMATED: '추정값' };

export function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const text = String(value).trim();
  const number = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < min || number > max)
    throw new Error(`${label}: ${min.toLocaleString('ko-KR')}~${max.toLocaleString('ko-KR')} 사이의 정수로 입력해 주세요.`);
  return number;
}

export function optionalInputs(values) {
  const optional = {};
  if (values.currentCarrier) optional.currentCarrier = values.currentCarrier;
  if (values.networkType) optional.networkType = values.networkType;
  if (values.contractType) optional.contractType = values.contractType;
  if (['true', 'false'].includes(values.hasFamilyBundle)) optional.hasFamilyBundle = values.hasFamilyBundle === 'true';
  // 결합 중일 때만 회선 수·월 할인액을 보낸다(G-28). 빈 값·0 회선은 보내지 않는다 — missingInputs 안내가 그 자리를 채운다.
  // 할인액은 BE 가 사용자 입력(USER_PROVIDED)으로 그대로 빼고, 회선 수는 근거 문구에만 쓴다.
  if (optional.hasFamilyBundle) {
    const lines = whole(values.familyLineCount), discount = whole(values.familyBundleDiscountKrw);
    if (lines !== null && lines >= 2 && lines <= 10) optional.familyLineCount = lines;   // 2~10회선만(사용자 결정)
    if (discount !== null) optional.familyBundleDiscountKrw = discount;
  }
  return optional;
}

/** 0 이상 정수 문자열이면 숫자로, 아니면 null. 입력창 값은 문자열이라 여기서 한 번만 거른다. */
const whole = value => (/^\d+$/.test(String(value ?? '').trim()) ? Number(value) : null);

export function recommendationRequest(values, subscriptions) {
  if (subscriptions.some(s => s.wanted && s.unavailable)) throw new Error('목록에서 변경된 구독을 삭제하고 다시 선택해 주세요.');
  const monthlyDataGb = integer(values.monthlyDataGb, '월 데이터 사용량', 1, 2147483647);
  const wanted = subscriptions.filter(s => s.wanted);
  const wantedServiceIds = wanted.map(s => s.id);
  if (!wantedServiceIds.length) throw new Error('추천에 포함할 구독 서비스를 하나 이상 골라주세요.');
  // 고른 등급을 함께 보낸다. 계산기(calculatorRequest)는 이미 tierIds 로 보내고 있었는데 추천만
  // 서비스 id 로 보내, 같은 화면의 두 숫자가 다른 등급으로 계산되고 있었다(절대 원칙 3).
  const wantedTierIds = wanted.map(s => s.tierId).filter(Boolean);
  return {
    required: { monthlyDataGb, wantedServiceIds, ...(wantedTierIds.length ? { wantedTierIds } : {}) },
    optional: optionalInputs(values),
  };
}

export function calculatorRequest(planId, optional, subscriptions) {
  if (subscriptions.some(s => s.wanted && s.unavailable)) throw new Error('목록에서 변경된 구독을 삭제하고 다시 선택해 주세요.');
  const tierIds = subscriptions.filter(s => s.wanted).map(s => integer(s.tierId, '구독 등급', 1));
  if (!tierIds.length) throw new Error('계산할 구독 등급을 하나 이상 골라주세요.');
  return { planId: integer(planId, '요금제', 1), tierIds, optional };
}

// CSV cells are quoted and formula-like text is neutralized for spreadsheet applications.
export function comparisonCsv(results) {
  const rows = [['요금제 ID', '통신사', '요금제', '월 총액 (계산값)', '정가 합계 (계산값)', '월 절감액 (계산값)', '연 절감액 (계산값)', '항목', '금액', '출처', '설명']];
  for (const r of results) for (const line of r.breakdown) rows.push([
    r.planId, r.carrier, r.planName, r.monthlyTotal, r.baseline, r.monthlySavings, r.annualSavings,
    line.label, line.amount, line.provenance, line.note || ''
  ]);
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = String(value);
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
