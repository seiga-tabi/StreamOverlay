# YORO.gg Master Refactor Specification v1

## 1. 문서 목적

이 문서는 YORO.gg Sprint1부터 Sprint5까지 Codex와 모든 AI Agent가 헤매지 않고 동일한 순서로 리팩토링을 수행하도록 만드는 최상위 작업 명세서다.

본 문서는 다음 문서를 기준으로 한다.

- `Product-Constitution.md`
- `Product-Vision.md`
- `Product-Principles.md`
- `Product-Experience.md`
- `North-Star-Loop.md`
- `Architecture-v2.md`
- `Migration-Plan.md`
- `Execution-Plan.md`
- `Design-System-Constitution.md`
- `Architecture-Governance.md`
- `.ai/AI_DEVELOPMENT_RULES.md`
- `.ai/QA_RULES.md`
- `.ai/REVIEW_RULES.md`
- `.ai/GIT_RULES.md`

## 2. Master Refactor Timeline

| Sprint | 목표 | 핵심 결과물 | Production 원칙 |
|---|---|---|---|
| Sprint1 | Foundation | Feature Flag, API Adapter, Design Token Alias, Shared UI 준비 | behavior change 없음 |
| Sprint2 | Dashboard Shell | AppShell, Navigation, Layout, shared Button/Card/PageHeader | legacy page fallback 유지 |
| Sprint3 | Dashboard/Overlay Studio | Today Broadcast, Overlay Studio boundary, OBS URL compatibility | overlay runtime flag off 기본 |
| Sprint4 | Public Search/Profile | `PublicLolPage` strangler, Search/Profile API adapter | legacy public fallback 유지 |
| Sprint5 | Participation/Community/Tournament/API v1 | core loop feature boundary, API v1 adapter, repository 준비 | legacy API와 JSON Store 유지 |

## 3. Sprint1 상세 작업 순서

Sprint1은 behavior change 없는 기반 작업만 수행한다.

순서:

1. Feature Flag contract
2. Runtime config adapter
3. API client compatibility adapter
4. Dashboard socket adapter
5. i18n adapter 확인
6. Design Token alias
7. Shared Button specification
8. Shared Card specification
9. Shared PageHeader specification
10. Legacy CSS import order 고정
11. Baseline QA 기록

파일 단위 순서:

1. `packages/shared/src/index.ts`
2. `packages/shared/src/actions.ts`
3. `packages/shared/src/overlay.ts`
4. `packages/shared/src/participation.ts`
5. `apps/dashboard/src/runtime-config.ts`
6. `apps/dashboard/src/api/client.ts`
7. `apps/dashboard/src/api/socket.ts`
8. `apps/dashboard/src/i18n.ts`
9. `apps/dashboard/src/styles/index.css`
10. `apps/overlay/src/styles/overlay.css`

Component 순서:

```text
Button
  -> Card
  -> MetricCard
  -> PageHeader
  -> EmptyState
  -> LoadingState
  -> ErrorState
  -> Layout Adapter
```

Page 순서:

```text
No page behavior migration in Sprint1
  -> Dashboard visual baseline only
  -> Public visual baseline only
  -> Overlay visual baseline only
```

상세는 `Sprint1-Specification.md`를 따른다.

## 4. 절대로 수정하면 안 되는 파일

본 MRS 작성 작업 중에는 모든 코드 파일 수정 금지다.

실제 Sprint 리팩토링에서도 명시된 Sprint task가 없으면 다음 파일은 수정하지 않는다.

| 파일/범위 | 이유 |
|---|---|
| `package.json` | dependency/build script 변경은 별도 승인 필요 |
| `package-lock.json` 또는 lock 파일 | dependency 변경 금지 |
| `tsconfig*.json` | build/type boundary 변경 금지 |
| `apps/*/vite.config.ts` | bundle/build 설정 변경 금지 |
| `Dockerfile`, `docker-compose*.yml` | production boot risk |
| `.env*`, secrets | secret 보호 |
| `apps/bridge/src/obs.ts` | OBS 제어 안전성 |
| `apps/bridge/src/server-connection.ts` | bridge live stability |
| `apps/server/src/core/action-dispatcher.ts` | unsafe action risk |
| `packages/shared/src/actions.ts` | allowlist 변경은 별도 보안 승인 필요 |
| DB/Prisma schema | 현재 Prisma 없음, Sprint5 이후 별도 검토 |

