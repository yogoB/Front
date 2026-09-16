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
    if (!count) return 0;
    $(id).textContent = `${count.toLocaleString('ko-KR')}개`;
    $(id).closest('.stat').hidden = false;   // 숫자를 받은 카드만 보인다
    return count;
  })
  .catch(() => 0);                           // 못 받으면 숨은 채로 둔다 — 지어낸 수치를 걸지 않는다
const plans = countInto('stat-plans', '/api/v1/catalog/plans');
// 등급이 없는 서비스는 화면에서 고를 수 없다(catalog-data.js loadCatalog 와 같은 기준) — 세지 않는다.
const services = countInto('stat-services', '/api/v1/catalog/services', service => service.tiers?.length > 0);

// 히어로 옆 한 줄도 같은 실제 값으로만 채운다. 하나라도 못 받으면 줄 자체를 띄우지 않는다
// ("평균 절감액"·"이용자 수" 같은 값은 우리가 갖고 있지 않다).
Promise.all([plans, services]).then(([planCount, serviceCount]) => {
  if (!planCount || !serviceCount) return;
  const box = $('hero-stat');
  box.replaceChildren(
    document.createTextNode('요금제 '),
    Object.assign(document.createElement('b'), { textContent: planCount.toLocaleString('ko-KR') }),
    document.createTextNode('개 · 구독 '),
    Object.assign(document.createElement('b'), { textContent: serviceCount.toLocaleString('ko-KR') }),
    document.createTextNode('개를 한 번에 비교'));
  box.hidden = false;
});
