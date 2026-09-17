# 프론트 개발 가이드 (규칙 · 관습 · 레시피)

[시작하기](getting-started.md)를 먼저 읽고 환경을 띄운 뒤 이 문서를 본다. 여기서는 **이 코드베이스에서 코드를 어떻게 쓰는지**와 **자주 하는 작업을 그대로 따라 할 수 있는 레시피**를 다룬다. 모든 예시는 실제 파일에서 가져왔다.

---

## 1. 절대 규칙 (어기면 안 됨)

이 5가지는 팀 원칙이자 보안·정확성의 선이다.

1. **프론트는 금액을 계산하지 않는다.** 더하기·할인·절감액·연 환산을 JS로 만들지 않는다. 합계도 마찬가지다 — 프론트가 만든 숫자엔 출처(원칙 4)가 없다. 모든 금액은 서버 응답값을 **그대로** 표시한다. `tests/contract.test.js`의 `front never does arithmetic on server amounts`가 `src/` 전체를 훑어 막는다.
2. **서버·사용자 문자열은 JSX 중괄호로 넣는다.** `{값}` 은 React가 자동으로 escape 한다. `dangerouslySetInnerHTML` 은 **금지**.
3. **공개 요청과 회원 요청을 구분한다.** 추천·계산·카탈로그는 로그인 없이(`request(path)`), 내 계정·세션은 회원으로(`request(path, { member: true })`) 호출한다.
4. **프론트에 비밀 값을 두지 않는다.** JWT·비밀번호·API 키를 코드나 저장소(localStorage 등)에 저장하지 않는다. 인증은 서버가 쿠키로 처리한다.
5. **백엔드 계약을 임의로 바꾸지 않는다.** 필드 이름·enum 값은 [연동 명세](integration.md) 그대로 쓴다. 새 API가 필요하면 먼저 사람에게 제안한다.

> 미사용 혜택·미지원 기능을 "되는 것처럼" 표시하지 않는다. 안 되는 기능은 버튼을 `disabled`로 두거나 "준비 중"으로 표시한다. ([현재 상태](state.md) 참고)

---

## 2. 알아야 할 코드 관습

`src/pages/MyPage.jsx` 하나를 열어 두고 읽으면 이 문서의 관습이 거의 다 보인다.

### 화면 = 함수가 돌려주는 JSX
```jsx
export default function Light() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-page px-6">…</main>
    </>
  );
}
```
컴포넌트 이름은 **대문자로 시작**한다. `class` 대신 `className`, `for` 대신 `htmlFor`를 쓴다.

### 상태: `useState`
```jsx
const [services, setServices] = useState([]);
setServices(목록);      // 이걸 불러야 화면이 다시 그려진다. 배열을 직접 push 하면 안 된다
```
값을 바꾸는 유일한 방법은 `set…` 함수다. 바꾸면 React가 알아서 다시 그린다.

### 화면이 뜬 뒤 할 일: `useEffect`
```jsx
useEffect(() => {
  loadCatalog().then(setServices).catch(() => {});
}, []);                 // [] = 처음 한 번만
```
서버 요청은 거의 여기 들어간다. 두 번째 인자(의존성 배열)에 든 값이 바뀌면 다시 실행된다.

### 로그인 여부: `useMember`
```jsx
const member = useMember();
if (member === undefined) return <p>불러오는 중…</p>;   // 아직 모름
if (member === null) return <GuestGate … />;            // 비회원
```
`/api/v1/me` 호출을 한 번으로 합쳐 준다. 로그인 상태를 새로 확인해야 하면 `forgetMember()`를 부른 뒤 다시 읽는다.

### 서버 요청: `request` (lib/api.js)
```js
const { data, warnings } = await request('/api/v1/catalog/services');           // 공개 GET
const { data } = await request('/api/v1/recommendations', { method: 'POST', body });  // 공개 POST
const { data } = await request('/api/v1/me', { member: true });                 // 회원 요청(쿠키 포함)
```
- 응답은 항상 **봉투** `{ data, warnings }`. 실제 값은 `data`에 있다.
- 실패하면 `ApiError`를 던진다(throw). `try/catch`로 받아 `error.message`를 사용자에게 보여준다.
- 회원 변경 요청(POST/DELETE)의 CSRF 토큰은 `request`가 **자동으로** 처리한다.
- 타임아웃(65초)·취소도 `request`가 처리한다. 이 파일은 웬만하면 건드리지 않는다.

