# 운영 원클릭 Compose

이 디렉터리는 운영 호스트에서 다음 명령 하나로 YORO Server, PostgreSQL,
Discord Bot을 build·기동하기 위한 독립 Compose 프로젝트입니다. 운영 업데이트는
[SQL migration 런북](../../docs/SQL_MIGRATION_APPLICATION_RUNBOOK.md) §7~9를 따르는
배포 스크립트로 실행합니다.

```bash
cd deploy/production
./deploy.sh
```

기존 PostgreSQL이 healthy인 운영 호스트의 maintenance window에서 실행합니다.
호스트에 Bash, Git, Docker Compose v2, `jq`, `flock`(util-linux), `curl`,
`sha256sum`(coreutils), `df`, `awk`가 필요합니다. Docker 접근과 `/var/run/yoro-deploy.lock`,
`/var/backups/yoro/postgres` 생성 권한이 있는 운영 계정(런북은 root 기준)을 사용합니다.
최초 설치에서는 아래 설정·secret 준비와 PostgreSQL 기동을 먼저 완료합니다.

```bash
docker compose up -d postgres
./deploy.sh                 # 최초 배포도 빌드부터 실행
```

실행 옵션 (`--dry-run`만 기존 이미지가 필요하며, `--yes`는 빌드부터 수행):

```bash
./deploy.sh --dry-run       # 기존 이미지로 읽기 전용 check/plan만 조회
./deploy.sh --yes           # 비파괴 migration 승인만 명시적으로 생략
```

기본 실행은 이미지 build → check/plan → `yes` 승인 → 새 백업·archive/checksum
검증 → writer 중지 → 동일 plan 재확인 → apply → check → 기동·호스트 health
확인 순서입니다. pending이 없으면 백업·중지·apply 없이 기동합니다. 미커밋 변경은
`--yes`/`--auto-confirm`에서도 반드시 별도 `yes` 입력이 필요합니다. destructive는
어떤 옵션에서도 중단하며 런북 §8.7의 수동 검토·승인 절차를 따릅니다.

`--dry-run`은 빌드·이미지 pull·의존 서비스 기동·백업·중지·apply·서버 기동을
수행하지 않습니다. 기존 로컬 server 이미지로 `--no-deps` check/plan 컨테이너만
실행하므로 PostgreSQL이 실행 중이고 이미지와 설정이 준비돼 있어야 합니다.
빌드하지 않은 소스의 migration은 확인할 수 없습니다. 잠금과 임시 결과 파일을
사용하며 Compose가 없는 network/volume을 생성할 수 있습니다. 읽기 전용 조회도
일회성 컨테이너 실행은 필요합니다. destructive 또는 상태 불일치가 있으면
0이 아닌 종료 코드로 끝납니다.

백업 실패 시 `.partial`은 조사용으로 남고 apply하지 않습니다. apply 또는 적용 후
check 실패 시 자동 재기동·재시도·down·복원은 하지 않습니다. 런북 §10~11을
따라 원인을 확인하십시오. 호스트의 HTTP health와 Server·Bot 컨테이너 health를
약 180초간 확인합니다. 실패해도 마지막 응답 본문, Compose 상태와 릴리스 요약을
출력한 후 실패 코드로 종료합니다.
요약에는 Git SHA, server image ID, 빌드/apply 시각, 실행자, 백업 경로·체크섬,
적용 전후 pending ID와 이번 적용 ID, check·health 결과가 포함됩니다.
백업은 런북 순서대로 writer 중지 전에 생성하므로 복원하면 백업 이후 쓰기가
유실될 수 있습니다. 격리 restore rehearsal은 자동 수행하지 않으며 운영자가
가능한 경우 별도로 수행합니다. Compose 설정 추출 실패 시 실제 이미지와 DB
대상을 보장할 수 없으므로 즉시 중단합니다. 백업 전 DB 크기의 2배 + 1GiB
여유 공간을 요구하며 크기·용량 조회 실패도 중단합니다. 이는 사전 추정치이므로
백업 중 동시 디스크 사용까지 보장하지는 않습니다. 기존 TOC·checksum 검증 후
`pg_restore -f /dev/null`로 데이터 블록 전체를 읽어 검증합니다.
기존 적용 이력 전체 ID는 CLI가 제공하지 않으므로 요약에 포함하지 않습니다.
런북 §9.3~§9.4의 로그와 실제 기능 smoke test는 운영자가 추가 확인합니다.
출력을 보관하려면 백업 디렉터리 대신 접근 권한을 제한한 별도
`/var/log/yoro/deploy/`의 로그에 append합니다.

