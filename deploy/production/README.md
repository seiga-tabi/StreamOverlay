# 운영 원클릭 Compose

이 디렉터리는 운영 호스트에서 다음 명령 하나로 YORO Server, PostgreSQL,
Discord Bot, Cloudflared를 build·기동하기 위한 독립 Compose 프로젝트입니다.

```bash
cd deploy/production
docker compose up -d --build
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
/etc/yoro/secrets/discord_internal_auth_key_server
/etc/yoro/secrets/discord_internal_auth_key_bot
/etc/yoro/secrets/bridge_shared_secret
/etc/yoro/secrets/dashboard_auth_token
/etc/yoro/secrets/overlay_access_token
/etc/yoro/secrets/cloudflare_tunnel_token
```

`discord_internal_auth_key_server`와 `discord_internal_auth_key_bot`은 동일한
값이지만 각각 Server UID `10001`, Bot UID `10002`만 읽을 수 있는 별도
파일이어야 합니다. 컨테이너 안에서는 둘 다 고정 경로
`/run/secrets/discord_internal_auth_key`로 보입니다.

예제 runtime처럼 모든 기능을 켠 구성이므로 활성 기능에 필요한 secret이
하나라도 없으면 `config-check`가 실제 서비스를 시작하기 전에 실패합니다.
secret 값은 로그에 출력하지 않습니다.

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
docker compose logs --tail=100 config-check server discord-bot cloudflared
curl -fsS http://127.0.0.1:3000/health/live
curl -fsS http://127.0.0.1:3000/health/ready
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
