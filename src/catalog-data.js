// 목업 구독 카탈로그. Figma 화면을 BE 없이도 채우기 위한 임시 데이터.
// ponytail: 정적 목업. 운영에선 GET /api/v1/catalog/services 응답으로 교체한다(같은 형태 유지).
export const CATALOG = [
  { id: 1, name: '넷플릭스', icon: '🎬', tiers: [
    { id: 101, name: '광고형 스탠다드', price: 5500 },
    { id: 102, name: '스탠다드', price: 13500 },
    { id: 103, name: '프리미엄 4K', price: 17000 } ] },
  { id: 2, name: '유튜브 프리미엄', icon: '▶️', tiers: [
    { id: 201, name: '학생', price: 8690 },
    { id: 202, name: '개인', price: 14900 },
    { id: 203, name: '가족', price: 30900 } ] },
  { id: 3, name: '티빙', icon: '📺', tiers: [
    { id: 301, name: '광고형', price: 5500 },
    { id: 302, name: '베이직', price: 9500 },
    { id: 303, name: '스탠다드', price: 13900 } ] },
  { id: 4, name: '웨이브', icon: '🌊', tiers: [
    { id: 401, name: '베이직', price: 7900 },
    { id: 402, name: '스탠다드', price: 10900 },
    { id: 403, name: '프리미엄', price: 13900 } ] },
  { id: 5, name: '쿠팡플레이', icon: '🛒', tiers: [
    { id: 501, name: '와우 멤버십', price: 7890 } ] },
  { id: 6, name: '디즈니+', icon: '✨', tiers: [
    { id: 601, name: '스탠다드', price: 9900 },
    { id: 602, name: '프리미엄', price: 13900 } ] },
  { id: 7, name: '애플TV+', icon: '🍎', tiers: [
    { id: 701, name: '개인', price: 9900 } ] },
  { id: 8, name: '멜론', icon: '🎵', tiers: [
    { id: 801, name: '스트리밍', price: 10900 } ] },
  { id: 9, name: '스포티파이', icon: '🟢', tiers: [
    { id: 901, name: '개인', price: 10900 },
    { id: 902, name: '듀오', price: 16350 } ] },
];

// 데이터 사용량 구간. rep = BE(monthlyDataGb 정수) 전송용 대표값(구간 중앙값). 흐름 확정본 결정 사항.
export const DATA_BUCKETS = [
  { label: '3GB 미만', rep: 2 },
  { label: '3~5GB', rep: 4 },
  { label: '5~15GB', rep: 10 },
  { label: '15~50GB', rep: 30 },
  { label: '50GB 이상', rep: 80 },
  { label: '무제한', rep: 100 },
];

// 통신비 구간. 통신비는 현재 추천 계산에 미반영(메모)이라 rep는 화면 표시용.
export const FEE_BUCKETS = [
  { label: '3만원 미만', rep: 25000 },
  { label: '3~5만원', rep: 40000 },
  { label: '5~7만원', rep: 60000 },
  { label: '7만원 이상', rep: 80000 },
];