### 금액·검증 헬퍼 (lib/model.js)
```js
won(24200)                       // "24,200원"
provenance['OFFICIAL']           // "공식 가격"
integer(value, '월 데이터 사용량', 1, 2147483647)  // 정수 검증, 틀리면 throw
```

### 화면 사이 값 옮기기 (lib/session.js)
```js
setInput(값); getInput();        // 입력 단계 → 결과
setResult(값); getResult();      // 결과 → 캘린더
setNext('/calendar');            // 로그인 뒤 돌아올 곳(허용 목록만 통과)
```
`sessionStorage`라 탭을 닫으면 사라진다. 비회원 입력을 서버에 남기지 않기 위한 선택이다.

### 오류 표시 패턴
검증은 **에러를 던지고**, 부르는 쪽에서 잡아 상태에 넣는다.
```jsx
const [status, setStatus] = useState('');
try {
  integer(fee, '현재 월 통신비', 0, 1000000000);   // 틀리면 throw
} catch (e) { setStatus(e.message); }
…
<Status>{status}</Status>
```

---

## 3. 레시피 — 이럴 땐 이렇게

### 레시피 A. 입력 필드 추가하기

1. 해당 화면 파일(`src/pages/Detail.jsx` 등)에 상태와 입력을 추가한다. `<label htmlFor>`를 반드시 연결한다(접근성).
   ```jsx
   const [preferredColor, setPreferredColor] = useState('');
   …
   <label htmlFor="preferred-color">선호 색상 <span className="text-muted">선택</span></label>
   <input id="preferred-color" value={preferredColor} maxLength={20}
          onChange={e => setPreferredColor(e.target.value)} className="field" />
   ```
2. 이 값을 **서버로 보낼 거라면** `src/lib/model.js`의 요청 변환 함수에 넣는다. 선택값은 `optionalInputs()`에, 필수값은 `recommendationRequest()`에. **단, 필드 이름은 [연동 명세](integration.md)에 있는 이름만 쓴다.**
   ```js
   if (values.preferredColor) optional.preferredColor = values.preferredColor;
   ```
3. 값이 **화면 메모용일 뿐 서버로 안 가면** 2번은 건너뛴다.

### 레시피 B. 서버 응답의 새 값을 화면에 표시하기

서버가 결과에 새 필드(예: `discountReason`)를 준다고 하자.

```jsx
{result.discountReason && <p className="text-[13px] text-muted">{result.discountReason}</p>}
```
- 문자열은 중괄호로 그대로 넣는다(React가 escape 한다).
- 금액이면 `won()`, 출처면 `provenance[...]`를 통해 표시한다. **직접 숫자를 포맷하거나 계산하지 않는다.**

### 레시피 C. 새 API 호출 추가하기

1. 부를 주소·방식·주고받는 형태를 [연동 명세](integration.md)에서 확인한다.
2. `useEffect` 안에서 `request()`로 호출한다. 공개면 옵션 없이, 회원이면 `{ member: true }`.
   ```jsx
   useEffect(() => {
     let alive = true;                                  // 화면이 먼저 사라졌을 때 setState 하지 않는다
     request('/api/v1/some/path')
       .then(({ data }) => { if (alive) setSomething(data); })
       .catch(e => { if (alive) setStatus(e.message); });  // 실패도 사용자에게 알린다
     return () => { alive = false; };
   }, []);
   ```
3. **취소·경합 주의:** 사용자가 빠르게 여러 번 누를 수 있는 요청은 `request(path, { signal })`에 `AbortController`의 signal을 넘겨 이전 요청을 취소한다.

### 레시피 D. 입력 검증 추가하기

`model.js`의 `integer()`처럼 **틀리면 한국어 메시지로 `throw`** 하는 함수를 만들거나 재사용한다. 숫자는 반드시 `integer()`를 통과시킨다. 직접 `Number(...)`로 파싱해 쓰지 않는다(음수·소수·빈값 문제).

