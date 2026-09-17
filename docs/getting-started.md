# 요고비 프론트 시작하기 (개발 처음이신 분용)

이 문서는 **개발 경험이 없어도** 요고비 프론트를 실행하고 첫 수정을 해볼 수 있게 안내한다. 순서대로 따라오면 된다.

## 읽는 순서

1. **이 문서** — 환경 준비, 프로젝트가 어떻게 굴러가는지, 용어.
2. [프론트 개발 가이드](frontend-guide.md) — 코드 규칙과 "이럴 땐 이렇게" 레시피.
3. [연동 명세](integration.md) — 백엔드 API 계약(어떤 주소로 뭘 주고받는지).
4. [현재 상태](state.md) — 무엇이 됐고 무엇이 아직 안 됐는지.

## 이 프로젝트가 뭔가

통신 요금제 + 구독 서비스의 **실제 지불 총액**을 계산해 더 싼 조합을 추천하는 웹 화면이다.
**금액 계산은 하지 않는다.** 사용자가 입력한 조건을 백엔드(BE) 서버로 보내고, 서버가 계산해 준 금액·순서·근거를 화면에 그대로 보여주는 게 프론트의 역할이다.

```
사용자가 입력 → [프론트] 조건을 JSON으로 BE에 요청 → [BE 서버] 계산 → [프론트] 결과를 화면에 표시
```

## 기술 스택

| 무엇 | 쓰는 것 | 왜 |
| --- | --- | --- |
| 빌드 도구 | **Vite 8** | 개발 중엔 저장하면 즉시 반영(HMR), 배포용은 `npm run build` 한 번 |
| UI 라이브러리 | **React 19** | 화면을 "함수가 돌려주는 JSX"로 쓴다. 상태가 바뀌면 React가 알아서 다시 그린다 |
| 화면 이동 | **React Router 7** | 주소(`/results`, `/calendar`)마다 다른 화면. 페이지 새로고침 없이 바뀐다 |
| 스타일 | **Tailwind CSS 4** | `className="flex gap-3"` 처럼 클래스로 스타일을 준다. 공용 토큰·컴포넌트 클래스는 `src/index.css` |
| 테스트 | **Node 내장 `node:test`** | 별도 프레임워크 없음. `npm test` |
| 배포 | Docker(빌드 → nginx) → Fly.io | `Dockerfile`, `nginx.conf` |

> 2026-09 이전에는 빌드 없는 순수 HTML + ES 모듈 구조(`index.html` + `src/app.js`)였다.
> 지금은 **전면 React 전환이 끝났고**, 옛 `*.html`/`*.js` 화면 파일은 남아 있지 않다.
> 오래된 문서(`docs/README.md`, `docs/worklog.md`)는 그 시절 분석 기록이라 스택 설명이 다르다.

### Tailwind 4에서 자주 걸리는 것

`@apply`는 **유틸리티 클래스만** 받는다. `src/index.css`에서 만든 컴포넌트 클래스(`btn`, `field` 등)를 `@apply btn` 하면 빌드가 깨진다. 마크업에서 `className="btn btn-brand"` 처럼 두 클래스를 나란히 쓴다.

## 개발 환경 준비

