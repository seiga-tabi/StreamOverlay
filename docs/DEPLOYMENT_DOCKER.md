# Docker/Linux 배포 가이드

이 문서는 StreamOps Twitch Bot을 Linux 서버에서 Docker Compose로 실행하기 위한 운영 절차입니다.

## 배포 전략

운영 컨테이너는 `apps/server`를 실행하고, 같은 서버가 빌드된 정적 파일을 함께 제공합니다.

- Dashboard: `/` 또는 `/dashboard/`
- Overlay: `/overlay/?mode=events`
- API: `/api/*`
- Dashboard WebSocket: `/ws/dashboard`
- Overlay WebSocket: `/ws/overlay`
- Bridge WebSocket: `/bridge`
- 로컬 일본어 TTS: `tts-engine` + `voicevox`

`apps/dashboard`와 `apps/overlay`는 Docker build 단계에서 정적 파일로 빌드되며, 런타임에는 별도 Vite dev server가 필요하지 않습니다.

## Linux 서버 요구사항

- Docker Engine
- Docker Compose plugin
- 1GB 이상 RAM 권장
- 외부 공개 시 HTTPS reverse proxy 권장
- Twitch OAuth를 사용할 경우 Twitch Developer Console에 등록할 공개 callback URL

## 환경변수 준비

루트 `.env.example`을 기준으로 서버의 `.env`를 만듭니다.

```bash
cp .env.example .env
```

운영에서 반드시 바꿔야 하는 값입니다.

```text
HOST_PORT=3000
PORT=3000
PUBLIC_BASE_URL=https://bot.example.com
DASHBOARD_BASE_URL=https://bot.example.com
OVERLAY_BASE_URL=https://bot.example.com/overlay
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
TWITCH_REDIRECT_URI=https://bot.example.com/api/twitch/auth/callback
BRIDGE_SHARED_SECRET=...
DASHBOARD_AUTH_TOKEN=...
OVERLAY_ACCESS_TOKEN=...
CORS_ORIGINS=https://bot.example.com
TRUST_PROXY=true
LOCAL_TTS_ENABLED=true
LOCAL_TTS_PROVIDER=seoya
LOCAL_TTS_BASE_URL=http://tts-engine:8787
LOCAL_TTS_SPEAKER=3
```

운영 모드(`NODE_ENV=production`)에서는 다음 조건을 만족하지 않으면 서버가 시작되지 않습니다.

- `DASHBOARD_AUTH_TOKEN`, `OVERLAY_ACCESS_TOKEN`, `BRIDGE_SHARED_SECRET`은 모두 설정되어야 합니다.
- 세 secret은 32자 이상의 예측 불가능한 값이어야 하며 서로 같은 값을 재사용할 수 없습니다.
- `PUBLIC_BASE_URL`과 `TWITCH_REDIRECT_URI`는 `https://` URL이어야 합니다.
- `CORS_ORIGINS`에는 `https://bot.example.com`처럼 정확한 origin만 넣어야 하며 `*`는 사용할 수 없습니다.
- `ALLOW_INSECURE_DEV=true`, `ALLOW_LEGACY_WS_QUERY_AUTH=true`는 production에서 사용할 수 없습니다.

랜덤 secret 예시:

```bash
openssl rand -base64 48
```

파일 기반 secret을 쓰려면 직접 값 대신 `_FILE` 변수를 사용합니다.

```text
DASHBOARD_AUTH_TOKEN_FILE=/run/secrets/dashboard_auth_token
OVERLAY_ACCESS_TOKEN_FILE=/run/secrets/overlay_access_token
BRIDGE_SHARED_SECRET_FILE=/run/secrets/bridge_shared_secret
```

`docker-compose.yml`은 `./secrets`를 `/run/secrets:ro`로 mount합니다. `secrets/` 디렉터리는 Git에 올리지 마세요.

