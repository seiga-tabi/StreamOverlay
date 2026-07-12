# YORO.gg Production Rollback

## 원칙

- rollback은 immutable Git SHA와 Docker image digest를 기준으로 한다.
- `latest` tag만으로 rollback하지 않는다.
- volume 삭제, DB drop, force push, `docker compose down -v`는 금지한다.
- DB schema migration이 포함된 release는 자동 rollback하지 않고 DBA/Release Manager 승인을 받는다.

## 사전 기록

배포 전에 아래 값을 release note에 기록한다.

- 현재 production Git SHA
- 신규 release Git SHA
- 현재 image tag와 digest
- 신규 image tag와 digest
- config/env version 또는 변경 목록
- 직전 상태 백업 경로와 manifest 검증 결과

## Application Rollback

1. 장애 범위와 시작 시각을 기록하고 신규 rollout을 중단한다.
2. 이전 production image digest를 확인한다.
3. compose 또는 배포 플랫폼의 image를 이전 immutable digest로 지정한다.
4. volume을 유지한 채 application container만 교체한다.
5. `/health/live`, `/health/ready`, 로그인, Riot 검색, Twitch/OBS 핵심 smoke를 확인한다.
6. 오류율과 재시작 횟수가 안정화될 때까지 rollout을 확대하지 않는다.

예시 형식:

```bash
export YORO_SERVER_IMAGE='registry.example/yoro-server@sha256:<approved-previous-digest>'
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --no-deps server
curl --fail --silent https://<production-host>/health/live
curl --fail --silent https://<production-host>/health/ready
```

실제 registry와 host는 운영자가 입력한다. shell history에 secret을 넣지 않는다.

## Configuration Rollback

1. secret 자체가 아니라 config version과 변수명 변경 목록을 확인한다.
2. 이전 승인 config version을 secret manager에서 복원한다.
3. `npm run validate:runtime`와 compose config 검증을 통과시킨다.
4. app container만 재기동하고 health를 확인한다.

## State Restore

상태 복원은 application rollback만으로 회복되지 않고 데이터 손상이 확인된 경우에만 수행한다.

```bash
npm run restore:state -- --source=/approved/backup --state-dir=/approved/state
npm run restore:state -- --source=/approved/backup --state-dir=/approved/state --apply --server-stopped
```

첫 명령은 무결성 dry-run이다. 실제 복원 전 서버를 중지하고 Release Manager 승인을 받는다. 스크립트는 덮어쓸 기존 파일을 별도 pre-restore 디렉터리에 보존하며, 백업에 없는 파일은 삭제하지 않는다.

## DB Migration

현재 Sprint5 변경은 DB migration을 수행하지 않는다. 향후 migration이 포함되면 아래가 없을 경우 release를 중단한다.

- forward/backward compatibility 문서
- schema backup
- rollback SQL 또는 roll-forward 계획
- staging restore rehearsal
- DBA 승인

## 종료 조건

- 이전 SHA/image digest가 실제 실행 중이다.
- readiness가 200이다.
- 방송 운영 핵심 상태가 복원되었다.
- 장애 원인과 rollback 결과가 incident 기록에 남았다.
