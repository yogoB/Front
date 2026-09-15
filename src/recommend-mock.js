// 데모 추천 계산. 실제 금액이 아니며 화면 구성을 위한 예시다.
// ponytail: 운영에선 POST /api/v1/recommendations 응답으로 대체한다. 결과·캘린더가 공유.
export function keptSubs(input) {
  return (input?.subs || []).filter(s => (s.disposition ? s.disposition === '유지' : true));
}

export function mockRecommendation(input) {
  const subs = keptSubs(input);
  const subsTotal = subs.reduce((a, s) => a + (s.price || 0), 0);
  const telecom = input?.fee?.amount ?? 55000;                 // 미입력 시 데모 기준값
  const currentTotal = telecom + subsTotal;                    // 현재 = 입력 합계(메모)
  const recTelecom = Math.round(telecom * 0.6 / 100) * 100;     // 데모: 다이렉트 요금제
  const firstSub = subs[0];
  const recSubs = subsTotal - (firstSub?.price || 0);          // 데모: 첫 OTT 번들 포함 0원
  const recTotal = recTelecom + recSubs;
  return { subs, currentTotal, recTotal, lowTotal: recTotal, firstSub };
}