`HOST_PORT`는 Linux host에서 공개할 포트이고, `PORT`는 컨테이너 내부 server listen 포트입니다. 로컬에서 이미 `3000`을 쓰고 있다면 `HOST_PORT=3001`처럼 바꿀 수 있습니다. 이 경우 `PUBLIC_BASE_URL`, `DASHBOARD_BASE_URL`, `OVERLAY_BASE_URL`, `TWITCH_REDIRECT_URI`, `CORS_ORIGINS`도 같은 공개 포트로 맞추세요.

`DASHBOARD_AUTH_TOKEN`은 Dashboard 로그인에만 입력합니다. 로그인 성공 후 서버가 `HttpOnly`, `SameSite=Strict` session cookie와 CSRF token을 발급하므로 브라우저 `localStorage`에 dashboard token을 저장하지 않습니다.

`OVERLAY_ACCESS_TOKEN`을 설정하면 OBS Browser Source URL에는 query string이 아니라 fragment를 사용합니다. fragment는 HTTP 요청 로그와 reverse proxy access log로 전달되지 않습니다.

```text
https://bot.example.com/overlay/?mode=participation#token=OVERLAY_ACCESS_TOKEN_VALUE
```

overlay는 WebSocket이 순간적으로 끊겼다가 복구되면 Browser Source를 다시 로드합니다. 시참 overlay는 마지막 대기열 상태를 브라우저 저장소에 복구용으로 저장하므로 새로고침 직후에도 이전 대기열을 먼저 표시하고, WebSocket 연결 후 최신 상태로 덮어씁니다. 강제 새로고침을 끄려면 query string에 `autoReload=0` 또는 `reload=0`을 추가하세요.

Riot API는 Personal API Key 기준 보호값으로 실행됩니다. 기본값은 `RIOT_RATE_LIMIT_PER_SECOND=20`, `RIOT_RATE_LIMIT_PER_TWO_MINUTES=100`이며, 서버는 이 한도를 넘는 요청을 host별 queue에서 지연 처리합니다. Production API Key를 승인받은 경우에만 이 값을 올리세요.

`BRIDGE_SHARED_SECRET`은 local bridge가 `/bridge` WebSocket에 연결할 때 `Authorization: Bearer ...` header로 전송됩니다. URL query string에 secret을 넣지 마세요.

## 모바일 m 도메인 운영

PC와 모바일 화면은 별도 앱이 아니라 같은 Dashboard 정적 앱에서 CSS 미디어쿼리로 분기합니다. `m.example.com`을 운영할 경우 모바일 도메인도 같은 `server` 컨테이너로 reverse proxy 하면 됩니다.

운영 예시:

```text
PUBLIC_BASE_URL=https://seiga.example.com
DASHBOARD_BASE_URL=https://seiga.example.com
OVERLAY_BASE_URL=https://seiga.example.com/overlay
TWITCH_REDIRECT_URI=https://seiga.example.com/api/twitch/auth/callback
TWITCH_PUBLIC_REDIRECT_URI=https://seiga.example.com/api/public/twitch/auth/callback
CORS_ORIGINS=https://seiga.example.com,https://m.seiga.example.com
TRUST_PROXY=true
```

`m.example.com`에서 `/dashboard/config.js`를 요청하면 서버는 현재 요청 origin을 확인해 `apiBase`와 `wsBase`를 `https://m.example.com`, `wss://m.example.com` 기준으로 내려줍니다. 단, 해당 origin은 `CORS_ORIGINS` 또는 공개 URL 설정에 포함되어 있어야 합니다. 허용되지 않은 Host는 `PUBLIC_BASE_URL`로 되돌립니다.

공개 전적 화면의 Twitch 로그인은 접속 중인 도메인의 callback URL을 사용합니다. 따라서 Twitch Developer Console에는 다음 두 callback을 모두 등록해야 합니다.

```text
https://seiga.example.com/api/public/twitch/auth/callback
https://m.seiga.example.com/api/public/twitch/auth/callback
```

관리자 Twitch 연결용 callback은 기존처럼 `TWITCH_REDIRECT_URI` 하나만 사용합니다.

Cloudflare Tunnel을 쓰는 경우 Public Hostname을 2개 등록하고 둘 다 같은 서비스로 보냅니다.

