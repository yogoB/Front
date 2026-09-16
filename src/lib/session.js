/** 화면 사이로 넘기는 값. 서버에 저장하지 않고 이 탭 메모리로만 유지한다(integration.md).
    키 이름은 기존과 같게 둔다 — 로그인 복귀·캘린더가 같은 값을 읽는다. */
const read = key => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } };
const write = (key, value) => sessionStorage.setItem(key, JSON.stringify(value));

export const getInput = () => read('yogobi:input');
export const setInput = value => write('yogobi:input', value);
export const getResult = () => read('yogobi:result');
export const setResult = value => write('yogobi:result', value);

/** 로그인 뒤 돌아갈 곳. 우리가 남긴 값만 쓴다 — URL 파라미터로 받으면 오픈 리다이렉트가 된다. */
const ALLOWED_NEXT = ['/results', '/calendar', '/mypage'];
export const setNext = path => sessionStorage.setItem('yogobi:next', path);
export function takeNext() {
  const next = sessionStorage.getItem('yogobi:next');
  sessionStorage.removeItem('yogobi:next');
  return ALLOWED_NEXT.includes(next) ? next : null;
}
