// 랜딩 ↔ 모드선택 뷰 전환. Figma에서 별도 프레임이라 스크롤이 아니라 화면 교체로 처리.

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