1. **웹 브라우저** — Chrome 권장 (개발자 도구가 편하다).
2. **코드 에디터** — [VS Code](https://code.visualstudio.com/) 권장. 무료.
3. **Node.js** — [nodejs.org](https://nodejs.org/)에서 LTS 설치. 이제 **필수다**(빌드·개발 서버·테스트 전부 Node로 돈다).

## 실행하기

프로젝트 폴더(`front/`)에서 터미널을 열고, **처음 한 번만**:

```sh
npm install
```

그다음부터는:

```sh
npm run dev
```

브라우저에서 **http://127.0.0.1:5173** 을 연다.

코드를 고치고 **저장하면 브라우저가 알아서 바뀐다**(HMR). 새로고침도 대부분 필요 없다.

| 명령 | 언제 |
| --- | --- |
| `npm run dev` | 개발할 때. 이게 기본 |
| `npm test` | 로직을 고친 뒤. 18개 검사가 돈다 |
| `npm run build` | 배포용 파일을 `dist/`에 만든다. 커밋 전 한 번 돌려 깨지지 않는지 본다 |
| `npm run preview` | 만들어진 `dist/`를 실제 배포처럼 띄워 확인 |

### 백엔드까지 볼 것인가

- **화면·레이아웃·문구만 볼 거라면** `npm run dev`로 충분하다. API 데이터는 "불러오지 못했어요" 상태로 보이지만 화면 구조를 만지는 데는 지장 없다.
- **실제 추천 데이터까지 보려면** 백엔드(BE) 서버가 같이 떠 있어야 한다. 준비 방법은 [실행 안내](../README.md)의 "백엔드 준비"를 본다.
  개발 서버가 `/api`·`/oauth2`·`/login/oauth2` 요청을 BE로 넘겨준다(`vite.config.js`의 프록시). 기본 대상은 `http://127.0.0.1:8080`이고, 배포된 BE를 보려면:
  ```sh
  API_TARGET=https://yogob-api.fly.dev npm run dev
  ```

## 파일 지도 — 어디를 고쳐야 하나

```text
index.html            껍데기 한 장. 여기엔 화면이 없다(React가 채운다). 보통 안 건드린다
src/main.jsx          시작점. App을 브라우저에 붙인다
src/App.jsx           주소 ↔ 화면 연결표(라우트). 새 화면을 만들면 여기에 한 줄 추가
src/index.css         색·글꼴·공용 컴포넌트 클래스(btn, field, card…) + Tailwind 설정

src/pages/            주소 하나 = 파일 하나
  Landing.jsx           /           첫 화면
  Modes.jsx             /modes      간편/상세 고르기
  Light.jsx             /light      간편 입력
  Detail.jsx            /detail     상세 입력
  Results.jsx           /results    추천 결과 (로그인 필요)
  Calendar.jsx          /calendar   전환 일정 (로그인 필요)
  Login.jsx             /login      Google 로그인
  MyPage.jsx            /mypage     내 계정·구독·중복 결제 점검·탈퇴
  Terms / Privacy / DataSources     약관·개인정보·출처
  Admin.jsx             /admin      백오피스

src/components/       여러 화면이 같이 쓰는 조각
  Layout.jsx            Header / Footer / Page
  Flow.jsx              입력 단계 공통(진행바·질문·오류줄·버튼)
  GuestGate.jsx         비회원 차단 화면
  AuthReturn.jsx        Google 로그인 복귀 처리(#auth=...)
  Choice / SubscriptionPicker / Analyzing / PolicyNav

src/lib/              화면과 무관한 순수 로직 — 테스트가 붙는 곳
  api.js                서버 요청 공통 함수. 보통 건드릴 일 없음
  model.js              입력 검증·요청 변환·금액 표시·CSV
  schedule.js           전환 일정 날짜 계산, Google 링크·.ics 만들기
  session.js            sessionStorage(입력·결과·돌아갈 곳)
  useMember.js          로그인 여부 조회(useMember 훅)
  catalog-data.js       구독 서비스 목록
  config.js             API 서버 주소

tests/contract.test.js  자동 검증. 로직을 고쳤으면 여기도 본다
assets/                 글꼴 파일
docs/                   지금 읽는 문서들
Dockerfile / nginx.conf 배포
```

**대부분의 작업은 `src/pages/`의 화면 파일 하나 안에서 끝난다.**

## 화면이 뜨기까지 — 한 번의 흐름

"구독 서비스 목록 불러오기"를 예로 보자. (지금 다 이해할 필요 없다. 나중에 참고.)

1. 주소가 `/light`면 `App.jsx`의 라우트표가 `Light.jsx` 함수를 부른다.
2. 그 함수가 돌려주는 **JSX**(HTML처럼 생긴 것)가 화면이 된다.
3. 화면이 뜬 직후 `useEffect(...)` 안에서 `loadCatalog()`가 서버에 목록을 요청한다.
4. 목록이 오면 `setServices(목록)`으로 **상태를 바꾼다**.
5. 상태가 바뀌면 **React가 그 함수를 다시 실행해 화면을 새로 그린다.** 직접 다시 그리라고 시키지 않아도 된다.

즉 **"이벤트 → 상태(state) 변경 → React가 알아서 다시 그림"** 의 반복이다. 이게 이 프로젝트의 심장이다.

## 용어집 (모르는 단어가 나오면 여기)

| 단어 | 뜻 |
| --- | --- |
| **JSX** | JS 안에 HTML처럼 쓰는 문법. `return <p>안녕</p>` 처럼. `class` 대신 `className`을 쓴다 |
| **컴포넌트** | 화면 조각을 돌려주는 함수. 이름이 **대문자로 시작**해야 React가 알아본다 |
| **상태(state)** | 화면이 기억하는 값. `const [n, setN] = useState(0)`. `setN`으로 바꿔야 화면이 다시 그려진다 |
| **useEffect** | 화면이 뜬 뒤(또는 값이 바뀐 뒤) 할 일. 서버 요청이 주로 여기 들어간다 |
| **훅(hook)** | `use`로 시작하는 함수. 컴포넌트 맨 위에서만 부른다(`if` 안에서 부르면 안 됨) |
| **라우트(route)** | 주소 ↔ 화면 연결. `App.jsx`에 목록이 있다 |
| **Tailwind 클래스** | `className="flex gap-3 text-sm"` 처럼 스타일을 클래스로 준다. 공용 묶음은 `index.css` |
| **HMR** | 저장하면 새로고침 없이 화면이 바뀌는 기능. `npm run dev`가 해준다 |
| **fetch** | 브라우저가 서버에 요청을 보내는 기본 기능. 이 프로젝트는 `api.js`의 `request()`로 감싸 쓴다 |
| **엔드포인트(endpoint)** | 서버의 특정 주소. 예: `/api/v1/catalog/services` |
| **JSON** | 데이터를 주고받는 글자 형식. `{ "name": "넷플릭스" }` 처럼 생김 |
| **봉투(envelope)** | 서버 응답의 공통 포장. 항상 `{ data: ..., warnings: [...] }` 형태. 실제 값은 `data` 안에 있다 |
| **카탈로그(catalog)** | 선택 가능한 구독 서비스·요금제 목록. 서버에서 받아온다 |
| **등급(tier)** | 한 서비스의 요금 단계. 예: 넷플릭스 광고형/스탠다드/프리미엄 |
| **출처(provenance)** | 각 금액이 어디서 나온 값인지 표시. 공식 가격/계산값/사용자 입력/추정값 |
| **CSRF** | 회원 요청을 위조로부터 보호하는 보안 토큰. `api.js`가 자동 처리하니 신경 안 써도 됨 |

## 첫 수정 해보기 (3분)

1. `npm run dev`로 띄운다.
2. `src/pages/Landing.jsx`를 에디터로 연다.
3. 가장 큰 제목(`<h1 ...>`)의 글자를 아무거나 바꾼다.
4. 저장한다. → **브라우저를 안 건드려도** 바뀐 문구가 보인다.

## 막혔을 때

- **화면이 하얗다 / 아무것도 안 된다** → 브라우저 **F12**(개발자 도구) → **Console** 탭. 빨간 오류가 원인이다. 터미널(`npm run dev`)도 같이 본다.
- **"서비스 목록을 불러오지 못했어요"** → 정상이다. 백엔드가 안 떠 있어서다. 화면 작업엔 문제없다.
- **`Cannot apply unknown utility class 'btn'`** → Tailwind 4에서 `@apply`에 컴포넌트 클래스를 쓴 것이다. 위 "Tailwind 4에서 자주 걸리는 것" 참고.
- **훅 관련 오류(`Rendered fewer hooks than expected` 등)** → `useState`/`useEffect`를 `if` 문이나 반복문 안에서 부른 것이다. 컴포넌트 맨 위로 올린다.
- **API가 계속 실패** → **F12 → Network** 탭에서 어떤 요청이 실패(빨강)했는지 본다. 개발 중 프록시 대상은 `vite.config.js`, 배포 주소는 `src/lib/config.js`에서 정한다.
