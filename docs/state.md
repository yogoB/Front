# 요고비 프론트 현재 상태

기준일: 2026-09-11. 이 문서는 작업 트리의 현재 구현 상태를 요약한다. API 계약과 화면별 동작은 [연동 명세](integration.md), 실행 방법은 [실행 안내](../README.md), 재편성 전 프로토타입 분석은 [이전 분석](README.md)을 본다.

## 한 줄 요약

번들 HTML 프로토타입을 런타임·빌드 의존성 없는 정적 웹 앱으로 재편성하고, 브라우저 고정 계산을 제거해 `BE_main` API의 금액·순서·출처를 그대로 표시하도록 연결했다. `npm test`는 8개 계약·검증을 통과한다.

## 구현 완료

- 정적 앱 구성: `index.html`(통신→구독→우선순위→결과·문장 추천), `account.html`(회원·세션), `src/*.js`, `src/styles.css`, `assets/`.
- 공개 API 연결: 카탈로그 서비스·요금제·혜택 조회, 조건 추천, 특정 등급 계산, 문장 추천.
- 회원 API 연결: 상태 조회, 로그인·로그아웃·전체 종료, 이메일 확인 가입·비밀번호 재설정, Google 연결, 세션 관리. 변경 요청마다 CSRF 재발급, 쿠키 인증, JWT 미저장.
- 서버 결과 표시: 순서·개수 유지, `monthlyTotal`/`baseline`/`monthlySavings`/`annualSavings` 원본 출력, `breakdown`에 출처(Provenance)·설명 병기, `missingInputs`·`warnings` 노출.
- 공통 클라이언트(`src/api.js`): 오류 코드·필드 보존, 65초 제한, 취소(AbortError) 처리, 지연 응답·이전 혜택 조회 덮어쓰기 방지.
- 결과 CSV 내보내기: 서버 금액·출처 보존, 수식형 문자열 중화.
- 접근성·반응형: label 연결, native radio/checkbox, 단계 `aria-current`, 결과 `aria-pressed`, 오류 알림, 화면 전환 포커스, 모바일 레이아웃.

## 의도적으로 미지원 (BE API 없음)

- 고지서 이미지 업로드·OCR: 수신 API 없음 → 업로드 버튼 비활성.
- 추천 조합 서버 저장: 저장 API 없음 → 저장 버튼 "준비 중".
- 회원 구독 저장·결제 업로드·중복 결제 탐지: HTTP API 미구현 → 호출하지 않음.
- 약정 종료·위약금·전환 시점 최적화: 실제 계산 기능 없음 → 반영한다고 안내하지 않음.
- 입력 영구 저장·24시간 삭제: 탭 메모리로만 유지, 새로고침·계정 이동 시 초기화.

## 검증 상태

- `npm test`: 8/8 통과(계약·공개/회원 호출·입력 검증·CSRF·오류·취소·CSV).
- 실제 BE 왕복·인증·오류 대체·Chromium 화면 검증 기록은 [연동 명세 §검증 기록](integration.md)에 있다.
- 미검증: 실제 SMTP 배달, Google 공급자 로그인, 운영 HTTPS·쿠키 정책(외부 설정 환경 필요).

## 다음 확인 지점

- 운영 배포 시 `/api`·`/oauth2`·`/login/oauth2` 프록시 또는 같은 사이트 BE 오리진 구성. Spring 보안이 새 JS/CSS 경로를 허용하도록 설정 필요.
- BE 계약 변경 시 `src/model.js`의 요청 변환과 `docs/integration.md`를 같은 날 맞춘다.