```text
seiga.example.com   -> http://server:3000
m.seiga.example.com -> http://server:3000
```

Nginx에서 모바일 사용자만 `m.`으로 보내고 싶다면 API, WebSocket, Overlay, Dashboard 관리 경로는 리다이렉트 대상에서 제외하세요. 전적 공개 화면만 이동시키는 예시입니다.

```nginx
map $http_user_agent $is_mobile_client {
  default 0;
  ~*(android|iphone|ipod|mobile) 1;
}

server {
  listen 443 ssl http2;
  server_name seiga.example.com;

  location ~ ^/(api|ws|bridge|overlay|dashboard|admin)(/|$) {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  location / {
    if ($is_mobile_client) {
      return 302 https://m.seiga.example.com$request_uri;
    }
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}

server {
  listen 443 ssl http2;
  server_name m.seiga.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## 빌드와 실행

host bind volume을 non-root 컨테이너에서 쓸 수 있도록 권한을 준비합니다.

```bash
mkdir -p logs reports secrets
sudo chown -R 10001:10001 logs reports
chmod 700 secrets
```

```bash
docker compose config
docker compose build
docker compose up -d
docker compose logs -f server
```

기본 Compose 실행은 `server`, `tts-engine`, `voicevox`를 함께 실행합니다. `voicevox` 이미지는 1GB 이상이라 첫 실행이 오래 걸릴 수 있습니다.

로컬 Docker 기본 실행도 Dashboard 로그인을 요구합니다. `.env`의 `DASHBOARD_AUTH_TOKEN`에 긴 랜덤 값을 설정하고, 접속 시 같은 값을 로그인 화면에 입력합니다. `STREAMOPS_LOCAL_NO_AUTH=true`는 임시 개발 디버깅 용도로만 사용하고 서버 공개 환경에서는 사용하지 않습니다.

운영 배포에서는 production override도 함께 적용합니다.

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml config
docker compose -f docker-compose.yml -f docker-compose.production.yml build
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

운영에서 TTS를 사용하지 않는 경우에는 `.env`에 `LOCAL_TTS_ENABLED=false`를 설정하고, 필요하면 `docker compose up -d server`처럼 서버만 지정해 실행합니다.

상태 확인:

```bash
curl http://127.0.0.1:3000/health/ready
```

`HOST_PORT`를 바꿨다면 해당 포트로 확인합니다.

```bash
curl http://127.0.0.1:3001/health/ready
```

로컬 일본어 TTS 확인:

```bash
curl http://127.0.0.1:8787/health
```

TTS host 포트는 기본적으로 `127.0.0.1:8787`에만 바인딩됩니다. 외부 reverse proxy에 노출하지 말고, StreamOps 서버 내부 통신은 `http://tts-engine:8787`을 사용하세요.

## 영구 데이터와 볼륨

Compose 설정은 다음 데이터를 컨테이너 재생성 후에도 유지합니다.

- `./logs:/app/logs`
- `./reports:/app/reports`
- `streamops_state:/app/.streamops`
- `streamops_tts_output:/app/output`
- `./apps/server/config:/app/apps/server/config:ro`

`/app/.streamops`에는 Twitch token store와 Riot profile cache 같은 운영 상태가 들어갑니다. 이 볼륨은 Git에 올리지 말고 서버 백업 정책에만 포함하세요.

`/app/.streamops/tts-cache`에는 StreamOps 서버가 overlay용으로 캐시한 TTS WAV가 들어갑니다. `streamops_tts_output`은 Seoya TTS 엔진의 독립 `/alert_file` 출력용입니다.

## OBS URL

단일 서버 배포 시 OBS Browser Source에는 다음 URL을 사용합니다.

```text
https://bot.example.com/overlay/?mode=events
https://bot.example.com/overlay/?mode=subtitles
https://bot.example.com/overlay/?mode=questions
https://bot.example.com/overlay/?mode=mission
https://bot.example.com/overlay/?mode=participation
https://bot.example.com/overlay/?mode=all
```

