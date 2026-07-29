# Docker 운영 배포

## 운영 호스트에서 source build와 기동을 한 번에 수행

Git checkout에서 `/etc/yoro/runtime.json`과 `/etc/yoro/secrets/*` 준비를
마친 경우 다음 명령을 사용합니다.

```bash
cd deploy/production
docker compose up -d --build
```

이 경로의 Compose는 `.env`를 사용하지 않고 실제 Git commit SHA와 build
시각을 image의 `/app/release.json`에 자동 기록합니다. PostgreSQL migration은
자동 적용하지 않습니다.

## 원칙

- 배포 단위는 Git commit SHA로 고정된 Docker image입니다.
- `latest`만으로 배포하지 않으며 registry digest를 릴리즈 기록에 남깁니다.
- 일반 설정은 `/etc/yoro/runtime.json`, 법적 설정은 `/etc/yoro/legal.json`,
  secret은 `/etc/yoro/secrets`에서 서비스별 `/run/secrets/*`로 주입합니다.
- production `.env`는 사용하지 않습니다.
- 애플리케이션 포트는 기본적으로 `127.0.0.1`에만 바인딩하고 Nginx 또는 승인된 reverse proxy를 통해 공개합니다.

## 이미지 생성

아래 명령은 예시이며 릴리즈 승인 뒤 운영자가 실행합니다.

```bash
GIT_SHA="$(git rev-parse HEAD)"
APP_VERSION="0.1.0"
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
IMAGE_REPOSITORY="registry.example.invalid/yoro-server"

docker build \
  --build-arg APP_VERSION="$APP_VERSION" \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_TIME="$BUILD_TIME" \
  -f apps/server/Dockerfile \
  -t "${IMAGE_REPOSITORY}:${GIT_SHA}" .
```

push 후 `docker image inspect` 또는 registry 화면에서 immutable digest를 확인하고 릴리즈 기록에 `Git SHA`, image tag, digest를 함께 적습니다.

production runtime validation은 `APP_VERSION`, 실제 `GIT_SHA`, ISO-8601 `BUILD_TIME`이 누락되거나 `unknown`이면 기동을 거부합니다. build args 없이 생성한 image를 운영에 사용하지 않습니다.

## 배포 전 설정

저장소의 `config/runtime.example.json`, `config/legal.example.json`을 참고해
운영 호스트에 파일을 준비합니다. 실제 운영 파일은 Git에 커밋하지 않습니다.

```text
/etc/yoro/runtime.json
/etc/yoro/legal.json
/etc/yoro/secrets/*
```

`runtime.json`과 `legal.json`은 임시 파일 작성 후 atomic rename으로
교체합니다. secret directory는 `0700`, 각 secret file은 `0600`으로
제한하고 symlink를 사용하지 않습니다.

```bash
npm run config:check
npm run secrets:check
npm run config:explain
npm run validate:runtime
```

이 명령은 secret 값, 길이, prefix, fingerprint 또는 Database hostname을
출력하지 않습니다. 기능을 끈 경우 해당 기능의 secret은 읽거나 요구하지
않습니다.

### Twitch OAuth token 암호화 migration

production에서 Twitch 설정을 사용하는 경우
`/run/secrets/twitch_token_encryption_key`에 다른 secret과 재사용하지 않은
32바이트 key가 필요합니다. key 값은 로그나 릴리즈 기록에 남기지 않습니다.

서버 시작은 평문 token을 자동 변환하지 않습니다. 평문 저장소가 발견되면 OAuth 기능은 fail-closed로 중단되며, 운영자가 방송이 없는 유지보수 시간에 다음 관리 명령을 명시적으로 실행해야 합니다.

```bash
npm --workspace apps/server run migrate:twitch-token-encryption -- \
  --token-store /state/twitch-token.json \
  --follower-token-store /state/streamer-follower-oauth-tokens.json \
  --state-directory /state \
  --backup-directory /encrypted-backup/streamops \
  --key-file /run/secrets/twitch_token_encryption_key \
  --operator-approved \
  --backup-storage-encrypted
```

- snapshot은 application state directory 밖의 storage-level encryption이 적용된 경로에 만들고 directory `0700`, file `0600`을 확인합니다.
- 배포 직전이면서 OAuth token write가 중지된 시점의 snapshot ID와 시각을 기록합니다.
- staging에서 migration, 첫 재시작, 두 번째 재시작과 token metadata 일치를 확인합니다.
- rollback image digest와 배포 전 state snapshot을 한 쌍으로 기록합니다.
- 새 key를 분실하거나 변경하면 기존 암호문을 읽을 수 없음을 운영자에게 알립니다.
- migration 이후 암호화 저장소를 이해하지 못하는 이전 image로 되돌릴 때는 컨테이너만 교체하지 말고, 승인된 배포 전 snapshot을 함께 복원합니다.
- 방송 중이거나 EventSub·Followers 갱신이 활발한 시간에는 migration을 실행하지 않습니다.
- backup 확인, key 확인, staging 검증, 운영자 승인, rollback image 확인 중 하나라도 빠지면 명령을 실행하지 않습니다.

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
npm run check:budgets
npm run validate:config
npm audit --audit-level=high
docker compose config --quiet
```

운영 runtime·secret file을 동일한 read-only 경로로 제공한 검증
컨테이너에서 `npm run validate:runtime`을 실행합니다. 출력에는 설정
항목명과 안전한 실패 원인만 남아야 하며 값은 기록하지 않습니다.

## Reverse proxy 기준

- HTTP 요청은 HTTPS로 `301` 또는 `308` redirect합니다.
- HTTPS 응답에 `Strict-Transport-Security`를 적용합니다. preload는 모든 하위 도메인의 HTTPS 준비가 끝난 뒤 별도 승인합니다.
- `/dashboard/config.js`와 `/overlay/config.js`는 `Cache-Control: no-store`여야 합니다.
- upstream은 `127.0.0.1:${HOST_PORT}`를 사용하고 서버 방화벽에서 애플리케이션 포트를 외부에 공개하지 않습니다.

```bash
curl -I http://yoro.gg
curl -I https://yoro.gg
curl -I https://yoro.gg/dashboard/config.js
docker compose config
```

## 배포 확인

```bash
docker compose up -d --no-build
docker compose ps
docker compose logs --tail=200 server
curl -fsS https://yoro.gg/health/live
curl -fsS https://yoro.gg/health/ready
```

`ready`가 실패하면 트래픽을 전환하지 말고 [롤백 절차](ROLLBACK.md)를 수행합니다. volume 삭제나 production migration은 자동 롤백 절차에 포함하지 않습니다.
