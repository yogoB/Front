/** 선택 칩. 고르면 BE optional 로 넘어가고 "잘 모르겠어요"(빈 값)면 보내지 않는다 —
    그래야 missingInputs 안내가 그대로 남는다(원칙 5-①). */
export function Choice({ label, active, onClick, wide }) {
  const base = 'cursor-pointer border text-sm font-semibold transition';
  const tone = active
    ? 'border-brand bg-brand-tint text-brand-ink'
    : 'border-line bg-white text-ink-soft hover:border-[#d9d9e2]';
  return (
    <button type="button" onClick={onClick}
            className={`${base} ${tone} ${wide ? 'w-full rounded-xl px-4.5 py-4 text-left' : 'rounded-full px-4.5 py-2.5'}`}>
      {label}
    </button>
  );
}

/** 값 하나를 고르는 묶음. value 가 null 이면 아무것도 고르지 않은 상태다. */
export function ChoiceGroup({ label, hint, options, value, onChange, stack }) {
  return (
    <div className="mt-5">
      {label && <p className="mb-2.5 text-sm font-bold text-ink-soft">{label}</p>}
      {hint && <p className="mb-2.5 text-sm text-muted">{hint}</p>}
      <div className={stack ? 'flex flex-col gap-2.5' : 'flex flex-wrap gap-2.5'} role="group" aria-label={label}>
        {options.map(([val, text]) => (
          <Choice key={text} label={text} wide={stack} active={value === val} onClick={() => onChange(val)} />
        ))}
      </div>
    </div>
  );
}
