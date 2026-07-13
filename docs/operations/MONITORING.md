# Production Monitoring Baseline

외부 monitoring 계정과 수신 채널은 운영자가 선택한다. 계정이 준비되지 않은 상태는 최소 관측성만 확보된 것이며 완전한 GO 조건이 아니다.

## Health Probes

- `/health/live`: 프로세스 생존 및 build version/SHA 확인
- `/health/ready`: 상태 저장 경로 쓰기 가능 여부, 최근 persistence 실패, 종료 진행 여부 확인
- 권장 주기: 30초
- readiness 2회 연속 실패 또는 5분 내 restart 2회 이상이면 경보

`scripts/verify-production-edge.mjs`는 아래 항목을 한 번에 검사한다.

- HTTP에서 HTTPS로 redirect
- HTTPS와 HSTS
- liveness/readiness 및 build Git SHA
- runtime config `no-store`와 legal configured 상태
- privacy/terms/favicon/robots/sitemap
- 선택적으로 backup 최신성, disk 사용률, instance 재시작 감지

```bash
node scripts/verify-production-edge.mjs \
  --base-url=https://gg.seigatabi.com \
  --report=qa/production-edge-report.json
```

`.github/workflows/edge-monitor.yml`은 15분마다 같은 검사를 실행한다. 이 workflow가 GitHub에서 실행되려면 `.github` 파일이 commit/push되어야 하며 repository variable `PRODUCTION_BASE_URL`을 설정해야 한다.

실제 수신 채널 연결 후 URL과 32자 이상의 서명 secret을 secret store에서 주입한다. 알림 본문에는 secret이 포함되지 않으며, 수신기는 `X-Yoro-Alert-Timestamp`와 `X-Yoro-Alert-Signature`(`v1=<HMAC-SHA256>`)를 검증한다. 다음 명령은 정상/실패 테스트 알림을 각각 보내고 수신 endpoint의 HTTP 2xx 응답을 확인한다.

```bash
OPS_ALERT_WEBHOOK_URL='<secret store에서 주입>' \
OPS_ALERT_WEBHOOK_SECRET='<secret store에서 주입>' \
npm run ops:test-alert
```

실제 채널 화면에서 두 알림이 모두 도착했는지 확인하고 시간·수신 채널·담당자를 변경 관리 기록에 남긴다. HTTP 2xx는 receiver가 요청을 수락했다는 의미이며, 사람의 채널 확인을 대체하지 않는다.

## Required Alerts

- HTTP 5xx 비율 5분 평균 2% 초과
- p95 API latency 2초 초과
- `/health/ready` 60초 이상 실패
- container restart 발생
- memory 사용률 85% 초과
- disk 사용률 80% 경고, 90% critical
- backup 24시간 이상 미생성 또는 manifest 검증 실패
- `store.persistence_failed`, `server.shutdown_timeout`, OAuth refresh 실패
- Riot/Twitch 429 증가, 외부 API timeout 증가
- EventSub disconnected 또는 OBS bridge disconnected 지속

## 실제 Alert 연동

`deploy/systemd/yoro-edge-monitor.timer`는 5분마다 edge, backup, disk 검사를 수행한다. `OPS_RESTART_ALERT_ENABLED=true`이면 `/health/live`의 `startedAt`을 이전 점검과 비교해 instance 재시작도 감지한다. `OPS_ALERT_WEBHOOK_URL`과 `OPS_ALERT_WEBHOOK_SECRET`을 설정하면 실패 발생, 복구, 반복 경보 주기에 서명된 JSON 알림을 전송한다. 두 값은 저장소나 shell history에 기록하지 않는다.

```bash
sudo install -d -o yoro -g yoro -m 700 /var/lib/yoro-monitor
sudo install -o root -g root -m 644 deploy/systemd/yoro-edge-monitor.service /etc/systemd/system/yoro-edge-monitor.service
sudo install -o root -g root -m 644 deploy/systemd/yoro-edge-monitor.timer /etc/systemd/system/yoro-edge-monitor.timer
sudo systemctl daemon-reload
sudo systemctl enable --now yoro-edge-monitor.timer
sudo systemctl start yoro-edge-monitor.service
systemctl status yoro-edge-monitor.service --no-pager
```

이 webhook monitor만으로 HTTP 5xx 비율, p95 latency와 memory를 집계할 수는 없다. 또한 `startedAt` 비교는 재시작 발생 여부만 감지하며 container runtime의 누적 restart count를 대체하지 않는다. 해당 지표는 Cloudflare Analytics와 host/container monitoring agent를 실제 수신 채널에 연결하고 test alert 증적을 남겨야 GO로 인정한다.

## Log Retention

- Docker json-file: `10m`, server 5개, 보조 서비스 3개
- application JSONL: 파일별 기본 10MiB, 5개 회전본
- 운영 보관 기간과 개인정보 삭제 정책은 별도 승인한다.
- 로그 수집기 전송 시 token, cookie, Riot/Twitch key, 메일 본문/첨부를 필터링한다.

## Deployment Verification

```bash
curl --fail --silent https://<production-host>/health/live
curl --fail --silent https://<production-host>/health/ready
curl -I https://<production-host>/dashboard/config.js
docker compose ps
docker compose logs --tail=200 server
```

## Dashboard

최소 dashboard에는 배포 SHA, request rate, 5xx, p95 latency, memory, disk, restart count, persistence failure, external API timeout/429, EventSub/bridge 상태를 표시한다.

## Launch Gate

- [ ] `OPS_ALERT_WEBHOOK_URL`을 운영 secret store에 등록했다.
- [ ] `OPS_ALERT_WEBHOOK_SECRET`을 운영 secret store에 등록하고 수신기에서 HMAC 검증을 활성화했다.
- [ ] `npm run ops:test-alert`의 정상/실패 알림 두 건을 실제 채널에서 확인했다.
- [ ] 의도적으로 잘못된 점검 URL을 사용해 test alert 수신을 확인했다.
- [ ] 정상 URL 복구 후 recovery alert 수신을 확인했다.
- [ ] backup을 26시간 이상 오래된 것으로 격리 시뮬레이션해 backup alert를 확인했다.
- [ ] disk, restart, 5xx, latency 경보가 실제 monitoring provider에서 수신된다.
- [ ] on-call 담당자와 야간 알림 정책을 기록했다.
