# Docker 운영 배포

## 원칙

- 배포 단위는 Git commit SHA로 고정된 Docker image입니다.
- `latest`만으로 배포하지 않으며 registry digest를 릴리즈 기록에 남깁니다.
- 실제 환경변수와 secret은 저장소가 아닌 운영 secret 저장소에서 주입합니다.
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

## 배포 전 검증

먼저 운영자가 `.env`에 실제 법적 운영정보와 외부 서비스 자격 증명을 입력합니다. 이후 아래 도구로 HTTPS URL, callback, CORS와 내부 secret을 안전하게 보정합니다. 기본 실행은 dry-run이며 secret 값은 출력하지 않습니다. 전체 production 검증이 실패하면 `--write`를 지정해도 원본 파일은 변경되지 않습니다.

```bash
chmod 600 .env
npm run configure:production -- --domain yoro.gg
npm run configure:production -- --domain yoro.gg --write
npm run validate:runtime
```

`LEGAL_*`, Riot production key, Twitch client secret처럼 운영자가 확정해야 하는 값은 이 도구가 만들지 않습니다.

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

운영 secret을 주입한 별도 shell에서 `NODE_ENV=production npm run validate:runtime`을 실행합니다. 출력에는 변수명과 실패 원인만 남아야 하며 값은 기록하지 않습니다.

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