### 레시피 E. 새 화면 추가하기

1. `src/pages/NewThing.jsx`를 만든다. `export default function NewThing() { … }`.
2. `src/App.jsx`의 라우트표에 한 줄 추가한다.
   ```jsx
   <Route path="/new-thing" element={<NewThing />} />
   ```
3. 로그인이 필요한 화면이면 `useMember()` + `GuestGate` 패턴을 그대로 따른다(`Calendar.jsx` 참고). **금액이 한 줄이라도 보이는 화면은 반드시 막는다**(ux-flow D-36).

> 새 화면은 대부분 필요 없다. 기존 화면 안에서 해결되는지 먼저 확인한다.

### 레시피 F. 스타일 바꾸기

Tailwind 클래스를 마크업에 직접 쓴다. 색·글꼴·반복되는 묶음(`btn`, `field`, `card`)은 `src/index.css`에 있다. 색·간격은 `@theme` 안의 토큰을 고치면 전체에 반영된다.

> **Tailwind 4 함정:** `@apply`는 유틸리티만 받는다. `@apply btn` 처럼 컴포넌트 클래스를 넣으면 빌드가 깨진다. 마크업에서 `className="btn btn-brand"` 로 나란히 쓴다.

---

## 4. 자동 검증(테스트)

```sh
npm test
```

`tests/contract.test.js`가 **절대 규칙이 지켜지는지**를 검사한다: 요청이 계약대로 나가는지, 봉투 처리, 정수 검증, CSRF/쿠키, 오류 보존, CSV 안전성, 프론트 금액 계산 금지, Google 캘린더 링크에 금액이 실리지 않는지 등. 현재 **17개**가 모두 통과해야 한다.

`lib/` 아래 로직을 바꿨다면 `npm test`를 돌린다. 새 검증 로직을 추가했다면 `contract.test.js`에 짧은 케이스 하나를 같은 스타일로 더한다. (프레임워크 없이 Node 기본 `node:test`와 `assert`만 쓴다. React 컴포넌트 렌더링 테스트는 두지 않는다 — 순수 로직은 `src/lib/`으로 빼서 테스트한다.)

커밋 전에 `npm run build`도 한 번 돌린다. JSX 문법 오류·Tailwind 오류는 테스트가 아니라 빌드에서 잡힌다.

---

## 5. 커밋 · 배포

- **커밋:** 화면 작업과 로직 작업을 뒤섞지 않는다. 한 작업 = 한 커밋. 메시지는 한국어로 "무엇을 왜".
- **배포:** `npm run build` 결과를 Docker로 감싸 nginx가 서빙한다(`Dockerfile`, `nginx.conf`). [Fly.io](https://fly.io/)에 `fly deploy`로 https://yogob.fly.dev/ 에 올린다. 파일 이름에 내용 해시가 붙어 캐시는 자동으로 갈린다 — 예전처럼 `?v=`를 손으로 붙이지 않는다. 개인이 임의로 배포하지 말고 팀과 맞춘다.

---

## 6. 자주 하는 실수 체크리스트

- [ ] 서버/사용자 문자열을 `dangerouslySetInnerHTML`로 넣지 않았다 → `{값}` 만 사용
- [ ] 금액을 JS로 계산하지 않았다(합계·`* 12` 포함) → 서버 값 `won()`으로 표시만
- [ ] 서버로 보내는 필드 이름이 [연동 명세](integration.md)와 정확히 일치한다
- [ ] 숫자 입력은 `integer()`로 검증했다
- [ ] 입력에 `<label htmlFor="...">`를 연결했다 (접근성)
- [ ] `useState`/`useEffect`를 `if`·반복문 안이 아니라 컴포넌트 맨 위에서 불렀다
- [ ] 상태를 `set…` 함수로 바꿨다(배열·객체를 직접 수정하지 않았다)
- [ ] API 실패를 `catch`해서 사용자에게 문구로 알렸다
- [ ] 금액이 보이는 새 화면이면 `useMember()`로 막았다
- [ ] `npm test` 17개 통과 + `npm run build` 성공
