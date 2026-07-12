# YORO.gg Sprint1 PR Plan

## 1. PR 기본 전략

- PR 하나는 Task 하나만 포함한다.
- PR당 최대 변경 파일 수: 6개
- PR당 최대 production LOC: 250 lines
- CSS PR 최대 LOC: 300 lines
- 문서/QA 기록은 PR description에 작성하고 새 설계 문서 생성 금지
- behavior change가 있으면 Sprint1 범위 위반으로 본다.

## 2. Issue/PR 목록

| PR | Issue | Task | Branch | Max Files | Max LOC | Review |
|---|---|---|---|---:|---:|---|
| PR-01 | `ISSUE-S1-001` | S1-001 | `feature/S1-001-baseline` | 0 | 0 | QA Lead |
| PR-02 | `ISSUE-S1-002` | S1-002 | `feature/S1-002-feature-flags` | 2 | 160 | Principal Architect |
| PR-03 | `ISSUE-S1-003` | S1-003 | `feature/S1-003-api-client` | 1 | 160 | Frontend + Security |
| PR-04 | `ISSUE-S1-004` | S1-004 | `feature/S1-004-socket-adapter` | 2 | 180 | Frontend + Overlay |
| PR-05 | `ISSUE-S1-005` | S1-005 | `feature/S1-005-i18n-adapter` | 1 | 120 | Frontend + i18n |
| PR-06 | `ISSUE-S1-006` | S1-006 | `feature/S1-006-design-token-dashboard` | 1 | 300 | Design System |
| PR-07 | `ISSUE-S1-007` | S1-007 | `feature/S1-007-design-token-overlay` | 1 | 220 | Overlay + Design System |
| PR-08 | `ISSUE-S1-008` | S1-008 | `feature/S1-008-button` | 4 | 220 | Design System + Accessibility |
| PR-09 | `ISSUE-S1-009` | S1-009 | `feature/S1-009-card-metric` | 5 | 240 | Design System |
| PR-10 | `ISSUE-S1-010` | S1-010 | `feature/S1-010-pageheader-state` | 6 | 250 | Frontend + Accessibility |
| PR-11 | `ISSUE-S1-011` | S1-011 | `feature/S1-011-shared-exports` | 2 | 80 | Principal Architect |
| PR-12 | `ISSUE-S1-012` | S1-012 | `feature/S1-012-sprint1-qa` | 0 | 0 | QA + Release |

## 3. Merge 조건

필수:

- target Task만 변경
- no-touch file 변경 없음
- `git diff --name-only` 범위가 PR plan과 일치
- build/typecheck 결과 또는 미실행 사유
- QA checklist 포함
- rollback 방법 포함
- Product/Architecture/Design System 위반 없음

## 4. Review 조건

공통 review:

- Sprint1 scope 준수
- behavior change 없음
- legacy fallback 유지
- feature flag default 안전
- i18n hardcoding 없음
- accessibility regression 없음
- no secret/logging risk

Task별 추가 review:

| Task | 추가 Review |
|---|---|
| S1-002 | flag default, config fallback |
| S1-003 | CSRF/header/auth surface 유지 |
| S1-004 | WS URL/protocol/reconnect 유지 |
| S1-006 | visual diff, no selector deletion |
| S1-007 | OBS first frame, no heavy visual cost |
| S1-008~S1-010 | token usage, 44px target, focus state |

## 5. PR Description Template

```md
## Task
- ID:
- Issue:
- Branch:

## Scope
- Changed files:
- No-touch files confirmed:

## Behavior
- Expected behavior change: none

## QA
- Build:
- Typecheck:
- Test:
- Visual:
- Accessibility:
- i18n:

## Rollback
- Method:

## Risk
- Level:
- Notes:
```

## 6. PR 금지 사항

- 여러 Task 섞기
- page migration 시작
- CSS selector 삭제
- API endpoint 변경
- server route 변경
- package/Docker/DB 변경
- OBS URL 변경
- legacy component 삭제