`OVERLAY_ACCESS_TOKEN`을 켠 경우에는 모든 URL 뒤에 `#token=...`을 추가합니다.

```text
https://bot.example.com/overlay/?mode=events#token=OVERLAY_ACCESS_TOKEN_VALUE
```

## Reverse proxy 예시

Cloudflare 502에서 Browser와 Cloudflare가 `Working`이고 Host만 `Error`라면, StreamOps 서버가 죽은 것보다 Cloudflare가 origin에 도달하지 못하는 경우가 많습니다. `https://bot.example.com`은 기본적으로 origin의 443 포트나 Cloudflare Tunnel로 들어오므로, Docker의 `HOST_PORT=3000`만 열어두면 공개 도메인에서 바로 접속되지 않습니다.

다음 중 하나를 반드시 준비해야 합니다.

- Caddy/Nginx 같은 reverse proxy가 host 443에서 TLS를 받고 `127.0.0.1:3000`으로 proxy합니다.
- Cloudflare Tunnel이 `http://server:3000` 또는 `http://127.0.0.1:3000`으로 proxy합니다.

확인 명령:

```bash
curl http://127.0.0.1:3000/health/ready
nc -vz 127.0.0.1 80
nc -vz 127.0.0.1 443
docker compose ps
```

`curl http://127.0.0.1:3000/health/ready`는 성공하지만 공개 URL만 502라면 reverse proxy 또는 Tunnel 설정 문제입니다.

### Cloudflare Tunnel

Cloudflare Zero Trust에서 tunnel을 만들고 public hostname을 `bot.example.com`으로 연결합니다. Service URL은 compose profile을 사용할 때 같은 Docker network의 서버 이름을 사용할 수 있습니다.

```text
http://server:3000
```

`.env`에 tunnel token을 넣습니다.

```text
CLOUDFLARE_TUNNEL_TOKEN=...
PUBLIC_BASE_URL=https://bot.example.com
DASHBOARD_BASE_URL=https://bot.example.com
OVERLAY_BASE_URL=https://bot.example.com/overlay
TWITCH_REDIRECT_URI=https://bot.example.com/api/twitch/auth/callback
CORS_ORIGINS=https://bot.example.com
TRUST_PROXY=true
```

실행:

```bash
docker compose --profile tunnel up -d
docker compose logs -f cloudflared
```

Cloudflare Tunnel을 쓰면 host의 80/443 포트를 직접 열 필요가 없습니다.

### Caddy

```caddyfile
bot.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Caddy는 기본적으로 WebSocket upgrade를 처리합니다.

### Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name bot.example.com;

  add_header Strict-Transport-Security "max-age=15552000; includeSubDomains" always;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## 운영 체크리스트

- `.env.example`에는 placeholder만 유지합니다.
- 실제 `.env`는 Git에 올리지 않습니다.
- Twitch Developer Console의 Redirect URL이 `TWITCH_REDIRECT_URI`와 정확히 일치해야 합니다.
- `PUBLIC_BASE_URL`, `DASHBOARD_BASE_URL`, `OVERLAY_BASE_URL`은 reverse proxy의 공개 HTTPS 주소로 설정합니다.
- `CORS_ORIGINS`에는 Dashboard를 여는 실제 origin만 넣습니다.
- Dashboard는 `DASHBOARD_AUTH_TOKEN`으로 보호합니다. 추가로 reverse proxy basic auth를 붙여도 됩니다.
- Overlay URL은 fragment token을 포함해 필요한 scene에만 등록하고, 공개 링크 공유를 피합니다.
- Bridge secret, Dashboard token, Overlay token은 URL query string이나 로그에 남기지 않습니다.
- 서버에서 token, client secret, Riot API key가 로그에 출력되지 않는지 확인합니다.
- TTS 엔진 `8787` 포트와 VOICEVOX `50021` 포트는 외부에 공개하지 않습니다.
- 운영 배포 전 `npm run build`, `npm run validate:config`, `npm test`, `docker compose config`를 실행합니다.
