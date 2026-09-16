// 구독 카탈로그는 BE 가 원본이다(검수 CSV → DB). 프론트는 가격을 만들지 않는다 — 절대 원칙 2·4.
import { request } from './api.js';

// 화면용 아이콘만 프론트가 가진다. 이름이 없으면 기본 아이콘을 쓴다(가격·등급은 전부 BE 값).
const ICONS = {
  '넷플릭스': '🎬', '유튜브 프리미엄': '▶️', '티빙': '📺', '웨이브': '🌊',
  '쿠팡플레이': '🛒', '디즈니+': '✨', '애플TV+': '🍎', '멜론': '🎵', '스포티파이': '🟢',
};

/** GET /api/v1/catalog/services → 화면이 쓰는 {id, name, icon, tiers[]}. 등급이 없는 서비스는 고를 수 없으므로 뺀다. */
export async function loadCatalog(signal) {
  const { data } = await request('/api/v1/catalog/services', { signal });
  return data
    .map(service => ({
      id: service.id,
      name: service.name,
      icon: ICONS[service.name] ?? '📦',
      tiers: service.tiers.map(tier => ({ id: tier.id, name: tier.name, price: tier.price })),
    }))
    .filter(service => service.tiers.length > 0);
}

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

// 디테일 모드 통신사. 알뜰폰 브랜드는 BE currentCarrier enum에 개별로 없으므로 '알뜰폰'으로 매핑한다.
// ponytail: 매핑은 mvnoCarrier 플래그로 표시만; 실제 전송은 결과 연동 단계에서 처리.
export const CARRIERS = [
  { name: 'SKT', mvno: false },
  { name: 'KT', mvno: false },
  { name: 'LG U+', mvno: false },
  { name: '세븐모바일', mvno: true },
  { name: 'M모바일', mvno: true },
  { name: '헬로모바일', mvno: true },
  { name: '스노우맨', mvno: true },
];
