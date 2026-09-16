// 랜딩 ↔ 모드선택 뷰 전환. Figma에서 별도 프레임이라 스크롤이 아니라 화면 교체로 처리.
import { request } from './api.js';

const $ = id => document.getElementById(id);
const show = name => {
  const modes = name === 'modes';
  $('view-landing').hidden = modes;
  $('view-modes').hidden = !modes;
  if ((location.hash === '#modes') !== modes) location.hash = modes ? 'modes' : '';
  scrollTo(0, 0);
};
$('start-btn').addEventListener('click', () => show('modes'));
$('modes-back').addEventListener('click', () => show('landing'));
addEventListener('hashchange', () => show(location.hash === '#modes' ? 'modes' : 'landing'));
show(location.hash === '#modes' ? 'modes' : 'landing');

// 랜딩 지표는 실제 카탈로그 개수다. 마케팅 수치를 지어내지 않는다.
// BE 콜드스타트가 15초쯤 걸리므로 카드는 숨겨 두고 숫자를 받은 뒤 보여준다.
const countInto = (id, path, keep = () => true) => request(path)
  .then(({ data }) => {
    const count = Array.isArray(data) ? data.filter(keep).length : 0;
    if (!count) return;
    $(id).textContent = `${count.toLocaleString('ko-KR')}개`;
    $(id).closest('.stat').hidden = false;   // 숫자를 받은 카드만 보인다
  })
  .catch(() => {});                          // 못 받으면 숨은 채로 둔다 — 지어낸 수치를 걸지 않는다
countInto('stat-plans', '/api/v1/catalog/plans');
// 등급이 없는 서비스는 화면에서 고를 수 없다(catalog-data.js loadCatalog 와 같은 기준) — 세지 않는다.
countInto('stat-services', '/api/v1/catalog/services', service => service.tiers?.length > 0);
