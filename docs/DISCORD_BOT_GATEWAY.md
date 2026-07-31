# YORO Discord Bot Gateway 운영

## 범위와 장애 경계

`apps/discord-bot`은 `apps/server`와 분리된 프로세스다. Bot 장애는 Discord 명령에만 영향을 주며 Twitch, Followers, LoL, Palworld, Overlay와 Server readiness를 변경하지 않는다.

현재 등록 명령:

- `/yoro setup`: Guild와 실행자에게 귀속된 10분 일회용 설정 링크 발급
- `/yoro help`: 현재 제공되는 명령 안내
- `/yoro dashboard`: token이나 Organization ID가 없는 고정 `/dashboard` 링크를 ephemeral로 제공

일반 사용자가 공개 채널에서 사용할 수 있는 prefix 명령은 별도 feature flag를
켰을 때만 제공한다.

- `!yoro 상태`: 현재 Guild에 연결된 Palworld 서버의 안전한 상태 요약
- `!yoro 가이드`: Palworld 전용 서버 설정 페이지
- `!yoro 도움말`: 현재 제공되는 일반 사용자 명령

한국어 명령 외에 일본어 `ステータス`, `ガイド`, `ヘルプ`와 영문
`status`, `guide`, `help`를 exact allowlist로 지원한다. 인수와 자유 형식
문장은 받지 않는다. prefix 응답은 Discord의 일반 채널 메시지이며
ephemeral이 아니다. 서버 주소, REST URL, `AdminPassword`, Agent credential,
Organization ID와 내부 오류 정보는 표시하지 않는다.

Agent 등록·상태 수집 기반은 재사용하지만 Notification Worker, RCON, 서버
제어와 임의 메시지 전송은 포함하지 않는다. 상태 이력 저장 기준을 확정하기
전까지 `!yoro 기록`은 제공하지 않는다.

## Discord Developer Portal

1. Application과 Bot을 생성한다.
2. prefix 명령이 꺼진 기본 상태에서는 Gateway intent로 `GUILDS`만 사용한다.
3. prefix 명령을 켤 때만 `GUILD_MESSAGES`와 privileged
   `MESSAGE_CONTENT`를 추가한다. Developer Portal에서도 Message Content
   Intent를 명시적으로 활성화해야 한다.
4. `GUILD_MEMBERS`, `GUILD_PRESENCES`는 사용하지 않는다.
5. OAuth redirect URI는 정확한 `/api/discord/oauth/callback` HTTPS URL만 등록한다.
6. 설치 URL scope는 `bot`, `applications.commands`만 사용한다.
7. prefix 명령이 꺼지면 Bot permission은 `0`이다. 켜면
   `View Channels`, `Send Messages`, `Embed Links`만 요청한다.
   `Administrator`, `Manage Guild`, `Manage Messages`, `Mention Everyone`은
   요청하지 않는다.

Guild 관리자는 prefix 명령을 사용할 채널에서 Bot의 채널 보기, 메시지 보내기,
링크 임베드 권한을 허용해야 한다. Bot은 사용자·역할 mention을 생성하지
않으며 사용자별 10초 cooldown과 Guild별 단기 제한을 적용한다.

## Secret

운영에서는 다음 고정 경로에 권한 `0400` 또는 `0600`인 regular file을
제공한다.

- Bot token: `/run/secrets/discord_bot_token` (`discord-bot` 전용)
- 내부 인증 key: `/run/secrets/discord_internal_auth_key` (Bot·Server 공유)

Internal key는 Discord OAuth encryption key, Twitch key, Dashboard·Bridge secret과 다른 값을 사용한다. 실제 값, 일부 마스킹 값과 길이는 로그에 기록하지 않는다.
Compose는 Bot UID/GID `10002`가 읽을 수 있도록 두 secret을 read-only로
mount한다. Bot token은 Server에 mount하지 않고, Server의 Database·Twitch·
Riot secret은 Bot에 mount하지 않는다.

