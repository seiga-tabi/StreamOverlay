# YORO 통합 계정

YORO는 별도의 이메일·비밀번호 계정을 만들지 않습니다. PostgreSQL의 `users.id`가
서비스 내부의 유일한 사용자 식별자이며 Discord와 Twitch는 로그인 수단이자 연결된
외부 identity입니다.

```text
YORO Account
├─ Discord identity
├─ Twitch identity
├─ Riot RSO identity (연결 전용)
└─ Organization memberships
```

권한은 OAuth provider나 표시 이름이 아니라 YORO `user_id`에 연결된 Organization
membership으로 판정합니다. Discord와 Twitch의 이메일·닉네임·표시 이름이 같아도
계정을 자동으로 합치지 않습니다.

## 로그인과 계정 연결

- `/login`은 Discord와 Twitch 로그인을 제공합니다.
- 로그인 성공 시 provider access token은 사용자 identity 조회에만 사용하고 저장하지
  않습니다.
- 모든 provider는 같은 형식의 `yoro_session`을 발급합니다.
- `/account/connections`에서 현재 연결 상태를 확인하고 provider를 연결하거나
  해제할 수 있습니다.
- 계정 연결은 `purpose=link_identity`로 로그인과 분리하며, 로그인된 session과 최근
  인증이 필요합니다.
- 이미 다른 YORO user에 연결된 identity는 `identity_conflict`로 차단합니다.
- 마지막 로그인 수단은 해제할 수 없습니다.
- 연결 또는 해제 후 해당 사용자의 기존 YORO session을 모두 폐기합니다.

Riot RSO는 로그인 수단이 아닙니다. Twitch로 최근 인증한 YORO session에서만
`purpose=link_identity`로 시작하며 callback에서도 같은 user와 Twitch 인증을 다시
확인합니다. Riot access token은 `/riot/account/v1/accounts/me` 확인 후 저장하지
않고 PUUID와 표시용 Riot ID만 identity로 보관합니다. 상세 설정은
`docs/RIOT_RSO.md`를 따릅니다.

초기 버전은 서로 다른 YORO user 사이의 자동 병합을 제공하지 않습니다. 충돌 계정의
membership과 리소스를 안전하게 합치는 별도 운영 절차가 준비되기 전에는 identity를
이동하지 않습니다.

## Session과 CSRF

`yoro_sessions`에는 session token과 CSRF token의 SHA-256 hash만 저장합니다. Cookie는
`HttpOnly`, `SameSite=Lax`, production `Secure`, `Path=/`로 발급합니다. 원문 token은
URL, 로그, Database 또는 브라우저 `localStorage`에 저장하지 않습니다.

- idle timeout: 기존 Discord management 정책 이하
- absolute lifetime: 기존 Discord management 정책 이하
- mutation: trusted Origin과 session-bound CSRF를 함께 검증
- logout·연결 변경·만료: session 즉시 폐기
- account API: 외부 provider subject와 OAuth metadata를 응답하지 않음

OAuth state와 cookie binding은 hash만 저장합니다. Discord PKCE verifier는 기존
AES-256-GCM key로 임시 암호화하되 AAD purpose를 `yoro_account_pkce`로 분리하고,
완료·실패·만료 시 폐기합니다. Twitch와 Discord access token 및 refresh token은
YORO session으로 재사용하거나 영구 저장하지 않습니다.

## 기존 인증과 단계적 전환

기존 Discord onboarding·Guild claim과 Twitch 공개 session은 회귀 방지를 위해 당분간
유지합니다. `/dashboard/organizations`는 YORO session을 인증해 Organization과 Discord Bot 관리를 제공하고 기존 Discord management
session을 호환 경로로 허용합니다. 신규 로그인 진입은 `/login`으로 통합합니다.

Twitch EventSub·팔로워처럼 장기 provider authorization이 필요한 기능은 로그인 identity와
분리된 기존 authorization 정책을 계속 사용합니다. YORO 로그인 성공만으로 장기 Twitch
access token을 저장하거나 scope를 확대하지 않습니다.

## Migration과 운영

`0009_yoro_account_identity_and_session.sql`은 다음을 additive하게 추가합니다.

- `users.status`
- `external_identities`
- `yoro_oauth_sessions`
- `yoro_sessions`
- 기존 Discord·Twitch user 식별자의 identity backfill

`0020_yoro_riot_rso_identity.sql`은 기존 migration을 수정하지 않고 `riot` identity와
link-only OAuth session 제약을 추가합니다.

기존 migration은 수정하지 않습니다. 운영 적용 전에는 PostgreSQL backup, migration
`check`, `plan`, staging 로그인·연결·충돌·해제 검증이 필요합니다. rollback은 먼저
통합 계정 진입을 비활성화하고 호환 가능한 이전 image로 되돌립니다. SQL down migration은
자동 실행하지 않습니다.
