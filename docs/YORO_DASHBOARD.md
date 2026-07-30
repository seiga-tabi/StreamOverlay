# YORO 사용자 Dashboard

## 목적

`/dashboard`는 Discord 또는 Twitch로 로그인한 모든 YORO 사용자가 이용하는 공통
Dashboard입니다. 별도 이메일·비밀번호 계정을 만들지 않고, provider identity는 로그인
수단으로만 사용합니다. Organization 역할과 Discord Guild 권한은 기존 server-side
검증을 그대로 사용합니다.

## 경로

- `/dashboard`: 계정 연결과 Organization 설정 진행 상태
- `/dashboard/account`: Discord·Twitch identity 연결 및 해제
- `/dashboard/organizations`: Discord Guild, Organization, Palworld 게임 서버와 Agent 설정
- `/dashboard/settings`: 언어, 기본 화면, reduced motion 설정
- `/bot/manage`: 기존 링크를 위한 호환 관리 화면

기존 Twitch 방송 운영 Dashboard의 `/dashboard/followers`,
`/dashboard/riot-id`, `/dashboard/{streamerSlug}/{dashboardKey}/...` 경로와 인증
정책은 변경하지 않습니다. 공통 Dashboard의 YORO session을 방송 운영 권한으로
사용하지 않습니다.

## 인증과 권한

- `/dashboard` 화면 자체는 유효한 opaque `yoro_session`이 있으면 이용할 수 있습니다.
- session 원문과 CSRF token 원문은 Database에 저장하지 않습니다.
- Organization과 게임 서버 데이터는 매 요청에서 membership과 role을 다시 검증합니다.
- URL의 Organization ID나 브라우저가 보낸 role은 신뢰하지 않습니다.
- Twitch identity와 Discord identity는 명시적인 연결 절차 없이 자동 병합하지 않습니다.

## 개인 설정

`0010_yoro_dashboard_preferences.sql`은 사용자별로 다음 값만 저장합니다.

- `locale`: `ko` 또는 `ja`
- `default_dashboard_page`: `overview`, `account`, `organizations`, `settings`
- `reduced_motion`: boolean

설정 변경은 `PATCH /api/account/preferences`에서 trusted Origin, YORO session과
`X-Yoro-CSRF`를 모두 검증합니다. 클라이언트가 보낸 user ID는 받지 않으며, 인증된
session의 내부 user ID만 사용합니다.

## 배포와 rollback

Server 시작 시 migration을 자동 적용하지 않습니다. 운영 반영 전 Database backup을
확인하고 migration `check`, `plan`을 실행한 뒤 별도 승인으로 `0010`을 적용합니다.
기능 rollback은 이전 immutable image로 수행하되, 적용된 migration SQL을 수정하거나
자동 down migration하지 않습니다.
