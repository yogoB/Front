// 구독 카탈로그는 BE 가 원본이다(검수 CSV → DB). 프론트는 가격을 만들지 않는다 — 절대 원칙 2·4.
import { request } from './api.js';

// 화면용 아이콘만 프론트가 가진다(가격·등급은 전부 BE 값).
// 이름에 없으면 카테고리로, 그것도 없으면 기본 아이콘 — 새 서비스가 늘어도 📦만 줄줄이 나오지 않는다.
const ICONS = {
  '넷플릭스': '🎬', '유튜브 프리미엄': '▶️', '티빙': '📺', '웨이브': '🌊', '왓챠': '🎞️',
  '쿠팡플레이': '🛒', '디즈니+': '✨', '애플TV+': '🍎',
  '멜론': '🍈', '지니뮤직': '🧞', 'FLO': '🌊', '벅스': '🐞',
  'Spotify': '🟢', 'Apple Music': '🎧', 'YouTube Music': '🎶',
  'Gemini': '♊', 'ChatGPT': '🤖', 'Claude': '🧠', 'Perplexity': '🔎',
  '리디셀렉트': '📖', '윌라': '🎧', '크레마클럽': '📚', '교보 sam': '📕',
  'iCloud+': '☁️', 'Microsoft 365': '🗂️', 'Dropbox': '📦',
};
const CATEGORY_ICONS = { OTT: '📺', VIDEO_MUSIC: '▶️', MUSIC: '🎵', AI: '🤖', EBOOK: '📚', CLOUD: '☁️' };

/** GET /api/v1/catalog/services → 화면이 쓰는 {id, name, icon, tiers[]}. 등급이 없는 서비스는 고를 수 없으므로 뺀다. */
export async function loadCatalog(signal) {
  const { data } = await request('/api/v1/catalog/services', { signal });
  return data
    .map(service => ({
      id: service.id,
      name: service.name,
      category: service.category,
      icon: ICONS[service.name] ?? CATEGORY_ICONS[service.category] ?? '📦',
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
