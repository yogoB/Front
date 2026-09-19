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

/** 띄어쓴 낱말을 **모두** 포함하는가(순서 무시). "SKT 청년"처럼 통신사 이름을 앞에 붙여 치는 사람이 많은데
    통짜 비교로는 "0 청년 다이렉트 62" 가 걸리지 않는다 — 실제로 "청년 요금제가 안 나온다"는 제보가 있었다(2026-09-18).
    drop 에 준 이름(고른 통신사)과 겹치는 낱말은 검색어에서 뺀다 — 이미 그 통신사 안에서 찾고 있기 때문이다. */
export const matchesAll = (haystack, query, drop = '') => {
  const skip = searchKey(drop);
  const words = String(query ?? '').trim().split(/\s+/).map(searchKey)
    .filter(word => word && !(skip && skip.includes(word)));
  const key = searchKey(haystack);
  return words.every(word => key.includes(word));
};

/** 해외 결제 등급인가. 원화 확정 금액이 없어 계산에는 사용자가 확인한 금액이 필요하다. */
export const isForeign = tier => Boolean(tier?.currency) && tier.currency !== 'KRW';

/** 표기 통화 금액. 세금 별도면(해외 사업자 관행) 그 사실을 함께 적는다 — 원화 환산값에는 이미 부가세 10%가 들어 있다. */
const foreignAmount = tier =>
  `${tier.currency === 'USD' ? '$' : tier.currency + ' '}${tier.price.toLocaleString('en-US')}`
  + (tier.taxIncluded === false ? ' + 세금 10%' : '');

/** 등급 금액 표시 — **목록에는 항상 원화로 적는다**(사용자 결정 2026-09-18). 해외 결제 등급은 원화 환산(추정)을
    적고, 표기 통화·세금 같은 근거는 화면이 작은 ⓘ 로 따로 보여준다(foreignNote).
    환산값이 없으면 원화를 지어내지 않고 표기 통화를 그대로 적는다 — 없는 숫자를 만들지 않는다(원칙 2·4). */
export const tierPrice = tier => !isForeign(tier) ? won(tier.price)
  : tier.krwEstimate ? `약 ${won(tier.krwEstimate)}(추정)`
  : foreignAmount(tier);

/** 원화 옆 ⓘ 에 띄울 근거 한 줄. 국내 결제이거나 이미 표기 통화를 적고 있으면 null — 같은 말을 두 번 하지 않는다. */
export const foreignNote = tier => isForeign(tier) && tier.krwEstimate
  ? `해외 결제 ${foreignAmount(tier)} 기준 · 환율에 따라 달라져요`
  : null;

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

/** 데이터 사용량을 건너뛴 경우의 계산 기준(GB). 숨기지 않고 화면에 적는다(원칙 5-①). */
export const DEFAULT_GB = 10;

/** 유지하기로 한 구독만 추천 대상이다(디테일 모드의 '해지'는 제외). */
/* 추천에 넣을 구독. 디테일이 '유지/해지'를 묻던 시절의 값(disposition)이 세션에 남아 있을 수 있어
   그때 '해지'로 찍힌 것만 걸러낸다 — 지금 화면은 쓰는 것만 받으므로 새 입력에는 이 값이 없다(2026-09-20). */
export const keptSubs = source => (source.subs || []).filter(s => !s.disposition || s.disposition === '유지');

/** 세션에 담아 둔 입력(Light·Detail 의 setInput)으로 `POST /recommendations` 본문을 만든다.
    **요청을 만드는 곳은 이 함수 하나다.** 전에는 같은 규칙이 화면(Results)과 이 파일에 따로 있어서,
    계약 테스트는 아무도 부르지 않는 쪽(recommendationRequest·calculatorRequest)을 검사하고 있었다.
    화면 쪽을 살리고 낡은 빌더를 지웠다(레거시 정리 2026-09-18). */
export function buildRequest(source) {
  const optional = {};
  // 통신사 이름을 그대로 보낸다. BE 는 금액에 쓰지 않고, 카탈로그에 없는 이름이면 결손(catalog_candidate)으로
  // 기록해 수집 우선순위를 만든다 — 그래서 '알뜰폰'으로 뭉뚱그리지 않는다(QA 2026-09-17).
  if (source.carrier) optional.currentCarrier = source.carrier;
  // 지금 쓰는 요금제(G-30). BE 가 '현재' 열을 같은 계산기로 내고 요금제의 통신사를 현재 통신사로 확정한다.
  if (source.currentPlanId) optional.currentPlanId = source.currentPlanId;
  // 모른다고 한 값은 빼서 missingInputs 안내가 그대로 남는다(원칙 5-①).
  if (source.networkType) optional.networkType = source.networkType;
  if (source.contractType) optional.contractType = source.contractType;
  if (typeof source.hasFamilyBundle === 'boolean') optional.hasFamilyBundle = source.hasFamilyBundle;
  // 결합 중일 때만 회선 수·월 할인액(G-28). 빈 값은 보내지 않는다 — 할인액이 없으면 BE 가 missingInputs 로 알려준다.
  // 할인액은 BE 가 사용자 입력(USER_PROVIDED)으로 그대로 빼고, 회선 수는 근거 문구에만 쓴다.
  if (source.hasFamilyBundle === true) {
    const lines = Number(source.familyLineCount), discount = Number(source.familyBundleDiscountKrw);
    if (source.familyLineCount !== '' && Number.isInteger(lines) && lines >= 2 && lines <= 10) optional.familyLineCount = lines;
    if (source.familyBundleDiscountKrw !== '' && Number.isInteger(discount) && discount >= 0) optional.familyBundleDiscountKrw = discount;
  }
  return {
    required: {
      monthlyDataGb: source.data?.gb ?? DEFAULT_GB,
      wantedServiceIds: keptSubs(source).map(s => s.id),
      // 사용자가 고른 등급을 그대로 보낸다. 없으면 BE 가 대표 등급을 고른다.
      wantedTierIds: keptSubs(source).map(s => s.tierId).filter(Boolean),
    },
    optional,
  };
}

/** 숫자만 남기고 상한에서 자른다. type=number 의 max 는 타이핑을 막지 못하므로 onChange 에서 처리한다.
    통신비는 FEE_MAX, 회선 수처럼 다른 상한은 인자로 받는다. */
/** 월 통신비·할인액 직접입력 상한(원). 라이트·디테일 공통 — 10만 넘는 요금제가 있어 100만(사용자 결정 2026-09-17). */
export const FEE_MAX = 1_000_000;

export const clampDigits = (text, max) => {
  const digits = String(text).replace(/\D/g, '');
  return digits && Number(digits) > max ? String(max) : digits;
};