예외: 해당 Sprint 명세에서 명시적으로 수정 대상에 포함하고, QA/rollback이 정의된 경우만 허용한다.

## 5. 먼저 삭제해야 하는 코드

물리 삭제는 Sprint1에서 금지한다. 먼저 "삭제 후보"로 표시하고, usage 확인 후 cleanup PR에서 제거한다.

우선 삭제 후보:

| 후보 | 현재 위치 | 선행 조건 |
|---|---|---|
| 중복 button/card class | `apps/dashboard/src/styles/index.css` | shared Button/Card rollout 100% |
| hardcoded overlay channel list | `OverlayClientStatusCard.tsx` | shared `OVERLAY_CHANNELS` adapter 적용 |
| direct public fetch helpers | `PublicLolPage.tsx` | public API module parity |
| duplicate loading/empty blocks | page 내부 | shared state component 적용 |
| page-specific card shadow/radius | CSS global selectors | token alias 적용 |
| legacy API shape mapper | API v1 rollout 후 | 2 release 안정화 |
| unused tournament/community inline section | `PublicLolPage.tsx` | feature split 완료 |

삭제 규칙:

- usage `rg` 확인
- feature flag 100% rollout
- visual regression 통과
- rollback 불필요 승인

## 6. Legacy 유지 전략

- 기존 route는 유지한다.
- 기존 `/api/*`는 유지한다.
- 기존 OBS overlay URL은 유지한다.
- 기존 global CSS import order는 유지한다.
- 기존 `Store`는 JSON source of truth로 유지한다.
- 새 구조는 adapter와 feature flag 뒤에서 동작한다.

## 7. Feature Flag 적용 위치

| Flag | 적용 위치 |
|---|---|
| `YORO_DASHBOARD_SHELL_V2_ENABLED` | `apps/dashboard/src/App.tsx`, `Layout` adapter |
| `YORO_SHARED_UI_V2_ENABLED` | shared Button/Card/PageHeader consumer |
| `YORO_DESIGN_TOKENS_V2_ENABLED` | dashboard/overlay CSS token alias |
| `YORO_OVERLAY_STUDIO_V2_ENABLED` | `OverlayOpsPage`, overlay dashboard cards |
| `YORO_OVERLAY_RUNTIME_V2_ENABLED` | `apps/overlay/src/App.tsx` |
| `YORO_PUBLIC_SEARCH_V2_ENABLED` | `PublicLolPage` strangler boundary |
| `YORO_PUBLIC_PROFILE_V2_ENABLED` | profile/match history extraction |
| `YORO_PARTICIPATION_V2_ENABLED` | participation dashboard/public flows |
| `YORO_COMMUNITY_V2_ENABLED` | community feature boundary |
| `YORO_TOURNAMENT_V2_ENABLED` | tournament feature boundary |
| `YORO_API_V1_ENABLED` | server route adapter |
| `YORO_REPOSITORY_LAYER_ENABLED` | server repository interface |

## 8. 공통 Component 생성 순서

1. `Button`
2. `IconButton`
3. `Card`
4. `Panel`
5. `MetricCard`
6. `PageHeader`
7. `SectionHeader`
8. `EmptyState`
9. `LoadingState`
10. `ErrorState`
11. `Toast`
12. `Modal`
13. `Dropdown`
14. `Tabs`
15. `SegmentedControl`

생성 원칙:

- Design Token만 사용
- 44px touch target
- focus visible
- KR/JP text 구조
- page-specific variant 금지

## 9. Design Token 적용 순서

1. token inventory
2. root alias
3. color alias
4. spacing alias
5. radius alias
6. shadow alias
7. typography alias
8. motion alias
9. component token
10. page CSS migration
11. legacy selector cleanup

## 10. Page Migration Matrix

