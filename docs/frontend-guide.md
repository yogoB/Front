# 프론트 개발 가이드 (규칙 · 관습 · 레시피)

[시작하기](getting-started.md)를 먼저 읽고 환경을 띄운 뒤 이 문서를 본다. 여기서는 **이 코드베이스에서 코드를 어떻게 쓰는지**와 **자주 하는 작업을 그대로 따라 할 수 있는 레시피**를 다룬다. 모든 예시는 실제 파일에서 가져왔다.

---

## 1. 절대 규칙 (어기면 안 됨)

이 5가지는 팀 원칙이자 보안·정확성의 선이다.

1. **프론트는 금액을 계산하지 않는다.** 더하기·할인·절감액 계산을 JS로 만들지 않는다. 모든 금액은 서버 응답값을 **그대로** 표시한다. (지출 요약의 단순 합계 표시만 예외이며, 이건 사용자 입력의 메모다.)
2. **서버·사용자 문자열은 반드시 `textContent`로 넣는다.** `innerHTML = ...`, `element.innerHTML +=` 는 **금지**. 악성 문자열이 코드로 실행될 수 있다. 이 프로젝트는 `element()`/`textContent`/`new Option()`만 쓴다.
3. **공개 요청과 회원 요청을 구분한다.** 추천·계산·카탈로그는 로그인 없이(`request(path)`), 내 계정·세션은 회원으로(`request(path, { member: true })`) 호출한다.
4. **프론트에 비밀 값을 두지 않는다.** JWT·비밀번호·API 키를 코드나 저장소(localStorage 등)에 저장하지 않는다. 인증은 서버가 쿠키로 처리한다.
5. **백엔드 계약을 임의로 바꾸지 않는다.** 필드 이름·enum 값은 [연동 명세](integration.md) 그대로 쓴다. 새 API가 필요하면 먼저 사람에게 제안한다.

> 미사용 혜택·미지원 기능을 "되는 것처럼" 표시하지 않는다. 안 되는 기능은 버튼을 `disabled`로 두거나 "준비 중"으로 표시한다. ([현재 상태](state.md) 참고)

---

## 2. 알아야 할 코드 관습

`src/app.js`를 열어 두고 읽으면 좋다. 이 프로젝트는 몇 개의 짧은 헬퍼를 반복해서 쓴다.

### 요소 집기: `$`
```js
const $ = id => document.getElementById(id);
$('fee')                 // <input id="fee"> 를 가져옴
$('fee').textContent = '...'
```
HTML의 `id="fee"` ↔ JS의 `$('fee')`. **이게 화면과 코드를 잇는 기본 방식이다.**

### 요소 만들기: `element` / `button`
```js
element('strong', '넷플릭스')            // <strong>넷플릭스</strong>  (글자는 textContent로 안전하게)
element('li', `${m.impact} · ${m.howToFind}`)
button('삭제', () => 삭제하기(), 'remove')  // 클릭 핸들러가 붙은 <button type="button">
```
새 요소를 만들 땐 **항상 이 둘을 쓴다.** 직접 `innerHTML`로 문자열을 조립하지 않는다.

### 상태: `state`
```js
const state = { step: 1, catalog: [], subs: [], response: null, selected: null, snapshot: null };
```
화면이 기억하는 모든 값. **값을 바꾼 뒤 다시 그리는 함수(`renderSubscriptions()` 등)를 호출**해야 화면에 반영된다. `state`를 바꿨다고 화면이 저절로 바뀌지 않는다. (React가 아니다.)

### 폼 값 읽기: `values()`
```js
const values = () => Object.fromEntries(new FormData(form));
values().monthlyDataGb   // <input name="monthlyDataGb"> 의 현재 값
```
HTML `name="..."` 속성이 있는 입력들을 한 번에 객체로 읽는다. **`id`는 `$`로 집을 때, `name`은 폼 값으로 읽을 때** 쓴다. (둘 다 필요한 입력도 많다.)

