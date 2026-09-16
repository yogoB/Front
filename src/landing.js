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

// 랜딩 지표는 실제 카탈로그 개수다. 마케팅 수치를 지어내지 않는다 — 못 받으면 카드를 숨긴다.
const countInto = (id, path) => request(path)
  .then(({ data }) => {
    if (!Array.isArray(data) || !data.length) throw new Error('empty');
    $(id).textContent = `${data.length.toLocaleString('ko-KR')}개`;
  })
  .catch(() => { $(id).closest('.stat').hidden = true; });
countInto('stat-plans', '/api/v1/catalog/plans');
countInto('stat-services', '/api/v1/catalog/services');
