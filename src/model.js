export const won = amount => `${amount.toLocaleString('ko-KR')}원`;
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
  return optional;
}

export function recommendationRequest(values, subscriptions) {
  if (subscriptions.some(s => s.wanted && s.unavailable)) throw new Error('목록에서 변경된 구독을 삭제하고 다시 선택해 주세요.');
  const monthlyDataGb = integer(values.monthlyDataGb, '월 데이터 사용량', 1, 2147483647);
  const wantedServiceIds = subscriptions.filter(s => s.wanted).map(s => s.id);
  if (!wantedServiceIds.length) throw new Error('추천에 포함할 구독 서비스를 하나 이상 골라주세요.');
  return { required: { monthlyDataGb, wantedServiceIds }, optional: optionalInputs(values) };
}

export function calculatorRequest(planId, optional, subscriptions) {
  if (subscriptions.some(s => s.wanted && s.unavailable)) throw new Error('목록에서 변경된 구독을 삭제하고 다시 선택해 주세요.');
  const tierIds = subscriptions.filter(s => s.wanted).map(s => integer(s.tierId, '구독 등급', 1));
  if (!tierIds.length) throw new Error('계산할 구독 등급을 하나 이상 골라주세요.');
  return { planId: integer(planId, '요금제', 1), tierIds, optional };
}

export function validPassword(password) {
  if ([...password].length < 15 || new TextEncoder().encode(password).length > 72)
    throw new Error('비밀번호를 15자 이상, 72바이트 이하로 입력해 주세요.');
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
