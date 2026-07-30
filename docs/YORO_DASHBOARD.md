# YORO 사용자 Dashboard

## 목적

`/dashboard`는 Discord 또는 Twitch로 로그인한 모든 YORO 사용자가 이용하는 공통
Dashboard입니다. 별도 이메일·비밀번호 계정을 만들지 않고, provider identity는 로그인
수단으로만 사용합니다. Organization 역할과 Discord Guild 권한은 기존 server-side
검증을 그대로 사용합니다.

## 경로

- `/dashboard`: 계정 연결과 Organization 설정 진행 상태
- `/dashboard/account`: Discord·Twitch identity 연결 및 해제
- `/dashboard/organizations`: Discord Guild, Organization, Palworld 게임 서버와 REST 연결 설정
- `/dashboard/streaming`: Twitch 연결과 스트리머 승인 진행 상태
- `/dashboard/streaming/permissions`: Followers 조회용 Twitch 최소 권한 승인
- `/dashboard/streaming/followers`: 승인된 스트리머의 Followers 관리
- `/dashboard/streaming/riot-id`: 승인된 스트리머의 Riot ID 관리
- `/dashboard/settings`: 언어, 기본 화면, reduced motion 설정
- `/setup/discord`, `/bot/manage`: 별도 화면을 제공하지 않고 `/dashboard/organizations`로 redirect하는 legacy URL

기존 Twitch 방송 운영 Dashboard의
`/dashboard/{streamerSlug}/{dashboardKey}/...` 경로는 key와 query를 제거한 통합
경로로 redirect합니다. Followers와 Riot ID는 별도 Dashboard session이나 URL key를
사용하지 않고 공통 YORO session에서 인증합니다.

Frontend에서는 기존 스트리머 전용 진입 화면과
`X-StreamOps-Streamer-Slug`·`X-StreamOps-Dashboard-Key` 전송을 제거했습니다.
과거 링크로 접근하면 브라우저 주소를 즉시 key가 없는 통합 경로로 교체합니다.
Server의 기존 방송 운영 API 호환 계층은 운영 전환과 rollback을 위해 이번 정리
범위에서 유지하며, 사용량을 확인한 뒤 별도 migration 없이 단계적으로 제거합니다.

## 인증과 권한

- `/dashboard` 화면 자체는 유효한 opaque `yoro_session`이 있으면 이용할 수 있습니다.
- session 원문과 CSRF token 원문은 Database에 저장하지 않습니다.
- Organization과 게임 서버 데이터는 매 요청에서 membership과 role을 다시 검증합니다.
- URL의 Organization ID나 브라우저가 보낸 role은 신뢰하지 않습니다.
- Twitch identity와 Discord identity는 명시적인 연결 절차 없이 자동 병합하지 않습니다.
- 모든 사용자는 스트리머 메뉴와 승인 진행 상태를 볼 수 있지만, Followers와 Riot ID
  변경은 현재 YORO session의 Twitch identity가 승인된 경우에만 사용할 수 있습니다.
- 계정 연결과 스트리머 권한은 분리합니다. Twitch identity가 이미 연결되어 있으면
  다시 로그인시키지 않고 Riot ID 승인 신청을 받습니다.
- Followers 조회는 승인 후 `moderator:read:followers` scope를 별도로 요청합니다.
- 통합 API 응답에는 기존 `dashboardKey`, `overlayKey`, OAuth token을 포함하지 않습니다.

## 스트리머 승인 흐름

```text
YORO 로그인
→ Twitch identity 연결 확인
→ Riot ID로 스트리머 승인 신청
→ 관리자 승인
→ Followers 최소 권한 승인
→ Followers·Riot ID 관리
```

방송 자동화와 Overlay 관리는 통합 사용자 Dashboard 범위에 포함하지 않습니다.

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
