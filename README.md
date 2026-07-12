# StreamOps Twitch Bot

Twitch 방송 자동화용 모듈형 프로젝트입니다. 핵심 목표는 **방송 PC 부하를 낮게 유지하면서** Twitch 이벤트, OBS 제어, 방송 오버레이, 관리자 대시보드, 롤 시참 신청, 한일 번역, Codex 자동화를 단계적으로 붙일 수 있는 구조를 만드는 것입니다.

제품, 아키텍처, Sprint, 운영 문서는 [docs/README.md](docs/README.md)에서 확인할 수 있습니다.

## 전체 구조

```text
Twitch EventSub
  → apps/server        # Linux 서버에서 실행
  → action router
  → apps/bridge        # 방송 PC에서 실행, OBS WebSocket만 제어
  → OBS Studio

apps/dashboard         # 방송자 관리자 대시보드
apps/overlay           # OBS Browser Source용 오버레이
packages/shared        # 공통 타입과 validation
```

## 포함된 기능

- Twitch EventSub WebSocket 수신 골격
- Twitch 채팅 명령어 처리
- 채널 포인트 리워드 처리
- 안전한 action allowlist
- 방송 PC local bridge
- OBS WebSocket 명령 실행
- 대시보드 UI
- OBS 오버레이 UI
- 롤 시참 신청 대기열 모듈
- 질문 큐 / 하이라이트 로그
- 한일 번역 모듈 골격
- Codex 방송 후 리포트 / 이벤트 제안 골격
- config validation script
- Codex용 프롬프트와 AGENTS.md

## 빠른 시작

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/bridge/.env.example apps/bridge/.env
npm run build
npm run dev:server
npm run dev:bridge
npm run dev:dashboard
npm run dev:overlay
```

## Docker/Linux 배포

서버 운영 배포는 Docker Compose 단일 서버 컨테이너를 기준으로 합니다. 이 컨테이너가 API, WebSocket, Dashboard 정적 파일, Overlay 정적 파일을 함께 제공합니다.

```bash
cp .env.example .env
docker compose config
docker compose build
docker compose up -d
```

로컬에서 이미 `3000` 포트를 쓰고 있다면 `.env`의 `HOST_PORT`를 `3001` 같은 빈 포트로 바꾸고 `PUBLIC_BASE_URL` 계열 URL도 같은 포트로 맞추세요.

운영 URL 기본 구조:

```text
https://bot.example.com/dashboard/
https://bot.example.com/overlay/?mode=participation
https://bot.example.com/api/twitch/status
```

자세한 서버 준비, reverse proxy, OBS URL, 영구 볼륨 설명은 [docs/DEPLOYMENT_DOCKER.md](docs/DEPLOYMENT_DOCKER.md)를 확인하세요. 실제 key를 예시 파일이나 커밋에 넣었다면 [docs/SECRETS_ROTATION.md](docs/SECRETS_ROTATION.md)의 절차대로 즉시 교체하세요.

## OBS 연결

OBS Studio에서 WebSocket을 켜고 비밀번호를 설정하세요.

- 기본 주소: `ws://127.0.0.1:4455`
- 비밀번호: `apps/bridge/.env`의 `OBS_WEBSOCKET_PASSWORD`와 동일하게 설정

OBS Browser Source에는 overlay 개발 서버 URL을 넣습니다.

```text
http://localhost:5174
```

Docker 배포 시에는 server가 `/dashboard/`와 `/overlay/` 정적 파일을 함께 서빙합니다.

## 안전 원칙

시청자 입력은 절대 다음 동작으로 이어지면 안 됩니다.

- shell command 실행
- 임의 파일 쓰기/삭제
- 임의 URL 열기
- OBS stream key 변경
- 원격 방송 시작/종료
- 승인 없는 모더레이션 처벌

허용된 action만 `packages/shared/src/actions.ts`에서 정의합니다.

## 현재 상태

이 프로젝트는 바로 확장 가능한 MVP 스캐폴드입니다. 실제 운영 전에 다음을 확인하세요.

```bash
npm run build
npm run validate:config
```

그리고 Twitch token, broadcaster ID, OBS scene/source 이름, Riot API key는 본인 환경에 맞게 설정해야 합니다.
