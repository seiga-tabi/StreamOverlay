# YORO Agent 등록과 상태 Ingestion protocol

이 문서는 Server API와 test client가 구현한 protocol v1을 설명합니다. 실제 Palworld 서버에 연결하는 Agent daemon, RCON, AdminPassword, player name 수집, Notification Worker와 Discord 상태 메시지는 아직 구현하지 않았습니다.

## 기능 경계

`AGENT_INGESTION_ENABLED=false`가 기본값입니다.

- 비활성: `/api/agent/v1/*`는 `404`이며 Database query를 실행하지 않습니다.
- 활성 + Database 비활성·미준비·migration pending: Agent endpoint만 `503 agent_unavailable`입니다.
- Agent offline·stale 상태는 Server readiness를 실패시키지 않습니다.
- Database 자체를 활성화한 배포에서는 기존 Database readiness 정책을 유지합니다.

Server 시작 시 migration을 자동 적용하지 않습니다. protocol을 활성화하기 전에 `0007_agent_registration_and_ingestion`이 적용되어야 합니다.

## Bootstrap과 장기 credential

Dashboard가 발급하는 bootstrap token은 Organization, Palworld game server, 발급 사용자에 귀속된 10분 일회용 token입니다. Agent credential과 역할이 다릅니다.

```text
POST /api/agent/v1/register
Content-Type: application/json

{
  "bootstrapToken": "<one-time-token>",
  "agentVersion": "1.0.0",
  "platform": "linux",
  "architecture": "x64"
}
```

등록 transaction은 bootstrap row와 game server를 lock하고 다음을 원자적으로 수행합니다.

1. hash exact match, `issued`, 만료 전, 활성 `agent` server 검증
2. 새로운 opaque Agent credential 생성
3. credential SHA-256 hash와 만료 시각만 저장
4. 기존 installation이 있으면 credential version 증가와 이전 credential 폐기
5. bootstrap을 `consumed`로 변경
6. game server 연결 상태를 `pending`으로 변경
7. 안전한 audit 기록

Agent credential 원문은 `201` 등록 응답 한 번에서만 반환됩니다. bootstrap 또는 credential 원문, nonce, Authorization header는 Database·audit·일반 로그에 저장하지 않습니다. 유출 시 기존 installation을 폐기하고 새 bootstrap으로 재등록해야 합니다.

## Status protocol v1

```text
POST /api/agent/v1/status
Authorization: Bearer <agent-token>
X-Yoro-Agent-Timestamp: <unix-seconds>
X-Yoro-Agent-Nonce: <base64url-random>
X-Yoro-Payload-Version: 1
Content-Type: application/json
```

```json
{
  "payloadVersion": 1,
  "observedAt": "2026-07-29T00:00:00.000Z",
  "online": true,
  "players": 6,
  "maxPlayers": 16,
  "gameVersion": "0.x.x",
  "uptimeSeconds": 86400,
  "cpuPercent": 10,
  "memoryPercent": 40,
  "diskPercent": 60,
  "latencyMs": 28
}
```

Unknown field, player name, 주소, password, nested raw payload는 거부합니다. count·percentage·timestamp·문자열 길이를 제한하며 body는 기본 16KiB 이하입니다.

Timestamp는 기본 ±300초 범위이고 nonce hash는 installation별로 한 번만 소비됩니다. nonce 원문은 저장하지 않으며 기본 600초 후 정리할 수 있습니다. 동일 credential의 기본 제한은 분당 120회입니다.

## 저장 일관성

인증, nonce 소비, history, current, online/offline event, installation `last_seen_at`, game server 연결 상태 갱신은 하나의 transaction에서 수행합니다.

- 더 오래된 `observedAt`: history에는 저장하지만 current를 덮지 않습니다.
- 동일 installation·동일 timestamp·동일 payload hash: idempotent duplicate입니다.
- 동일 installation·동일 timestamp·다른 payload: conflict로 전체 rollback합니다.
- 최초 status: online/offline event를 생성하지 않습니다.
- 이후 online 전환: `server.online`
- 이후 offline 전환: `server.offline`

History에는 allowlist metric만 column으로 저장하며 raw payload, player name, IP와 credential은 저장하지 않습니다.

## Staging 확인

1. 전용 staging Database backup을 준비합니다.
2. migration `check`와 `plan`에서 `0007` checksum을 확인합니다.
3. 별도 승인 후 staging에만 migration을 적용합니다.
4. feature 비활성 상태의 `404`와 기존 방송 기능을 확인합니다.
5. feature 활성 후 Database 미준비 `503` 경계를 확인합니다.
6. test client로 등록 성공, 동시 등록 하나만 성공, replay, stale, duplicate, conflict와 tenant A/B를 검증합니다.
7. credential 원문이 Database·로그에 없는지 sentinel test로 확인합니다.
8. 실제 운영 활성화는 Agent daemon과 Notification Worker 작업과 별도 승인으로 진행합니다.

