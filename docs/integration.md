# 현재 백엔드 기준 프론트 연동

구현 기준일: 2026-09-11. `BE_main`의 컨트롤러, 요청/응답 레코드, `RecommendationService`, `SecurityConfig`, `AuthTokens`, `AuthEmail`을 확인했다. 계약 원본이나 백엔드 소스는 변경하지 않았다.

## 화면과 API

| 화면 기능 | 요청 |
| --- | --- |
| 서비스 선택·등급 선택 | `GET /api/v1/catalog/services` |
| 직접 선택할 요금제 목록 | `GET /api/v1/catalog/plans` |
| 추천 결과 상세의 혜택 | `GET /api/v1/catalog/plans/{id}/benefits` |
| 조건으로 추천 | `POST /api/v1/recommendations` |
| 특정 요금제·등급 계산 | `POST /api/v1/calculator` |
| 문장 추천 | `POST /api/v1/chat/messages` |
| 로그인 상태 | `GET /api/v1/me` |
| 변경 요청의 CSRF | `GET /api/v1/auth/csrf` |
| 가입 이메일 확인 | `POST /api/v1/auth/email/verification` → 메일 링크 → `POST /api/v1/auth/signup` |
| 비밀번호 재설정 | `POST /api/v1/auth/password/reset-request` → 메일 링크 → `POST /api/v1/auth/password/reset` |
| 로그인·로그아웃·전체 종료 | `POST /api/v1/auth/login`, `/logout`, `/logout-all` |
| Google 로그인·계정 연결 | BE `/oauth2/authorization/google` 이동, 연결 전 `/api/v1/auth/google/link` 또는 `/api/v1/auth/password` |
| 로그인 세션 관리 | `GET /api/v1/me/sessions`, `DELETE /api/v1/me/sessions/{id}` |

공개 API는 인증 쿠키 없이 호출한다. 회원 요청은 `credentials: include`로 보내고 변경 요청마다 CSRF 토큰을 새로 받는다. 브라우저에 JWT를 읽거나 저장하는 코드가 없다. 오류 메시지·코드·필드는 공통 클라이언트에서 보존하며 경고는 정상 결과와 함께 표시한다. 요청 시간 제한은 65초로, BE의 AI 파싱·설명 요청을 기다릴 수 있게 했다. 취소한 요청과 이전 혜택 조회 결과는 화면을 덮어쓰지 않는다.

## 입력 해석

- 월 데이터는 1 이상 Java int 범위의 정수 GB. 원래의 범위·무제한 버튼으로 수치를 추정하지 않는다.
- 구독 서비스와 등급 ID는 모두 카탈로그에서 받는다. 구독을 하나 이상 포함해야 추천·계산이 가능하다.
- `currentCarrier`는 `LGU+` 등 서버 식별자를 사용한다. `networkType`은 `5G/LTE/3G`, `contractType`은 `NONE/SELECTIVE_25/DEVICE_SUBSIDY`다.
- 가족 결합은 모름(필드 생략), 있음(`true`), 없음(`false`)을 구분한다.
- 기존 `필수/대체가능/불필요`를 `추천에 포함`으로 정리했다. 백엔드에는 등급 유지나 대체 가능성 옵션이 없어 구분을 전달할 수 없다.
- 현재 통신비·요금제 이름·약정 종료일·수정한 구독 지출은 화면의 메모다. 추천에 전달하거나 절감액 계산에 쓰지 않는다.
- 현재 지출 표시는 입력값과 카탈로그 가격의 단순 합계다. 비어 있는 값은 0원으로 확정하지 않고 누락 안내를 한다. 원본의 `55,000원` 강제 대체값을 제거했다.
- 예산은 서버 결과가 예산 이내인지 비교하는 데만 쓴다. 서버의 순위·총액을 바꾸거나 후보를 숨기지 않는다.

## 결과 해석

서버 `results`의 순서와 개수를 유지한다(추천 최대 5개). 원본의 고정 A/B/C·12% 할인·무료 OTT 가정은 제거했다.
`monthlyTotal`, `baseline`, `monthlySavings`, `annualSavings`는 응답값을 그대로 출력한다.
절감액 기준인 `baseline`은 **해당 조합의 할인 없는 정가 합계**다. 현재 사용자의 청구액으로 표현하지 않는다.
`breakdown`은 음수 할인·0원 혜택을 그대로 표시하고, `OFFICIAL/DERIVED/USER_PROVIDED/ESTIMATED` 출처와 설명을 함께 보여준다.
`missingInputs`와 `warnings`는 숨기지 않는다. 결과가 비어 있거나 422이면 조건을 수정하도록 안내한다.

