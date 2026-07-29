# Discord OAuth onboarding 운영

Bot 설치와 `/yoro setup` 운영 절차는 `docs/DISCORD_BOT_GATEWAY.md`를 함께 참고합니다.

기본 연결 경로는 `/bot`에서 Bot을 설치한 뒤 `/bot/manage`에서 Discord로 로그인하는 웹 중심 흐름입니다. `identify guilds`로 확인한 관리 가능 Guild와 현재 Application ID의 활성 설치 관찰을 교집합으로 계산하고, 선택한 Guild만 Organization에 연결합니다. `/yoro setup`은 Guild·실행자 binding을 유지한 보조·복구 경로로 남습니다.

연결 완료 transaction에서 새 YORO opaque management session을 발급하므로 같은 흐름에서 Dashboard로 진입할 수 있습니다. 기존 사용자 로그인은 별도의 `identify` 전용 management OAuth를 사용합니다. setup token, OAuth access token과 management session은 서로 재사용하지 않습니다. 자세한 내용은 `docs/DISCORD_BOT_MANAGEMENT.md`를 참고합니다.

## Discord Developer Portal

OAuth2 redirect URI에는 운영자가 확정한 단일 callback만 등록합니다.

```text
https://서비스-origin/api/discord/oauth/callback
```

Guild 연결 OAuth scope는 `identify guilds`뿐입니다. Bot 설치 URL은 Server의 고정 Application ID와 `bot applications.commands`, permission integer `0`으로 생성하며 브라우저 query를 신뢰하지 않습니다.

## 활성화 순서

기본값은 `runtime.json`의 `features.discordSaas=false`입니다. Database가
비활성 상태이면 기존 방송 기능은 그대로 동작하고 Discord onboarding API만
`503 database_unavailable`을 반환합니다.

운영 적용은 다음 순서를 따릅니다.

```text
PostgreSQL backup
→ migration check
→ migration plan
→ 운영자 검토
→ 승인된 migration apply
→ Discord config validation
→ feature 비활성 상태 배포
→ health 검증
→ staging OAuth 검증
→ feature 활성화
→ smoke test
```

Server 시작 과정에서는 migration을 자동 적용하지 않습니다.

## Secret

production에서는 환경 변수 경로를 받지 않고 다음 고정 파일만 사용합니다.

```text
/run/secrets/discord_client_secret
/run/secrets/discord_oauth_encryption_key
```

파일은 regular file, symlink 아님, `0600`이어야 합니다. OAuth encryption key는 강한 32바이트 key이며 Twitch token encryption key와 Dashboard 인증 secret을 재사용할 수 없습니다.

Token record는 AES-256-GCM으로 암호화합니다. AAD에는 store type, schema version, Discord user ID, OAuth session ID와 purpose가 포함됩니다. access token은 Guild 선택에 필요한 짧은 session 동안만 보관하고 완료·만료·logout 때 폐기합니다. refresh token은 영구 저장하지 않습니다.

Client secret이나 encryption key가 노출되면 기능 flag를 끄고 Discord Developer Portal에서 client secret을 회전한 뒤, 별도 key version migration 계획으로 encryption key를 회전합니다. 기존 session은 폐기하고 새 setup 링크를 발급합니다.

## Setup link와 권한

Setup link 기본 수명은 10분이며 원본 token은 Database에 저장하지 않습니다. 같은 setup token으로는 OAuth session 하나만 만들 수 있고 OAuth state와 Guild 연결은 one-time입니다.

Guild는 Discord API에서 매번 최신 목록을 조회해 다음 중 하나를 만족할 때만 연결합니다.

- Guild owner
- `ADMINISTRATOR`
- `MANAGE_GUILD`

Permission bitfield는 `BigInt`로 처리합니다. Browser가 보낸 Guild 이름·owner·permission은 신뢰하지 않습니다. 하나의 Guild는 한 Organization에만 연결되며 기존 연결을 자동 이동하거나 탈취하지 않습니다.

웹 claim 직전에는 Discord API의 최신 권한, 현재 Application ID의 `discord_bot_installation_observations.status=observed`, Organization membership과 entitlement를 transaction 경계에서 다시 확인합니다. 새 Organization을 선택하면 Organization, owner membership, Free entitlement, Guild, installation, audit log와 management session을 함께 저장합니다. 어느 단계든 실패하면 부분 record를 남기지 않습니다.

## Rollback

기능 장애 시 `runtime.json`의 `features.discordSaas=false`로 되돌리면 기존
Twitch·Followers·Riot ID·Overlay 기능은 Database onboarding과 독립적으로
동작합니다. 적용한 migration SQL을 수정하거나 자동 down migration하지
않습니다. application rollback이 새 schema와 호환되지 않으면 배포 전
PostgreSQL backup을 별도 승인으로 복원합니다.
