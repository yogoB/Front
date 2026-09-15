// 결과 비교표. 목업: '현재'는 입력값 단순 합계(허용된 메모), '추천·최저'는 예시 값(recommend-mock).
import { mockRecommendation } from './recommend-mock.js';

const $ = id => document.getElementById(id);
const won = n => `₩${n.toLocaleString('ko-KR')}`;

const input = JSON.parse(sessionStorage.getItem('yogobi:input') || 'null');
if (!input) {
  $('empty').hidden = false;
} else {
  render(input);
}

function render(input) {
  $('results').hidden = false;
  const m = mockRecommendation(input);

  // 라이트 모드에서만 디테일 유도 노출
  $('upsell').hidden = input.mode !== 'light';

  // 정적 셀(현재 열)
  $('cur-plan').textContent = input.carrier ? `${input.carrier} · 현재 요금제` : '현재 요금제';
  $('cur-data').textContent = input.data ? input.data.label : '—';
  $('cur-contract').textContent = input.contract?.has
    ? `약정 있음${input.contract.endDate ? ` (종료 ${input.contract.endDate})` : ''}` : '무약정';
  $('cur-penalty').textContent = input.contract?.has ? '변경 시 발생 가능' : '없음';
  if (m.firstSub) $('rec-benefit').textContent = `${m.firstSub.name} 번들 포함`;

  // 추천 사유(실제 선택 반영)
  const reasons = [];
  if (m.firstSub) reasons.push(`📺 ${m.firstSub.name}를 이용 중이라, 이 요금제에 번들로 포함되어 월 ${won(m.firstSub.price)}을 아낄 수 있어요.`);
  reasons.push(input.contract?.has
    ? `🗓️ 약정이 남아 있어 종료 시점${input.contract.endDate ? `(${input.contract.endDate})` : ''}에 맞춰 옮기면 위약금 없이 전환할 수 있어요.`
    : '🗓️ 약정이 없어 언제든 더 좋은 조건으로 이동할 수 있어요.');
  $('reason-list').replaceChildren(...reasons.map(t => {
    const li = document.createElement('li'); li.textContent = t; return li;
  }));

  // 기간 탭 (월 금액 × 개월)
  let period = 1;
  const paint = () => {
    $('cur-total').textContent = won(m.currentTotal * period);
    $('rec-total').textContent = won(m.recTotal * period);
    $('low-total').textContent = won(m.lowTotal * period);
    const save = (m.currentTotal - m.recTotal) * period;
    $('rec-save').textContent = save > 0 ? `${period === 1 ? '월' : period + '개월'} ${won(save)} 절감` : '';
  };
  $('period-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    period = Number(btn.dataset.period);
    document.querySelectorAll('#period-tabs button').forEach(b => b.classList.toggle('active', b === btn));
    paint();
  });
  paint();
}
