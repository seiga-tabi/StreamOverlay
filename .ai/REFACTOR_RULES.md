# YORO.gg Refactor Rules

## 1. 기본 원칙

YORO.gg 리팩토링은 Zero Downtime Refactor를 목표로 한다. 기존 서비스가 항상 동작해야 한다.

## 2. Big Bang Refactor 금지

금지:

- 여러 feature를 한 PR에서 동시에 변경
- 파일 이동과 behavior change를 같은 PR에 포함
- CSS token 변경과 redesign을 동시에 수행
- API namespace 변경과 auth 정책 변경을 동시에 수행
- Store abstraction과 Prisma 도입을 동시에 수행

## 3. 작은 PR 원칙

PR 크기 기준:

- shared contract: domain 하나
- component: 1~3개
- CSS token: token group 하나
- page: section 하나
- API: endpoint group 하나
- overlay: mode 또는 channel 하나
- repository: domain 하나

## 4. Compatibility Layer 사용

새 구조는 legacy와 병행해야 한다.

| Legacy | New | 전략 |
|---|---|---|
| legacy component | shared/feature component | wrapper adapter |
| `/api/*` | `/api/v1/*` | route adapter |
| global CSS | token/layer CSS | alias bridge |
| `Store` class | repository interface | JSON adapter |
| existing overlay URL | source builder | URL compatibility |

## 5. Feature Flag 사용

High-risk 변경은 반드시 feature flag를 사용한다.

필수 flag 영역:

- dashboard shell
- shared UI
- design token
- overlay studio
- overlay runtime
- public search
- participation
- community
- API v1
- repository layer

Production default는 보수적으로 off에서 시작한다.

## 6. Legacy 보존 규칙

- legacy route 즉시 삭제 금지
- legacy component 즉시 삭제 금지
- legacy CSS 즉시 삭제 금지
- legacy store 직접 제거 금지
- legacy OBS URL 유지

삭제는 100% rollout 후 최소 1 release 안정화 이후에만 가능하다.

## 7. Rollback 가능성 확보

모든 PR은 rollback 경로를 명시한다.

필수:

- feature flag off 가능
- legacy fallback 가능
- API legacy endpoint 유지
- CSS token alias revert 가능
- Store JSON fallback 가능

## 8. Sprint별 변경 제한

| Sprint | 허용 변경 |
|---|---|
| Sprint 1 | foundation, flag, token alias, API adapter |
| Sprint 2 | dashboard shell, shared UI |
| Sprint 3 | dashboard/overlay studio boundary |
| Sprint 4 | public search/profile strangler |
| Sprint 5 | participation/community/tournament/API v1 |
| Sprint 6 | repository/performance/deprecated cleanup |

Sprint 범위를 넘는 변경은 별도 승인 필요.

## 9. 완료 기준

- 기존 flow 회귀 없음
- QA checkpoint 통과
- performance budget 초과 없음
- rollback 경로 존재
- 문서 업데이트 완료

