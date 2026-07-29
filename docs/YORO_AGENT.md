# YORO Agent 운영 경계와 로컬 실행

YORO Agent는 Palworld Dedicated Server와 같은 장비에서 실행되는 읽기 전용 daemon입니다. Dashboard에서 발급한 10분 일회용 bootstrap token으로 한 번 등록한 뒤, 장기 Agent credential을 권한 제한 파일에 저장하고 집계 상태만 YORO Server로 전송합니다.

## 책임 범위

Agent가 수행합니다.

- `/api/agent/v1/register` 최초 등록
- credential 파일의 `0700` directory·`0600` file 저장
- 공식 Palworld REST `/v1/api/info`, `/v1/api/metrics` 읽기
- online, player count, max player, version, uptime, latency 집계
- protocol v1 payload 검증과 전송
- bounded retry와 마지막 미전송 상태 한 개 보존
- loopback `/health/live`, `/health/ready`

Agent가 수행하지 않습니다.

- Palworld 시작·종료·재시작
- RCON, shell command, Docker socket 접근
- player 이름·Steam ID·IP 수집 또는 전송
- AdminPassword의 Server 전송
- Discord API, Notification Worker, 결제

## Secret과 state

Production에서는 bootstrap token과 Palworld AdminPassword를 command line이나 직접 환경 변수로 전달하지 않습니다. 각각 권한 `0600`의 `YORO_AGENT_BOOTSTRAP_TOKEN_FILE`, `PALWORLD_ADMIN_PASSWORD_FILE`을 사용합니다. credential directory는 `0700`, credential은 `0600`이어야 합니다.

등록 성공 후 Agent는 bootstrap token을 복사하거나 자동 삭제하지 않습니다. 운영자가 등록 성공을 확인한 뒤 bootstrap token file을 직접 제거합니다. credential 파일이 손상됐거나 Server origin이 바뀌면 새 identity를 자동 생성하지 않고 fail-closed 상태가 됩니다.

## Palworld REST

`PALWORLD_REST_ORIGIN`은 literal loopback `127.0.0.1` 또는 `::1`만 허용합니다. 공식 읽기 endpoint 외 요청, redirect, 외부 origin은 차단합니다. AdminPassword는 로컬 Basic 인증에만 사용되고 로그·payload·offline buffer에 들어가지 않습니다.

Container에서 Palworld host의 loopback은 container 자체를 가리킵니다. Linux 운영 환경의 network mode나 loopback proxy는 운영자가 환경별로 검증해야 하며, 검증되지 않은 `host.docker.internal`을 기본값으로 사용하지 않습니다.

## Retry와 offline 상태

- 기본 전송 주기: 300초, 하한 60초
- network·`5xx`·`429`만 최대 5회 이내 재시도
- `401`·`403` credential 오류와 `409` conflict는 재시도하지 않음
- retry마다 nonce는 새로 생성하며 같은 payload의 `observedAt`은 유지
- offline buffer는 마지막 미전송 상태 한 개, 최대 4KiB·24시간
- buffer가 손상되면 빈 queue로 덮어쓰지 않고 fail-closed

## Health

Health server는 loopback에만 bind합니다.

- `/health/live`: process event loop 생존 여부
- `/health/ready`: config·credential·scheduler 실행 가능 여부

Palworld offline이나 REST 일시 장애는 Agent process readiness를 실패시키지 않습니다. credential 손상·만료·거부는 readiness 실패입니다. Health 응답에는 token, password, nonce, player 정보, raw response를 포함하지 않습니다.

## 로컬 검증

실제 credential 값을 명령줄에 넣지 않습니다. source build는 다음으로 검증합니다.

```bash
npm run build:shared
npm --workspace apps/agent run build
npm --workspace apps/agent run test:run
```

Docker image는 immutable tag·digest가 확정되기 전 운영 설치 안내로 사용하지 않습니다. 이 단계에서는 registry publish와 운영 배포를 수행하지 않습니다.

## 아직 없는 기능

- Notification Worker와 Discord 고정 Embed
- `/yoro server status`
- Agent credential rotation API
- CPU·memory·disk의 검증된 수집 adapter

Credential 기본 만료는 90일입니다. Rotation API가 추가되기 전에는 만료 전에 새 bootstrap을 발급해 명시적으로 재등록해야 합니다.
