# Discord OAuth onboarding 운영

Bot 설치와 `/yoro setup` 운영 절차는 `docs/DISCORD_BOT_GATEWAY.md`를 함께 참고합니다.

이 기능은 Discord 사용자 OAuth로 관리 가능한 Guild를 검증하고 Organization에 연결하는 초기 설정 흐름입니다. Bot Gateway와 `/yoro setup`은 별도 프로세스로 추가됐으며, Agent·상태 수집·임의 메시지 전송은 포함하지 않습니다.

연결 완료 후 Organization 관리는 별도의 `identify` 전용 management OAuth와 YORO opaque session을 사용합니다. onboarding setup token이나 임시 Discord access token을 관리 로그인으로 재사용하지 않습니다. 자세한 내용은 `docs/DISCORD_BOT_MANAGEMENT.md`를 참고합니다.

## Discord Developer Portal

OAuth2 redirect URI에는 운영자가 확정한 단일 callback만 등록합니다.

```text
https://서비스-origin/api/discord/oauth/callback
```

요청 scope는 `identify guilds`뿐입니다. 사용자 OAuth와 Bot 설치의 `bot`, `applications.commands` scope를 섞지 않습니다.

## 활성화 순서

기본값은 `DISCORD_SAAS_ENABLED=false`입니다. Database가 비활성 상태이면 기존 방송 기능은 그대로 동작하고 Discord onboarding API만 `503 database_unavailable`을 반환합니다.

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

production에서는 다음 `_FILE` 방식을 우선합니다.

```text
DISCORD_CLIENT_SECRET_FILE=/run/secrets/discord_client_secret
DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY_FILE=/run/secrets/discord_oauth_token_encryption_key
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

## Rollback

기능 장애 시 `DISCORD_SAAS_ENABLED=false`로 되돌리면 기존 Twitch·Followers·Riot ID·Overlay 기능은 Database onboarding과 독립적으로 동작합니다. 적용한 migration SQL을 수정하거나 자동 down migration하지 않습니다. application rollback이 새 schema와 호환되지 않으면 배포 전 PostgreSQL backup을 별도 승인으로 복원합니다.
