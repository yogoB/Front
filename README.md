# 요고비 프론트

기존 HTML의 테마와 단계별 화면을 유지하면서, 현재 `BE_main` API에 연결한 정적 웹 앱입니다.
브라우저의 고정 가격·추천 계산을 제거하고 백엔드 응답의 금액·순서·출처를 표시합니다.
런타임·빌드 의존성 없이 HTML, CSS, JavaScript 모듈로 실행합니다.

## 실행

```sh
npm run dev
# npm 없이도 실행 가능
python3 -m http.server 5173 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다. 기존 `/yogo_v01.html` 주소도 새 화면으로 이동합니다.
`file://`로 열면 모듈과 API 통신이 동작하지 않으므로 HTTP 서버를 사용합니다.

- 로컬 API: 프론트와 같은 호스트의 `8080` 포트. `localhost`와 `127.0.0.1`을 섞지 않습니다.
- 운영 API: 같은 사이트의 `/api/v1`을 사용합니다. 별도 주소가 필요하면 [`src/config.js`](src/config.js)에서 지정합니다.
- 운영 구성: 프론트는 `yogob`(fly), BE는 **`yogob-api`**(fly)로 **앱을 분리**합니다.
  [`nginx.conf`](nginx.conf)가 `/api`, `/oauth2`, `/login/oauth2`를 `yogob-api`로 프록시하므로 브라우저에는 오리진이 하나뿐입니다
  (같은 오리진이라 CORS 설정도, 교차 사이트 쿠키도 필요 없습니다).
  **두 레포의 `fly.toml` app 이름을 같게 두지 마세요** — 나중에 배포한 쪽이 앞선 배포를 덮어씁니다(2026-09-16 실제 발생).

## 백엔드 준비

`../BE_main`에서 해당 저장소의 README에 따라 PostgreSQL과 Spring을 실행합니다.
프론트 기본 주소는 BE의 기본 CORS 허용 목록에 포함된 `http://127.0.0.1:5173`입니다.
로컬 HTTP에서 회원 기능도 확인하려면 BE에 아래 설정이 필요합니다.

```properties
YOGOBI_CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173
AUTH_SECURE_COOKIES=false
AUTH_SESSION_COOKIE_NAME=YGB_SESSION
AUTH_RETURN_URL=http://127.0.0.1:5173/account.html
AUTH_EMAIL_LINK_URL=http://127.0.0.1:5173/account.html
```

회원 기능에는 BE의 `JWT_SECRET` 설정도 필요합니다. 프론트에 비밀 키를 넣지 않습니다.
가입은 메일 없이 바로 됩니다(D-20) — 이름·이메일·비밀번호·닉네임만 받고, 중복은 이메일/닉네임을 구분해 알려줍니다.
**메일 발송 기능은 쓰지 않습니다.** 비밀번호 재설정 화면도 없으며, 잊었을 때는 Google 로그인을 쓰거나 운영자가 처리합니다.
Google 로그인은 BE의 Google OAuth 설정이 필요합니다.
운영은 HTTPS 및 Secure 쿠키를 사용하고, 정확한 프론트 오리진을 허용해야 합니다. 서로 다른 사이트 간 쿠키 인증은 현재 BE의 SameSite=Lax 설정으로 지원하지 않습니다.

카탈로그에 없는 조건이면 오류가 아니라 **빈 결과 + 안내**가 나옵니다(BE G-12). 화면은 그 안내를 그대로 보여줍니다.

## 구성

```text
index.html              랜딩 + 모드 선택 (라이트/디테일)
light.html              라이트 입력 3단계 (데이터 범위 → 통신비 → 구독)
detail.html             디테일 입력 3단계 (통신사·약정 → 희망요금 → 희망구독)
results.html            결과 비교표 (BE 추천 연동, 계산 근거·출처, 정보 오류 제보)
calendar.html           전환 액션 캘린더 (금액은 결과 화면 값, 단계 가이드·날짜는 예시)
app.html                기존 통신 → 구독 → 조건 → 결과 앱 (BE 연동 동작본)
account.html            회원·로그인 세션 관리
src/landing.js          랜딩·모드선택 뷰 전환
src/light.js, detail.js 입력 흐름 로직
src/results.js          결과 비교표 렌더·기간 탭
src/calendar.js         전환 캘린더 렌더
src/catalog-data.js     BE 카탈로그 로더(loadCatalog) + 통신사·구간 상수
src/redesign.css        리디자인 공통 스타일(디자인 토큰)
src/app.js              app.html의 화면 이벤트·카탈로그·추천·직접 계산
src/account.js          로그인·Google 연결·세션 종료
src/api.js              공통 fetch, 쿠키, CSRF, 오류, 취소, 시간 제한
src/model.js            요청 변환, 입력 검증, CSV 내보내기
src/config.js           API 주소
src/styles.css          기존 app.html 테마를 보존한 공통·반응형 스타일
assets/                 원본 HTML에서 추출한 폰트와 폰트 CSS
docs/ux-flow.md         리디자인 화면·흐름 확정본과 BE 매핑
tests/                 계약 테스트와 선택 실행 브라우저 검증
```

**프론트 개발을 처음 시작하는 팀원은 [시작하기](docs/getting-started.md) → [개발 가이드](docs/frontend-guide.md) 순서로 읽으면 문서만 보고 구현할 수 있습니다.**
상세 동작과 구현 경계는 [연동 명세](docs/integration.md), 기존 프로토타입 분석은 [이전 분석](docs/README.md)을 참고합니다.

## 검증

```sh
npm test
```

Node 기본 테스트 러너만 사용합니다. 지원 필드·서비스/등급 ID·빈 입력·정수 검증·비밀번호 제한·쿠키/CSRF·에러·취소·CSV를 확인합니다.

실제 BE와 프론트 서버를 띄운 뒤 Playwright가 이미 설치된 환경에서는 다음 브라우저 검증도 실행할 수 있습니다.

```sh
node tests/browser.mjs
# 별도 경로에 설치됐다면 PLAYWRIGHT_MODULE, PLAYWRIGHT_EXECUTABLE 지정
```

브라우저 검증은 개발 시드의 넷플릭스와 요금제, AI 비활성·메일 비활성 상태를 전제로 합니다.
성공 경로는 실제 BE를 사용하고, 422·취소·악성 문자열·오프라인은 응답을 대체해 확인합니다.
화면 캡처는 기본 `/tmp/yogobi-front-screenshots`에 저장합니다.