### 서버 요청: `request` (api.js)
```js
const { data, warnings } = await request('/api/v1/catalog/services');           // 공개 GET
const { data } = await request('/api/v1/recommendations', { method: 'POST', body });  // 공개 POST
const { data } = await request('/api/v1/me', { member: true });                 // 회원 요청(쿠키 포함)
```
- 응답은 항상 **봉투** `{ data, warnings }`. 실제 값은 `data`에 있다.
- 실패하면 `ApiError`를 던진다(throw). `try/catch`로 받아 `error.message`를 사용자에게 보여준다.
- 회원 변경 요청(POST/DELETE)의 CSRF 토큰은 `request`가 **자동으로** 처리한다.
- 타임아웃(65초)·취소도 `request`가 처리한다. 이 파일은 웬만하면 건드리지 않는다.

### 금액·검증 헬퍼 (model.js)
```js
won(24200)                       // "24,200원"
provenance['OFFICIAL']           // "공식 가격"
integer(values().monthlyDataGb, '월 데이터 사용량', 1, 2147483647)  // 정수 검증, 틀리면 throw
```

### 오류 표시 패턴
검증은 **에러를 던지고**, 부르는 쪽에서 잡아 화면에 문구를 띄운다.
```js
try {
  integer(values().fee, '현재 월 통신비', 0, 1000000000);  // 틀리면 throw
  // ...정상 처리
} catch (e) { error(e.message); }   // error()는 #form-error에 메시지 표시
```

---

## 3. 레시피 — 이럴 땐 이렇게

### 레시피 A. 입력 필드 추가하기

예: 1단계에 "선호 통신사 색상" 같은 **선택 입력**을 하나 추가한다고 하자.

1. **`index.html`** 의 해당 `<section data-panel="1">` 안에 입력을 추가한다. `id`(코드로 집을 때)와 `name`(폼 값으로 읽을 때)을 둘 다 준다. `<label>`을 반드시 연결한다(접근성).
   ```html
   <div>
     <label for="preferred-color">선호 색상 <span class="muted">선택</span></label>
     <input id="preferred-color" name="preferredColor" maxlength="20">
   </div>
   ```
2. 이 값을 **서버로 보낼 거라면** `src/model.js`의 요청 변환 함수에 넣는다. 선택값은 `optionalInputs()`에, 필수값은 `recommendationRequest()`에 추가한다. **단, 필드 이름은 [연동 명세](integration.md)에 있는 이름만 쓴다.** 계약에 없는 필드는 서버가 무시하거나 거부한다.
   ```js
   // model.js optionalInputs() 안 — 계약에 있는 필드일 때만
   if (values.preferredColor) optional.preferredColor = values.preferredColor;
   ```
3. **화면 요약(우측 패널)에도 보이려면** `app.js`의 `renderSummary()`에 한 줄 추가하고, 대응하는 `<dd id="...">`를 `index.html` 요약 영역에 만든다.
4. 값이 **화면 메모용일 뿐 서버로 안 가면** 2·3번은 건너뛴다. (예: `currentPlanName`이 그렇다.)

> 규칙: 서버로 보내는 값은 반드시 계약에 있는 필드여야 하고, `integer()` 같은 검증을 통과해야 한다.

### 레시피 B. 서버 응답의 새 값을 화면에 표시하기

서버가 결과에 새 필드(예: `discountReason`)를 준다고 하자.

1. `index.html` 결과 영역에 표시할 자리를 만든다.
   ```html
   <p id="discount-reason" class="hint"></p>
   ```
2. `app.js`에서 응답을 그리는 함수(`renderResults()`/`renderDetail()`)에 한 줄 추가한다. **반드시 `textContent`로.**
   ```js
   $('discount-reason').textContent = r.discountReason || '';
   ```
3. 금액이면 `won()`, 출처면 `provenance[...]`를 통해 표시한다.
   ```js
   $('some-amount').textContent = won(r.someAmount);   // 절대 직접 숫자 포맷하지 않기
   ```

### 레시피 C. 새 API 호출 추가하기

1. 부를 주소·방식·주고받는 형태를 [연동 명세](integration.md)에서 확인한다.
2. `request()`로 호출한다. 공개면 옵션 없이, 회원이면 `{ member: true }`.
   ```js
   async function loadSomething() {
     try {
       const { data } = await request('/api/v1/some/path');
       // data로 화면 그리기
     } catch (e) {
       $('some-status').textContent = e.message;   // 실패도 사용자에게 알린다
     }
   }
   ```
