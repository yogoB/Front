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
- 운영 API: 같은 사이트의 `/api/v1`을 기본으로 사용합니다. 별도 주소는 [`src/config.js`](src/config.js)에서 지정합니다.
- 운영에서는 정적 프론트 서버가 `/api`, `/oauth2`, `/login/oauth2`를 BE로 프록시하거나, 같은 사이트의 별도 BE 오리진을 사용합니다. 현재 Spring 보안 설정은 프론트의 새 JS/CSS 경로를 허용하지 않으므로 BE static 폴더에 복사하는 것만으로는 실행할 수 없습니다.

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
Google 로그인은 BE의 Google OAuth 설정이 필요하고, 가입·비밀번호 재설정 메일은 실제 SMTP 설정이 필요합니다.
메일 발송은 기본 비활성이므로 이 경우 서버의 오류를 화면에 표시합니다. 본인 확인 링크는 `account.html#action=signup|reset&token=...` 형식입니다.
운영은 HTTPS 및 Secure 쿠키를 사용하고, 정확한 프론트 오리진을 허용해야 합니다. 서로 다른 사이트 간 쿠키 인증은 현재 BE의 SameSite=Lax 설정으로 지원하지 않습니다.

요금제 시드가 없으면 추천은 422 또는 빈 목록 안내가 나옵니다. BE의 `dev` 프로파일과 개발 시드로 통신을 검증할 수 있지만, 개발용 가격을 실제 상품 가격으로 취급하면 안 됩니다.

## 구성

```text
index.html              통신 → 구독 → 조건 확인 → 결과, 문장 추천
account.html            회원·로그인 세션 관리
src/app.js              화면 이벤트·카탈로그·추천·직접 계산
src/account.js          인증·이메일 확인·Google 연결·세션 종료
src/api.js              공통 fetch, 쿠키, CSRF, 오류, 취소, 시간 제한
src/model.js            요청 변환, 입력 검증, CSV 내보내기
src/config.js           API 주소
src/styles.css          기존 테마를 보존한 공통·반응형 스타일
assets/                 원본 HTML에서 추출한 폰트와 폰트 CSS
tests/                 계약 테스트와 선택 실행 브라우저 검증
```

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
