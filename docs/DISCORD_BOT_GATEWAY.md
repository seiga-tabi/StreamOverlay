# YORO Discord Bot Gateway 운영

## 범위와 장애 경계

`apps/discord-bot`은 `apps/server`와 분리된 프로세스다. Bot 장애는 Discord 명령에만 영향을 주며 Twitch, Followers, LoL, Palworld, Overlay와 Server readiness를 변경하지 않는다.

현재 등록 명령:

- `/yoro setup`: Guild와 실행자에게 귀속된 10분 일회용 설정 링크 발급
- `/yoro help`: 현재 제공되는 명령 안내
- `/yoro dashboard`: token이나 Organization ID가 없는 고정 `/bot/manage` 링크를 ephemeral로 제공

Agent, 상태 수집, Notification Worker, RCON과 임의 메시지 전송은 포함하지 않는다.

## Discord Developer Portal

1. Application과 Bot을 생성한다.
2. Gateway intent는 `GUILDS`만 사용한다.
3. `GUILD_MEMBERS`, `GUILD_PRESENCES`, `MESSAGE_CONTENT`는 활성화하지 않는다.
4. OAuth redirect URI는 정확한 `/api/discord/oauth/callback` HTTPS URL만 등록한다.
5. 설치 URL scope는 `bot`, `applications.commands`만 사용한다.
6. Bot permission으로 `Administrator`를 요청하지 않는다. 이번 단계는 공개 채널 메시지를 보내지 않아 추가 메시지 관리 permission도 필요하지 않다.

## Secret

운영에서는 다음 secret을 권한 `0400`인 regular file로 제공한다.

- `DISCORD_BOT_TOKEN_SOURCE_FILE`: 호스트의 Bot token 원본 파일
- `DISCORD_BOT_INTERNAL_AUTH_KEY_SOURCE_FILE`: 호스트의 내부 인증키 원본 파일
- `DISCORD_BOT_TOKEN_FILE`: Bot 컨테이너 내부의 `/run/secrets/discord_bot_token`
- `DISCORD_BOT_INTERNAL_AUTH_KEY_FILE`: Bot과 Server 컨테이너 내부의 `/run/secrets/discord_bot_internal_auth_key`

Internal key는 Discord OAuth encryption key, Twitch key, Dashboard·Bridge secret과 다른 값을 사용한다. 실제 값, 일부 마스킹 값과 길이는 로그에 기록하지 않는다.
Compose는 Bot UID/GID `10002`에 두 secret을 `0400`으로 mount한다. 호스트 원본 경로 변수와 컨테이너 `_FILE` 변수를 같은 값으로 재사용하지 않는다.
Bot token 원본의 기본 위치인 `./discord-bot-secrets`는 Server의 `./secrets:/run/secrets` bind mount와 Docker build context에서 제외된다. 따라서 Bot token은 `discord-bot` 컨테이너에만 mount된다.

## 활성화와 command 등록

1. PostgreSQL backup 생성·검증
2. migration `check`, `plan`
3. 0005와 0006 검토 후 별도 승인으로 apply
4. Server에 `DISCORD_BOT_INTERNAL_API_ENABLED=true`
5. Bot은 `DISCORD_BOT_ENABLED=false` 상태로 image와 health 검증
6. staging Guild에서 `commands:plan`
7. 승인 후 `commands:apply -- --apply`
8. staging OAuth와 Guild·사용자 binding 검증
9. Bot feature 활성화
10. production global plan 검토
11. 별도 승인 후 `--apply --confirm-production=REGISTER_YORO_COMMANDS`

`/yoro dashboard`는 Discord command에서 인증 정보를 전달하지 않습니다. 사용자는 Browser에서 별도의 management OAuth와 YORO opaque session을 거쳐야 하며 자세한 정책은 `docs/DISCORD_BOT_MANAGEMENT.md`를 따릅니다.

Server 시작이나 Gateway reconnect는 command를 자동 등록하지 않는다. 알 수 없는 기존 command도 자동 삭제하지 않는다. Global command 전파에는 시간이 걸릴 수 있다.

## 내부 API 인증

Bot은 Docker internal network를 통해 `/internal/discord/*`를 호출한다. reverse proxy와 Cloudflare에서는 `/internal/`을 공개 route로 전달하지 않는다.

서명 입력:

```text
version
timestamp
nonce
HTTP method
request path
SHA-256 body hash
```

Server는 60초 clock skew, nonce one-time 사용, method·path·body binding과 timing-safe HMAC-SHA256 비교를 검증한다. Browser Origin 요청은 차단한다.

## Setup 보안

- DM 실행 차단
- Guild owner, `ADMINISTRATOR`, `MANAGE_GUILD` 중 하나 필요
- Discord 응답은 항상 ephemeral
- setup token은 DB에 SHA-256 hash만 저장
- setup URL과 interaction token은 로그에 미기록
- 같은 Guild·사용자의 활성 session은 하나만 허용하고 만료 전 재발급 거부
- OAuth 사용자와 명령 실행자가 다르면 session 폐기
- OAuth Guild와 명령 실행 Guild가 다르면 연결 차단
- 완료·만료 시 OAuth token 암호문과 PKCE verifier 폐기

## 설치 lifecycle

`GUILD_CREATE`는 소유권을 만들지 않고 설치 관찰 record만 upsert한다. `/yoro setup`과 OAuth 재검증이 완료된 뒤 기존 `discord_installations`에 Organization 귀속 설치를 기록한다.

`GUILD_DELETE`는 관찰 record만 revoked로 바꾸고 Organization과 Guild 데이터는 삭제하지 않는다. 재설치가 관찰되면 다시 활성화할 수 있다.

## Health와 자원

Bot health는 내부 `3100` port에서만 제공한다.

- `/health/live`: 프로세스 event loop 상태
- `/health/ready`: Gateway READY 또는 RESUMED

응답에는 token, Gateway session ID, resume URL, Guild·사용자 목록이 없다.

초기 제한은 memory 256MB, CPU 0.25이며 non-root, read-only root와 `/tmp` tmpfs를 사용한다. PostgreSQL 768MB와 함께 4GB VPS에서 OS 여유를 남기되 실제 RSS는 staging에서 다시 측정한다.

## Rollback과 key 회전

문제가 생기면 Bot service만 중지하고 Server와 방송 기능은 유지한다. 이전 immutable Bot image와 command manifest를 보존한다.

Internal key는 Bot과 Server에 새 file을 준비한 뒤 유지보수 시간에 교체하고 이전 key를 폐기한다. Bot token 노출 시 Developer Portal에서 즉시 회전한다.
