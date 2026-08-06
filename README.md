# YORO.gg 방송 자동화 서버

Twitch 이벤트, 관리자 Dashboard, LoL 시청자 참여, Palworld 정보, Discord 연동과 Codex 자동화를 제공하는 모듈형 TypeScript 프로젝트입니다.

제품, 아키텍처와 운영 문서는 [docs/README.md](docs/README.md)에서 확인할 수 있습니다.

## 전체 구조

```text
Twitch EventSub → apps/server
HTTP API       → apps/dashboard
Discord        → apps/discord-bot
Email          → apps/email-worker
공통 schema    → packages/shared
```

서버가 제공하던 WebSocket Hub, OBS Studio 제어 Bridge와 OBS Browser Source Overlay는 제거되었습니다. Dashboard 상태 갱신은 인증된 HTTP API polling을 사용합니다. Twitch EventSub 수신에 필요한 외부 WebSocket 연결은 Twitch 연동의 일부로 유지됩니다.

## 주요 기능

- Twitch OAuth, EventSub와 채팅 처리
- 채널 포인트 리워드 처리
- LoL 시청자 참여 대기열과 Riot profile 조회
- Dashboard와 공개 LoL·Palworld 화면
- Discord bot과 관리 API
- 질문 queue, 하이라이트 log
- allowlist 기반 action validation
- runtime/config 검증과 운영 점검 script

## 빠른 시작

```bash
npm install
npm run build
YORO_CONFIG_FILE=./config/runtime.development.json npm run dev:server
npm run dev:dashboard
```

일반 설정은 `config/runtime.development.json`을 사용합니다. 실제 secret은 저장소에 기록하지 않고 권한이 제한된 `/run/secrets/*` 파일로 제공합니다.

## Docker/Linux 배포

운영 배포는 API와 Dashboard 정적 파일을 제공하는 단일 server container를 기준으로 합니다. production은 `docker-compose.production.yml`을 함께 사용해 `/etc/yoro/runtime.json`과 서비스별 `/run/secrets/*`만 주입합니다.

기본 URL은 다음과 같습니다.

```text
https://bot.example.com/dashboard/
https://bot.example.com/api/twitch/status
```

자세한 내용은 [Docker 배포](docs/DEPLOYMENT_DOCKER.md), [릴리즈 체크리스트](docs/RELEASE_CHECKLIST.md), [롤백 절차](docs/ROLLBACK.md)를 확인하세요.

## 안전 원칙

시청자 입력은 shell command 실행, 임의 file 변경, 임의 URL 열기, 원격 방송 제어 또는 승인 없는 moderation 처벌로 이어질 수 없습니다. 허용된 action은 `packages/shared/src/actions.ts`에서 검증합니다.

## 검증

```bash
npm run lint
npm run typecheck
npm run build
npm run validate:config
npm test
```
