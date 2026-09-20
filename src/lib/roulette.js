/** 같은 금액 자리에 바로 머물지 않도록 다음 표본 인덱스를 고른다. */
export function nextSampleIndex(current, length, random = Math.random) {
  if (length < 2) return 0;
  const offset = Math.min(length - 1, Math.max(1, Math.floor(random() * (length - 1)) + 1));
  return (current + offset) % length;
}
