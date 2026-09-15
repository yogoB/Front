// 임시: 라이트/디테일 입력이 결과 화면까지 잘 전달됐는지 확인용. 다음 단계에서 실제 결과표로 교체.
const raw = sessionStorage.getItem('yogobi:input');
const echo = document.getElementById('echo');
if (!raw) { echo.textContent = '전달된 입력이 없어요. 모드 선택부터 다시 시작해 주세요.'; }
else {
  const input = JSON.parse(raw);
  const won = n => `${n.toLocaleString('ko-KR')}원`;
  const lines = [
    `모드: ${input.mode}`,
    `데이터: ${input.data ? input.data.label + ` (전송값 ${input.data.gb}GB)` : '모름'}`,
    `통신비: ${input.fee ? input.fee.label + ' · ' + won(input.fee.amount) : '모름'}`,
    `구독(${input.subs.length}):`,
    ...input.subs.map(s => `  · ${s.name} — ${s.tierName} ${won(s.price)}`),
  ];
  echo.textContent = lines.join('\n');
}
