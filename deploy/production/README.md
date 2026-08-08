# 운영 원클릭 Compose

이 디렉터리는 운영 호스트에서 다음 명령 하나로 YORO Server, PostgreSQL,
Discord Bot을 build·기동하기 위한 독립 Compose 프로젝트입니다.

```bash
cd deploy/production
docker compose up -d --build --force-recreate --wait
```

루트의 `docker-compose.yml`은 로컬 개발 호환용입니다. 운영에서는 반드시 이
디렉터리에서 실행합니다.

## 최초 실행 전 준비

다음 파일이 먼저 준비돼 있어야 합니다.

```text
/etc/yoro/runtime.json
/etc/yoro/legal.json
/etc/yoro/secrets/database_url
/etc/yoro/secrets/postgres_password
/etc/yoro/secrets/twitch_client_secret
/etc/yoro/secrets/twitch_token_encryption_key
/etc/yoro/secrets/riot_api_key
/etc/yoro/secrets/discord_client_secret
/etc/yoro/secrets/discord_oauth_encryption_key
/etc/yoro/secrets/discord_bot_token
/etc/yoro/secrets/bridge_shared_secret
/etc/yoro/secrets/dashboard_auth_token
/etc/yoro/secrets/overlay_access_token
```

Cloudflare Tunnel은 기본 배포의 필수 항목이 아닙니다. 외부 Tunnel이 필요한
운영자만 `/etc/yoro/secrets/cloudflare_tunnel_token`을 준비하고 아래
`edge` profile을 사용합니다.

```bash
docker compose --profile edge up -d --build --force-recreate --wait
```

Palworld REST 연결용 AES key는 위 목록에 포함되지 않습니다. Compose의
`palworld-credentials-init`가 최초 실행에만 별도
`palworld_credentials` named volume에 생성하고, 이후 배포에서는 같은 bytes를
검증해 재사용합니다. 운영자가 key 파일·UID·권한을 직접 준비할 필요가
없습니다.

기존 Palworld 암호문이 있는데 key volume만 유실된 경우에는 새로운 key로
덮어쓰지 않고 초기화 단계가 실패합니다. `docker compose down -v`와
`docker volume rm yoro-production_palworld_credentials`는 사용하지 않습니다.

Discord Bot과 Server 사이의 HMAC key도 호스트에서 두 파일로 수동 복제하지
않습니다. `discord-internal-auth-init`가 `discord_internal_auth` named volume에
동일한 key의 UID별 읽기 전용 사본을 최초 한 번 생성하고 이후 배포에서
검증해 재사용합니다. 따라서 두 secret 파일 값이 달라 Bot 명령이 401로
거부되는 상태가 발생하지 않습니다.

이 key는 외부 서비스 credential이 아니라 컨테이너 사이의 요청 인증에만
사용됩니다. `docker compose down`은 volume을 유지하지만 `docker compose
down -v` 또는 `docker volume rm yoro-production_discord_internal_auth`는
실행하지 않습니다.

예제 runtime은 운영 기반 기능을 켜지만 참여 모집 Discord 알림은 안전한 단계적
배포를 위해 `features.discordParticipationAnnounce=false`가 기본입니다. migration
`0017`·`0018`의 backup·plan·apply·검증이 끝난 뒤에만 활성화합니다. 활성 기능에
필요한 secret이 하나라도 없으면 `config-check`가 실제 서비스를 시작하기 전에
실패하며 secret 값은 로그에 출력하지 않습니다.

## Build identity

운영 호스트는 Git checkout이어야 합니다. Docker build는 제한적으로 포함된
`.git/HEAD`, 현재 branch ref 또는 `packed-refs`에서 commit SHA를 읽고,
`package.json` version과 실제 build 시각으로 `/app/release.json`을
생성합니다. `.env`나 수동 `GIT_SHA`, `BUILD_TIME` 입력은 필요하지 않습니다.

working tree의 미커밋 변경은 image에 포함될 수 있으므로 운영 업데이트 전
다음을 확인합니다.

```bash
git status --short
```

출력이 없어야 합니다.

## 상태 확인

```bash
docker compose ps
docker compose logs --tail=100 discord-internal-auth-init palworld-credentials-init config-check server discord-bot
curl -fsS http://127.0.0.1:3000/health/live
curl -fsS http://127.0.0.1:3000/health/ready
```

이전 배포에서 Cloudflared가 이미 실행 중이고 더 이상 사용하지 않는다면 한
번만 다음 명령으로 중지합니다. Database와 Palworld 연결 volume에는 영향을
주지 않습니다.

```bash
docker compose --profile edge stop cloudflared
```

PostgreSQL migration은 자동 적용하지 않습니다. pending migration이 있으면
Server는 fail-closed 상태가 되며, backup과 migration plan 검토 후 별도 승인
절차로 적용해야 합니다.

## 중지

```bash
docker compose down
```

Database와 runtime state를 유지해야 하므로 `down -v`와
`docker system prune`은 사용하지 않습니다.
