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
      // 해외 결제 등급은 통화와 원화 환산(BE 가 하루 1회 환율로 계산한 표시용 값)을 함께 들고 온다.
      tiers: service.tiers.map(tier => ({
        id: tier.id, name: tier.name, price: tier.price,
        currency: tier.currency ?? 'KRW', taxIncluded: tier.taxIncluded ?? true,
        krwEstimate: tier.krwEstimate ?? null,
        krwRateDate: tier.krwRateDate ?? null,
      })),
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

/* 디테일 모드 통신사 — 카탈로그에서 뽑는다.
   예전에는 7개를 여기 적어 뒀는데 실제 카탈로그는 21개였고 이름도 달랐다("M모바일" vs 실제 "KT엠모바일",
   "스노우맨"은 아예 없음). 그래서 "kt" 를 쳐도 KT엠모바일이 안 나왔다 — 걸릴 문자열 자체가 없었다.
   목록을 적어 두는 한 카탈로그와 어긋나는 건 시간 문제라, 적지 않는다.

   MNO/MVNO 구분은 BE 의 carrier_type 파생 규칙과 같다(docs/domain.md §2 "통신사 종류 파생"):
   SKT·KT·LG U+ 만 MNO 이고 나머지는 전부 MVNO. */
const MNO = new Set(['SKT', 'KT', 'LG U+']);

export async function loadCarriers(signal) {
  const { data } = await request('/api/v1/catalog/plans', { signal });
  return [...new Set(data.map(plan => plan.carrier))]
    .sort((a, b) => a.localeCompare(b, 'ko'))
    .map(name => ({ name, mvno: !MNO.has(name) }));
}
