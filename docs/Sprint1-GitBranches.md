# YORO.gg Sprint1 Git Branch Plan

## 1. Branch 원칙

- Sprint1 branch는 모두 `feature/S1-XXX-*` 형식을 사용한다.
- 한 branch는 한 Task만 담당한다.
- branch 하나에 여러 목적을 섞지 않는다.
- dependency가 있는 branch는 선행 PR merge 후 최신 `develop`에서 분기한다.
- emergency rollback은 `rollback/<date>-<area>` 형식을 사용한다.

## 2. Task Branch List

| Task ID | Branch | Base | Merge Target | 비고 |
|---|---|---|---|---|
| S1-001 | `feature/S1-001-baseline` | `develop` | `develop` | code change 없음 |
| S1-002 | `feature/S1-002-feature-flags` | `develop` after S1-001 | `develop` | config helper |
| S1-003 | `feature/S1-003-api-client` | `develop` after S1-002 | `develop` | API adapter |
| S1-004 | `feature/S1-004-socket-adapter` | `develop` after S1-002 | `develop` | socket adapter |
| S1-005 | `feature/S1-005-i18n-adapter` | `develop` after S1-002 | `develop` | i18n audit |
| S1-006 | `feature/S1-006-design-token-dashboard` | `develop` after S1-002 | `develop` | dashboard CSS alias |
| S1-007 | `feature/S1-007-design-token-overlay` | `develop` after S1-002 | `develop` | overlay CSS alias |
| S1-008 | `feature/S1-008-button` | `develop` after S1-006 | `develop` | Button/IconButton |
| S1-009 | `feature/S1-009-card-metric` | `develop` after S1-008 | `develop` | Card/Metric |
| S1-010 | `feature/S1-010-pageheader-state` | `develop` after S1-009 | `develop` | PageHeader/states |
| S1-011 | `feature/S1-011-shared-exports` | `develop` after S1-010 | `develop` | exports/boundary |
| S1-012 | `feature/S1-012-sprint1-qa` | `develop` after S1-011 | `develop` | final QA |

## 3. PR Naming

```text
[Sprint1][S1-XXX] <task name>
```

예:

```text
[Sprint1][S1-006] Dashboard design token alias
```

## 4. Commit Message 예시

```text
refactor(dashboard): add feature flag runtime foundation
refactor(dashboard): add api client compatibility adapter
style(dashboard): add design token aliases
feat(ui): add shared button foundation
test(qa): record sprint1 baseline verification
```

## 5. Rollback Branch

형식:

```text
rollback/2026-07-08-sprint1-<area>
```

예:

```text
rollback/2026-07-08-sprint1-token-alias
```

## 6. Branch 보호 규칙

- `main` 직접 merge 금지
- `develop` merge 전 review 필수
- failing build merge 금지
- no-touch file 변경 시 merge 금지
- Sprint 범위 외 변경 시 split 요구

