# YORO.gg Sprint1 Rollback Plan

## 1. Rollback 원칙

Sprint1은 behavior change가 없어야 한다. 문제가 발생하면 가장 작은 단위로 rollback한다.

우선순위:

1. feature flag off
2. 해당 Task PR revert
3. token alias section revert
4. shared UI files unused 상태로 유지
5. emergency rollback branch

## 2. Task별 Rollback

| Task | Rollback 방법 |
|---|---|
| S1-001 | 코드 변경 없음. 기록 오류만 정정 |
| S1-002 | runtime flag helper revert, 기존 config shape 복구 |
| S1-003 | `apps/dashboard/src/api/client.ts` revert |
| S1-004 | `apps/dashboard/src/api/socket.ts`, `apps/overlay/src/socket.ts` revert |
| S1-005 | `apps/dashboard/src/i18n.ts` revert |
| S1-006 | dashboard token alias section revert |
| S1-007 | overlay token alias section revert |
| S1-008 | new Button/IconButton files revert |
| S1-009 | new Card/Panel/Metric files revert |
| S1-010 | new PageHeader/state files revert |
| S1-011 | barrel export revert |
| S1-012 | 실패한 선행 Task rollback 지시 |

## 3. Rollback Trigger

즉시 rollback:

- build failure unresolved
- config validation failure
- auth header/CSRF regression
- WebSocket URL/protocol 변경 감지
- overlay blank frame
- dashboard visual diff > 0.3%
- overlay visual diff > 0.1%
- no-touch file 변경
- package/Docker/DB 변경

## 4. Emergency Branch

형식:

```text
rollback/2026-07-08-sprint1-<task-or-area>
```

예:

```text
rollback/2026-07-08-sprint1-api-client
rollback/2026-07-08-sprint1-token-alias
```

## 5. Rollback PR Template

```md
## Rollback Target
- Task:
- PR:
- Commit:

## Reason
- Trigger:
- Impact:

## Files Reverted
- 

## Verification
- build:
- config:
- test:
- visual:

## Follow-up
- 
```

## 6. Rollback 후 재시도 조건

- root cause 확인
- Task scope 재분할
- no-touch file 영향 제거
- QA gap 보완
- reviewer 재승인