로컬에서는 실제 Docker/DB 실행 없이 다음으로 분기와 실패 중단을 검증합니다.

```bash
bash -n deploy.sh
shellcheck deploy.sh
python3 test-deploy.py
python3 test-deploy.py --mutations  # 임시 사본에서 안전장치 제거 6종 탐지 확인
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
/etc/yoro/secrets/chzzk_client_secret
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
./deploy.sh
docker compose --profile edge up -d --no-build cloudflared
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

치지직 로그인을 활성화하려면 `config/runtime.example.json`의 `chzzk` 항목처럼
발급받은 공개 `clientId`와 `redirectUri`를 운영 runtime에 설정하고,
`/etc/yoro/secrets/chzzk_client_secret`에 비밀값을 별도로 준비합니다.
콜백 주소는 `https://yoro.gg/api/account/oauth/chzzk/callback`입니다.
기본 Compose의 `config-check`와 `server`, 루트 `docker-compose.production.yml`의
`server`는 이 파일을 `/run/secrets/chzzk_client_secret`에 읽기 전용으로 연결합니다.
치지직 설정이 있는데 필수 secret이 없으면 기존 안전 정책대로 시작이 실패합니다.
예시 파일에는 실제 비밀값을 넣지 않습니다.

이 secret 마운트는 조건부가 아니므로, 치지직 비활성 상태라도 기본 Compose를
그대로 사용하려면 다음 배포 **전에 일반 파일을 먼저 준비**해야 합니다. 파일 없이
실행하면 Docker가 같은 경로에 디렉터리를 만들 수 있습니다. 치지직을 사용하지 않아
secret을 준비하지 않는 운영 구성에서는 `chzzk` runtime 항목을 생략하고 해당
마운트도 `config-check`와 `server` 양쪽에서 제외합니다(루트 운영 override는
`server`에서 제외). 이미 디렉터리가 생겼다면 관련 컨테이너를 중지하고 해당
경로가 빈 디렉터리인지 확인한 뒤 `rmdir /etc/yoro/secrets/chzzk_client_secret`으로
제거합니다. 이후 정상 secret 파일과 기존 secret과 동일한 소유권·권한을 준비한
뒤 다시 기동합니다. 비어 있지 않다면 내용을 확인하기 전에는 삭제하지 않습니다.

Riot RSO는 별도 승인을 받은 뒤에만 `features.riotRso=true`로 활성화합니다.
승인 전에는 `false`를 유지하며 기본 Compose는 RSO secret을 mount하지 않습니다.
승인 후 `deploy/production/riot-rso.override.example.yaml`을 운영 전용 경로에
복사해 secret mount를 추가합니다. 활성화 절차와 Developer Portal 등록 URL은
`docs/RIOT_RSO.md`를 따릅니다.

Twitch Extension도 기본 배포에서는 비활성입니다. 활성화할 때만
`/etc/yoro/secrets/twitch_extension_secret`을 준비하고
`twitch-extension.override.example.yaml`을 운영 전용 경로에 복사해 함께 적용합니다.
이 override는 `config-check`와 `server`에 같은 파일을 읽기 전용으로 전달합니다.

```bash
cp twitch-extension.override.example.yaml twitch-extension.override.yaml
COMPOSE_FILE=compose.yaml:twitch-extension.override.yaml ./deploy.sh
```

발로란트 공개 카탈로그는 `features.valorantPublic=true`로 승인 전에 배포할 수
있습니다. `riot.valorantProductionApproved=false`인 동안 리더보드·스트리머
전적은 외부 Riot API를 호출하지 않고 `approval_pending`만 반환합니다. 승인 후
공식 current act UUID와 `riot_api_key`를 갖춘 상태에서만 approval flag를 켭니다.
동의 migration `0021`과 운영 순서는 `docs/VALORANT_PUBLIC_API.md`를 따릅니다.

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

Server 자체는 PostgreSQL migration을 자동 적용하지 않습니다. pending이 있으면
fail-closed 상태가 되므로 위 `deploy.sh`에서 plan 승인과 백업 검증을 거쳐
적용하거나, 런북의 수동 절차를 따릅니다.

## 중지

```bash
docker compose down
```

Database와 runtime state를 유지해야 하므로 `down -v`와
`docker system prune`은 사용하지 않습니다.
