// 임시: 라이트/디테일 입력이 결과 화면까지 잘 전달됐는지 확인용. 다음 단계에서 실제 결과표로 교체.
const raw = sessionStorage.getItem('yogobi:input');
const echo = document.getElementById('echo');
const won = n => `${n.toLocaleString('ko-KR')}원`;
if (!raw) {
  echo.textContent = '전달된 입력이 없어요. 모드 선택부터 다시 시작해 주세요.';
} else {
  const input = JSON.parse(raw);
  const lines = [`모드: ${input.mode}`];
  if (input.carrier) lines.push(`통신사: ${input.carrier}${input.mvno ? ' (알뜰폰→BE 매핑)' : ''}`);
  if (input.contract) lines.push(`약정: ${input.contract.has ? '있음' + (input.contract.endDate ? ` · 종료 ${input.contract.endDate}` : '') : '없음'}`);
  lines.push(`${input.mode === 'detail' ? '희망 ' : ''}데이터: ${input.data ? input.data.label + ` (전송값 ${input.data.gb}GB)` : '모름'}`);
  if (input.fee) lines.push(`통신비: ${input.fee.label} · ${won(input.fee.amount)}`);
  lines.push(`구독(${input.subs.length}):`);
  for (const s of input.subs) {
    const disp = s.disposition ? ` [${s.disposition}]` : '';
    const tier = s.tierName ? ` — ${s.tierName} ${won(s.price)}` : '';
    lines.push(`  · ${s.name}${tier}${disp}`);
  }
  echo.textContent = lines.join('\n');
}
