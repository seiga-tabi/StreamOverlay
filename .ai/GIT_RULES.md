# YORO.gg Git Rules

## 1. Branch 전략

| Branch | 역할 |
|---|---|
| `main` | production stable |
| `develop` | integration |
| `release/x.y.z` | release stabilization |
| `hotfix/x.y.z` | production emergency fix |
| `feature/<area>/<slug>` | 일반 기능 |
| `codex/<topic>` | Codex/AI 작업 |

`main` 직접 push 금지.

## 2. Branch 운영 규칙

- feature branch는 `develop`에서 분기한다.
- hotfix는 `main`에서 분기한다.
- hotfix 완료 후 `main`과 `develop`에 모두 반영한다.
- release branch에는 bugfix와 release note만 허용한다.
- AI agent 작업 branch는 `codex/` prefix를 기본으로 사용한다.

## 3. Commit Message 규칙

권장 형식:

```text
type(scope): summary
```

type:

- `docs`
- `feat`
- `fix`
- `refactor`
- `test`
- `chore`
- `style`
- `perf`

예:

```text
docs(ai): add development rules
refactor(dashboard): introduce shell adapter
fix(overlay): preserve source url token handling
```

## 4. PR 크기 제한

- production code diff 400 lines 이하 권장
- CSS diff 300 lines 이하 권장
- 변경 파일 15개 이하 권장
- 문서 PR은 예외 가능하나 문서별 목적이 명확해야 한다.

## 5. Merge 조건

- build/type/test 또는 미실행 사유 기록
- QA checkpoint 통과
- performance budget 확인
- rollback note 포함
- Product/Architecture/Design System 위반 없음
- reviewer approval

## 6. Rollback Branch 규칙

긴급 rollback이 필요한 경우:

```text
rollback/<date>-<area>
```

예:

```text
rollback/2026-07-08-overlay-runtime
```

Rollback PR에는 다음을 포함한다.

- incident 원인
- 되돌리는 commit/PR
- 영향 범위
- 재배포 필요 여부
- 후속 방지책

## 7. 금지

- `git reset --hard` 임의 사용
- 사용자 변경 revert
- unrelated formatting
- 여러 목적을 한 PR에 섞기
- feature flag 없이 high-risk merge