추천은 백엔드가 서비스별 대표 등급을 선택한다. 결과의 “선택한 구독 등급으로 계산”은 추천 요청 당시의 등급 ID와 선택 조건을 캡처해 `/calculator`로 보낸다. 3단계에서 특정 카탈로그 요금제를 직접 선택할 수도 있다.

챗봇은 `{text}` 하나만 전달하며 1~4,000 코드 포인트를 검증한다. `NEEDS_INPUT`이면 조건을 함께 다시 적도록, `FILTER_FALLBACK`이면 직접 입력으로 안내한다. `RECOMMENDED`의 결과는 같은 카드로 표시한다. 챗봇 응답에는 파싱한 선택 조건·등급이 없으므로 이전 필터 입력으로 재계산하지 않는다. AI 서버에는 프론트가 직접 연결하지 않는다.

## 미지원 기능

- 고지서 이미지 업로드·OCR: 프론트가 호출할 BE 수신 API가 없다. 업로드 버튼을 비활성화했다.
- 회원 구독 저장·결제 업로드·중복 결제 탐지: HTTP API 미구현. 임의로 호출하지 않는다.
- 추천 조합 저장: 서버 저장 API 없음. 저장 버튼은 준비 중으로 표시한다.
- 약정 종료·위약금·전환 시점 최적화: 실제 계산 기능이 없으므로 반영한다고 안내하지 않는다.
- 결과 내보내기: 브라우저에서 서버 결과와 출처를 CSV로 다운로드한다. 문자열의 수식 실행을 방지하고 원 단위 금액은 보존한다.
- 입력 영구 저장·24시간 삭제: 구현하지 않는다. 현재 탭 메모리로만 유지하며 새로고침·계정 이동 시 초기화된다.

## 구조 변경

번들 HTML의 Base64 리소스 복원, Blob 스크립트, `new Function`, DC 템플릿 런타임을 일반 HTML과 DOM 이벤트로 교체했다.
원래의 폰트·색·입력 단계·좌측 내비게이션·우측 지출 요약·카드 상세 구조를 보존했다.
API 문자열은 `textContent`와 `Option`으로 렌더링하고, 외부 링크는 HTTP(S)만 허용한다.
입력 label, native radio/checkbox, 단계 `aria-current`, 결과 `aria-pressed`, 오류 알림, 화면 전환 포커스, 모바일 레이아웃과 동작 줄이기를 제공한다.

## 검증 기록

- `npm test`: 8개 계약·통신·입력 검증 통과.
- 최신 BE `bootJar` 빌드, 별도 일회용 PostgreSQL 및 개발 시드로 연동 검증.
- 실제 BE 브라우저 왕복: 추천 순서·개수·서버 금액, missingInputs, 혜택, 등급 재계산, 카탈로그 직접 계산, CSV, AI 비활성 폴백 통과.
- 실제 인증: 테스트 DB에 본인 확인 토큰을 주입한 가입·재설정, HttpOnly 쿠키, 로그인·로그아웃·전체 종료·현재 세션 폐기, CSRF 재발급 통과. 메일 발송은 하지 않았다.
- 오류 응답 대체 검증: 단계 검증 우회 차단, 422 후 입력 유지, 요청 취소 후 늦은 응답 무시, API 문자열 HTML 실행 차단, 오프라인 후 재시도 통과.
- Chromium 1440px·390px 화면 검증: 가로 넘침·미처리 JavaScript 오류 없음. 원본 테마와 단계 구조를 유지한 것을 캡처로 확인.
- 기계적 디자인 검사는 HTML 파서 모듈 미설치로 정규식 검사만 가능했다. 전체 접근성 자동 검사 결과로 간주하지 않았다.
- 실제 SMTP 배달·Google 공급자 로그인·운영 HTTPS와 쿠키 정책은 외부 설정 환경에서 추가 확인해야 한다.
