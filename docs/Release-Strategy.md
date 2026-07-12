# YORO.gg Release Strategy

## 1. 목표

리팩토링 중에도 production 서비스와 방송 운영이 안정적으로 유지되도록 Dev, Stage, Production 배포 전략을 정의한다.

## 2. Environment Strategy

| 환경 | 목적 | Flag Default | 배포 방식 |
|---|---|---|---|
| Dev | 개발/초기 검증 | v2 on 가능 | local/dev server |
| Stage | production 유사 검증 | sprint 대상 flag on | staging deploy |
| Production | 실제 서비스 | conservative default off | blue/green 우선 |

## 3. 배포 전략

권장:

- frontend static artifact: blue/green
- server API: rolling 가능하나 API migration 기간에는 blue/green 우선
- overlay runtime: blue/green 고정
- bridge: broadcast PC 수동 업데이트, 자동 rolling 금지
- DB migration: 현재 Prisma 없음. future migration은 expand/contract only

## 4. Blue/Green 기준

Blue:

- 현재 production stable

Green:

- 새 build
- feature flags default controlled
- health/ready check 통과
- smoke test 통과

Switch 조건:

1. `/health`, `/health/live`, `/health/ready` 통과
2. public search smoke 통과
3. dashboard auth smoke 통과
4. overlay preview smoke 통과
5. API error rate baseline 이하

## 5. Rolling 기준

Rolling은 다음 경우만 허용한다.

- docs only
- low-risk CSS token alias
- non-critical dashboard UI
- API adapter가 legacy path를 유지하는 경우

Rolling 금지:

- overlay runtime
- auth/session
- participation queue mutation
- ActionDispatcher
- bridge/OBS command
- Store persistence 변경

## 6. Release Gate

| Gate | 조건 |
|---|---|
| Gate 1 | build/type/test/config |
| Gate 2 | QA Checkpoint |
| Gate 3 | Performance Budget |
| Gate 4 | Stage 24h 또는 방송 전 rehearsal |
| Gate 5 | Rollback plan 확인 |

## 7. Hotfix Strategy

Hotfix 조건:

- production boot failure
- auth failure
- overlay blank
- participation data corruption
- unsafe action risk

Hotfix 흐름:

```text
main
  -> hotfix/x.y.z
  -> stage smoke
  -> production
  -> merge back to develop
```

## 8. Release Manager 체크리스트

- feature flag default 확인
- migration PR 목록 확인
- rollback owner 확인
- monitoring dashboard 확인
- stage smoke 결과 확인
- production deploy window 확인
- 방송 일정과 충돌 없는지 확인

