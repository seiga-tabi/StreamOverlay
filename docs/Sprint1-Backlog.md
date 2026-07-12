# YORO.gg Sprint1 Backlog

## 1. Sprint1 목표

Sprint1은 구현 리팩토링을 시작하기 위한 Foundation Sprint다. 목표는 기존 서비스 동작을 바꾸지 않고 이후 Sprint2~5가 안전하게 진행될 수 있는 기반을 코드에 준비하는 것이다.

절대 원칙:

- UX behavior change 금지
- route 변경 금지
- API response shape 변경 금지
- OBS overlay URL 변경 금지
- package/Docker/DB 변경 금지
- legacy fallback 유지
- 모든 Task는 4시간 이하

## 2. Epic → Feature → Task 구조

### Epic S1-E1: Sprint1 Baseline and Guardrails

목표: Sprint1 작업 전 baseline과 금지 범위를 고정한다.

Feature:

- S1-F1.1 Baseline verification
- S1-F1.2 No-touch guardrails

Tasks:

- S1-001 Baseline and no-touch verification

### Epic S1-E2: Runtime Compatibility Foundation

목표: 새 구조와 legacy 구조를 동시에 운용할 수 있는 adapter/flag 기반을 만든다.

Feature:

- S1-F2.1 Feature flag runtime contract
- S1-F2.2 Dashboard API compatibility adapter
- S1-F2.3 Socket compatibility adapter
- S1-F2.4 i18n adapter audit

Tasks:

- S1-002 Feature flag runtime foundation
- S1-003 Dashboard API client compatibility adapter
- S1-004 Dashboard and overlay socket adapter boundary
- S1-005 Dashboard i18n adapter audit

### Epic S1-E3: Design Token Alias Foundation

목표: 기존 화면을 바꾸지 않고 token alias를 도입할 준비를 한다.

Feature:

- S1-F3.1 Dashboard token alias
- S1-F3.2 Overlay token alias

Tasks:

- S1-006 Dashboard design token alias
- S1-007 Overlay design token alias

### Epic S1-E4: Shared UI Component Foundation

목표: Sprint2에서 Dashboard Shell에 적용할 공통 UI component skeleton을 만든다.

Feature:

- S1-F4.1 Button foundation
- S1-F4.2 Card/Metric foundation
- S1-F4.3 Header/state foundation
- S1-F4.4 Shared exports

Tasks:

- S1-008 Shared Button and IconButton foundation
- S1-009 Shared Card, Panel, MetricCard foundation
- S1-010 Shared PageHeader and state components foundation
- S1-011 Shared UI exports and import boundary check

### Epic S1-E5: Sprint1 QA and Release Readiness

목표: Sprint1 결과가 production behavior를 바꾸지 않았음을 확인한다.

Feature:

- S1-F5.1 Sprint1 verification

Tasks:

- S1-012 Sprint1 final QA and release readiness

## 3. Task 완료 순서

```text
S1-001
  -> S1-002
    -> S1-003
    -> S1-004
    -> S1-005
  -> S1-006
    -> S1-007
  -> S1-008
    -> S1-009
      -> S1-010
        -> S1-011
  -> S1-012
```

병렬 가능:

- S1-003, S1-004, S1-005는 S1-002 이후 병렬 가능
- S1-006, S1-007은 S1-002 이후 병렬 가능
- S1-008은 S1-006 이후 시작 가능
- S1-009는 S1-008과 부분 병렬 가능하나 shared token naming 확정 후 시작

## 4. Sprint1 Task Summary

| Task ID | Priority | Estimate | Owner | Risk | Branch |
|---|---|---:|---|---|---|
| S1-001 | P0 | 2h | QA Lead | Low | `feature/S1-001-baseline` |
| S1-002 | P0 | 3h | Principal Frontend Architect | Medium | `feature/S1-002-feature-flags` |
| S1-003 | P0 | 3h | Lead Frontend Engineer | Medium | `feature/S1-003-api-client` |
| S1-004 | P1 | 3h | Lead Frontend Engineer | Medium | `feature/S1-004-socket-adapter` |
| S1-005 | P1 | 2h | Frontend Engineer | Low | `feature/S1-005-i18n-adapter` |
| S1-006 | P0 | 4h | Design System Engineer | Medium | `feature/S1-006-design-token-dashboard` |
| S1-007 | P1 | 3h | Overlay Engineer | Medium | `feature/S1-007-design-token-overlay` |
| S1-008 | P0 | 4h | Design System Engineer | Low | `feature/S1-008-button` |
| S1-009 | P0 | 4h | Design System Engineer | Low | `feature/S1-009-card-metric` |
| S1-010 | P1 | 4h | Frontend Engineer | Low | `feature/S1-010-pageheader-state` |
| S1-011 | P1 | 2h | Principal Frontend Architect | Low | `feature/S1-011-shared-exports` |
| S1-012 | P0 | 3h | QA Lead / Release Manager | Medium | `feature/S1-012-sprint1-qa` |

## 5. Issue Breakdown

원칙: Issue 하나는 Task 하나만 담당한다. Issue 하나가 여러 PR로 나뉘면 안 된다.

| Issue | Task | Title | PR |
|---|---|---|---|
| `ISSUE-S1-001` | S1-001 | Baseline and no-touch verification | PR-01 |
| `ISSUE-S1-002` | S1-002 | Feature flag runtime foundation | PR-02 |
| `ISSUE-S1-003` | S1-003 | Dashboard API client compatibility adapter | PR-03 |
| `ISSUE-S1-004` | S1-004 | Dashboard and overlay socket adapter boundary | PR-04 |
| `ISSUE-S1-005` | S1-005 | Dashboard i18n adapter audit | PR-05 |
| `ISSUE-S1-006` | S1-006 | Dashboard design token alias | PR-06 |
| `ISSUE-S1-007` | S1-007 | Overlay design token alias | PR-07 |
| `ISSUE-S1-008` | S1-008 | Shared Button and IconButton foundation | PR-08 |
| `ISSUE-S1-009` | S1-009 | Shared Card, Panel, MetricCard foundation | PR-09 |
| `ISSUE-S1-010` | S1-010 | Shared PageHeader and state components foundation | PR-10 |
| `ISSUE-S1-011` | S1-011 | Shared UI exports and import boundary check | PR-11 |
| `ISSUE-S1-012` | S1-012 | Sprint1 final QA and release readiness | PR-12 |

Issue 필수 본문:

- Task ID
- 변경 파일
- 절대 수정 금지 파일
- Acceptance Criteria
- QA Checklist
- Rollback 방법
- Branch
- PR link

## 6. Sprint1 종료 조건

- 모든 Task가 4시간 이하 단위로 완료
- production behavior change 없음
- 기존 route/API/OBS URL 유지
- legacy fallback 유지
- feature flag default 확인
- Design Token alias visual diff 허용 범위 내
- shared UI component가 page에 대량 적용되지 않음
- `npm run build` 결과 확인
- `npm run validate:config` 결과 확인
- `npm test` 결과 확인
- 미실행 항목은 사유와 risk 기록
- Sprint2가 Dashboard Shell 작업을 바로 시작할 수 있음

## 7. Sprint1에서 하지 않는 일

- Dashboard redesign
- Public Search migration
- Overlay runtime migration
- API v1 route 추가
- Store repository abstraction
- Prisma/DB 작업
- Docker/deploy 변경
- dependency 추가
- legacy CSS 삭제
- legacy component 삭제