3. **취소·경합 주의:** 사용자가 빠르게 여러 번 누를 수 있는 요청은 이전 요청을 취소한다. 기존 `loadBenefits()`가 `AbortController`를 쓰는 방식을 그대로 따라 한다.

### 레시피 D. 입력 검증 추가하기

`model.js`의 `integer()`/`validPassword()`처럼, **틀리면 한국어 메시지로 `throw`** 하는 함수를 만들거나 재사용한다.
```js
// 부르는 쪽 (app.js)
function validateFirst() {
  integer(values().monthlyDataGb, '월 데이터 사용량', 1, 2147483647);   // 틀리면 여기서 throw
  if (values().fee.trim()) integer(values().fee, '현재 월 통신비', 0, 1000000000);
}
// go()가 try/catch로 감싸 error(e.message)로 표시한다
```
숫자는 반드시 `integer()`를 통과시킨다. 직접 `Number(...)`로 파싱해 쓰지 않는다(음수·소수·빈값 문제).

### 레시피 E. 새 단계(화면) 추가하기

화면 전환은 URL 라우팅이 아니라 `state.step` 숫자로 한다.

1. `index.html`에 `<section data-panel="N" hidden>...</section>`을 추가한다. `data-panel` 숫자가 단계 번호다.
2. 좌측 내비게이션(`.step-nav`)에 `<button data-step="N">`을 추가한다.
3. `app.js`의 `displayStep()`이 `data-panel` 숫자로 보이기/숨기기를 자동 처리하므로, 단계 개수·검증 흐름(`go()`, `validate...()`)만 맞춰준다.

> 새 화면은 대부분 필요 없다. 기존 4단계(입력1~3 + 결과) 안에서 해결되는지 먼저 확인한다.

### 레시피 F. 스타일 바꾸기

모든 스타일은 `src/styles.css` 한 파일에 있다. 색·간격은 파일 위쪽의 CSS 변수(`:root`)를 고치면 전체에 반영된다. 새 클래스가 필요하면 기존 클래스(`.panel`, `.chip`, `.callout`, `.hint`)를 먼저 재사용할 수 있는지 본다.

---

## 4. 자동 검증(테스트)

```sh
npm test
```

`tests/contract.test.js`가 **절대 규칙이 지켜지는지**를 검사한다: 요청이 계약대로 나가는지, 봉투 처리, 정수 검증, CSRF/쿠키, 오류 보존, CSV 안전성 등. 8개가 모두 통과해야 한다.

`model.js`·`api.js`의 로직을 바꿨다면 `npm test`를 돌려 깨지지 않았는지 확인한다. 새 검증 로직을 추가했다면 `contract.test.js`에 짧은 케이스 하나를 같은 스타일로 더한다. (프레임워크 없이 Node 기본 `node:test`와 `assert`만 쓴다.)

---

## 5. 커밋 · 배포

- **커밋:** 화면 작업과 로직 작업을 뒤섞지 않는다. 한 작업 = 한 커밋. 메시지는 한국어로 "무엇을 왜".
- **배포:** 이 프론트는 [Fly.io](https://fly.io/)에 정적 파일로 올라간다. `fly.toml`·`Dockerfile`이 설정이다. 배포 담당자가 `fly deploy`로 https://yogob.fly.dev/ 에 올린다. 개인이 임의로 배포하지 말고 팀과 맞춘다.

---

## 6. 자주 하는 실수 체크리스트

- [ ] 서버/사용자 문자열을 `innerHTML`로 넣지 않았다 → `element()`/`textContent`만 사용
- [ ] 금액을 JS로 계산하지 않았다 → 서버 값 `won()`으로 표시만
- [ ] 서버로 보내는 필드 이름이 [연동 명세](integration.md)와 정확히 일치한다
- [ ] 숫자 입력은 `integer()`로 검증했다
- [ ] `id`(→`$`)와 `name`(→`values()`)을 목적에 맞게 붙였다
- [ ] 입력에 `<label for="...">`를 연결했다 (접근성)
- [ ] `state`를 바꾼 뒤 다시 그리는 함수를 호출했다
- [ ] API 실패를 `catch`해서 사용자에게 문구로 알렸다
- [ ] `npm test` 8개 통과