## 활성화와 command 등록

1. PostgreSQL backup 생성·검증
2. migration `check`, `plan`
3. 0005와 0006 검토 후 별도 승인으로 apply
4. `runtime.json`의 `features.discordBot=true` 적용 전 secret과 내부 경로 검증
5. Bot feature 비활성 상태로 image와 health 검증
6. staging Guild에서 `commands:plan`
7. 승인 후 `commands:apply -- --apply`
8. staging OAuth와 Guild·사용자 binding 검증
9. Bot feature 활성화
10. production global plan 검토
11. 별도 승인 후 `--apply --confirm-production=REGISTER_YORO_COMMANDS`

prefix 명령은 slash command manifest 등록 대상이 아니다. 운영에서는
`runtime.json`의 다음 한 항목을 변경한 뒤 Server와 Discord Bot을 함께
재시작한다.

```json
{
  "discord": {
    "prefixCommandsEnabled": true
  }
}
```

기본값은 `false`다. Server와 Bot의 값이 다르면 설치 URL permission과 Gateway
intent가 어긋날 수 있으므로 같은 runtime 파일을 읽어야 한다. 로컬 legacy
설정에서는 `DISCORD_BOT_PREFIX_COMMANDS_ENABLED=true`를 사용할 수 있지만
운영 Compose는 이 환경 변수를 사용하지 않는다.

`/yoro dashboard`는 Discord command에서 인증 정보를 전달하지 않습니다. 사용자는 Browser에서 별도의 management OAuth와 YORO opaque session을 거쳐야 하며 자세한 정책은 `docs/DISCORD_BOT_MANAGEMENT.md`를 따릅니다.

Server 시작이나 Gateway reconnect는 command를 자동 등록하지 않는다. 알 수 없는 기존 command도 자동 삭제하지 않는다. Global command 전파에는 시간이 걸릴 수 있다.

## 내부 API 인증

Bot은 Docker internal network를 통해 `/internal/discord/*`를 호출한다. reverse proxy와 Cloudflare에서는 `/internal/`을 공개 route로 전달하지 않는다.

`!yoro 상태`는 서명된
`POST /internal/discord/command-policy`로 현재 Organization의 module·명령
정책을 먼저 조회한 뒤, 허용된 경우에만
`POST /internal/discord/game-server-status`를 호출한다. 정책 응답은 설정
revision, 응답 locale과 표시 가능한 상태 field allowlist만 포함한다.
정책 조회 실패, 잘못된 응답, 비활성 설치·module·명령은 fail-closed 처리하며
Guild의 다른 서비스나 Server readiness에는 영향을 주지 않는다.

Server는 요청의
Application ID와 Guild ID로 활성 설치와 Organization을 다시 결정한 뒤
tenant-bound 조회를 수행한다. 메시지나 URL에서 받은 Organization ID와 게임
서버 ID를 신뢰하지 않는다. REST 연결과 Agent 연결은 각각의 현재 상태
source만 읽으며 서로의 값을 섞지 않는다.

Dashboard는 Bot token을 보유하거나 Discord Gateway에 직접 연결하지 않는다.
설정 변경은 Server의 Organization 관리 API로만 수행하고 Gateway는 서명된
내부 정책을 실행 시점에 조회한다. Server에서 Gateway로 임의 action을
push하는 inbound 관리 endpoint는 제공하지 않는다.

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

prefix 명령에 문제가 생기면 `discord.prefixCommandsEnabled=false`로 되돌리고
Server와 Bot만 재시작한다. Database migration이나 command 재등록은 필요하지
않다. Bot service만 중지해도 Server와 방송 기능은 유지된다. 이전 immutable
Bot image와 command manifest를 보존한다.

Internal key는 Bot과 Server에 새 file을 준비한 뒤 유지보수 시간에 교체하고 이전 key를 폐기한다. Bot token 노출 시 Developer Portal에서 즉시 회전한다.