| Page | Start | Finish | Dependency | Risk |
|---|---|---|---|---|
| Dashboard | Sprint2 | Sprint3 | shared UI, layout flag | Medium |
| Overlay Manager | Sprint3 | Sprint3 | overlay contract, shared UI | High |
| Overlay Editor/Test | Sprint3 | Sprint3 | action test safety, flag | High |
| Public Search | Sprint4 | Sprint4 | API adapter, token alias | High |
| Profile/Match History | Sprint4 | Sprint4 | public search boundary | High |
| Streamer Detail | Sprint4 | Sprint5 | profile/community data | Medium |
| Participation | Sprint5 | Sprint5 | shared participation contract | High |
| Community | Sprint5 | Sprint5 | public API adapter | Medium |
| Tournament | Sprint5 | Sprint5 | tournament contract | Medium |
| Analytics | Sprint5 | Future | event taxonomy | Medium |
| Settings | Sprint5 | Future | shared form/card | Low |
| Admin Requests | Sprint5 | Future | role gate | Medium |

## 11. Definition of Ready

상세 기준은 `Definition-of-Ready.md`를 따른다.

요약:

- 요구 범위 명확
- 대상 파일 명확
- feature flag/adapter 여부 결정
- rollback 경로 결정
- QA baseline 존재
- 문서 업데이트 대상 확인

## 12. Definition of Done

상세 기준은 `Definition-of-Done-v2.md`를 따른다.

요약:

- scope 내 변경만 수행
- legacy fallback 유지
- QA Gate 통과
- Performance Rule 통과
- Accessibility Rule 통과
- i18n 검증 완료
- rollback 절차 문서화

## 13. QA Gate

상세 기준은 `QA-Gate.md`를 따른다.

각 Sprint 종료 조건:

- build/type/test/config
- responsive
- accessibility
- visual regression
- i18n
- performance
- smoke
- rollback

## 14. Release Gate

상세 기준은 `Release-Gate.md`를 따른다.

Production 배포 조건:

- Stage 검증
- feature flag default 확인
- Blue/Green 또는 허용된 Rolling
- rollback owner 지정
- monitoring 기준 설정

## 15. Visual Regression Rule

상세 기준은 `Visual-Regression-Rule.md`를 따른다.

기본 허용:

- layout shift 0
- text clipping 0
- overlay blank frame 0
- non-critical pixel diff <= 0.3%
- card/button 크기 변화는 명시 승인 필요

## 16. Performance Budget Rule

상세 기준은 `Performance-Rule.md`를 따른다.

기본 기준:

- Public LCP <= 2.5s
- Dashboard LCP <= 2.5s
- Overlay first frame <= 1.0s
- CLS <= 0.05
- INP <= 200ms
- initial JS gzip budget 준수
- CSS gzip budget 준수

## 17. Accessibility Rule

상세 기준은 `Accessibility-Rule.md`를 따른다.

필수:

- WCAG AA
- keyboard navigation
- focus visible
- screen reader label
- 44px touch target
- reduced motion 고려

## 18. i18n Rule

기준:

- KR/JP 동시 작성
- UI hardcoding 금지
- fallback은 `ko`
- key 누락 검증
- 날짜/시간/숫자 locale formatting
- Riot/Twitch/OBS 고유명사 보호

상세는 `.ai/I18N_RULES.md`를 따른다.

## 19. Rollback Rule

실패 시 절차:

1. rollout 중단
2. feature flag off
3. legacy fallback 확인
4. error/metric snapshot 저장
5. rollback branch 또는 revert PR 생성
6. stage smoke
7. production restore
8. incident note 작성
9. 재발 방지 작업 분리

## 20. Risk Register

상세 위험 목록은 `Risk-Register.md`를 따른다.

P0 위험:

- overlay blank frame
- auth/session regression
- participation queue corruption
- unsafe action path
- API 5xx 증가
- CSS cascade collapse
- public search conversion 하락

## 21. Master Checklist

Sprint1 시작 전 반드시 `Master-Checklist.md`의 100개 이상 항목을 체크한다.

