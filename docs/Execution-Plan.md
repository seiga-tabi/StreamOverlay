# YORO.gg Refactor Execution Plan v1

## 1. 목적

이 문서는 YORO.gg 리팩토링을 실제 코드 작업 순서로 쪼개기 위한 실행 계획이다. 목표는 Zero Downtime Refactor이며, 기존 서비스가 항상 동작하는 상태를 유지한다.

원칙:

- Big Bang Refactor 금지
- 작은 PR, 작은 merge, 작은 rollout
- Feature Flag, Adapter, Compatibility Layer 우선
- 기존 URL, API, OBS overlay URL 유지
- Product Constitution, Design System, Architecture v2, Migration Plan과 충돌 금지

## 2. 전체 Execution Order

```text
Sprint 0
  기준선 고정
  -> 측정/테스트/문서 inventory

Sprint 1
  shared contract
  -> feature flag infra
  -> design token alias
  -> legacy compatibility shell

Sprint 2
  dashboard app shell
  -> navigation data
  -> shared layout
  -> shared button/card/page header

Sprint 3
  dashboard today broadcast
  -> overlay studio boundary
  -> streamer studio role gate

Sprint 4
  public search strangler
  -> profile/match history extraction
  -> public API adapter

Sprint 5
  participation/community/tournament feature extraction
  -> API v1 adapter
  -> repository interface

Sprint 6
  store/repository migration prep
  -> performance cleanup
  -> deprecated removal
```

## 3. Sprint별 실제 작업 순서

### Sprint 0: Baseline Lock

목표: 수정 전 기준선을 고정한다.

작업 순서:

1. `npm run build`
2. `npm run validate:config`
3. `npm test`
4. bundle size baseline 기록
5. dashboard/public/overlay screenshot baseline 기록
6. current route/API/WS map 확정

코드 변경 성격: 없음 또는 측정 스크립트만 별도 PR

### Sprint 1: Foundation Without Behavior Change

목표: 기존 동작을 바꾸지 않고 새 구조를 받을 기반을 만든다.

작업 순서:

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

작업 내용:

- shared contract export 정리
- feature flag 읽기 규칙 정의
- API client adapter 추가
- token alias만 추가하고 visual 값 변경 금지
- legacy CSS import order 유지

### Sprint 2: Dashboard Shell and Shared UI

목표: Dashboard를 새 shell로 감싸되 기존 page component는 유지한다.

작업 순서:

1. `apps/dashboard/src/components/Layout.tsx`
2. `apps/dashboard/src/App.tsx`
3. `apps/dashboard/src/components/StatusCard.tsx`
4. `apps/dashboard/src/components/EventLog.tsx`
5. `apps/dashboard/src/pages/DashboardPage.tsx`
6. `apps/dashboard/src/components/LoginPage.tsx`
7. `apps/dashboard/src/pages/TwitchConnectionPage.tsx`
8. `apps/dashboard/src/pages/SettingsPage.tsx`

작업 내용:

- navigation data 분리
- role gate adapter 유지
- shared `PageHeader`, `Card`, `MetricCard`, `Button` 도입
- 기존 page rendering fallback 유지

### Sprint 3: Streamer Studio and Overlay Studio

목표: 방송 운영 핵심인 Dashboard/Overlay를 먼저 안정화한다.

작업 순서:

1. `apps/dashboard/src/pages/DashboardPage.tsx`
2. `apps/dashboard/src/pages/OverlayOpsPage.tsx`
3. `apps/dashboard/src/components/OverlayClientStatusCard.tsx`
4. `apps/dashboard/src/components/OverlayTestPanel.tsx`
5. `apps/dashboard/src/components/RewardMappingPanel.tsx`
6. `apps/dashboard/src/components/AlertAssetPanel.tsx`
7. `apps/overlay/src/App.tsx`
8. `apps/overlay/src/socket.ts`
9. `apps/overlay/src/components/Banner.tsx`
10. `apps/overlay/src/overlays/EventOverlay.tsx`
11. `apps/overlay/src/overlays/ParticipationOverlay.tsx`
12. `apps/overlay/src/overlays/SoloRankOverlay.tsx`

작업 내용:

- `Today Broadcast` widget 경계 생성
- `Overlay Studio` 내부 adapter 도입
- `DASHBOARD_OVERLAY_CHANNELS`를 shared `OVERLAY_CHANNELS`와 호환
- OBS URL generation compatibility 유지
- overlay blank frame 방지 검증

### Sprint 4: Public Search and Profile

목표: 가장 큰 파일인 `PublicLolPage.tsx`를 strangler 방식으로 분리한다.

작업 순서:

1. `apps/dashboard/src/pages/PublicLolPage.tsx`
2. `apps/dashboard/src/api/client.ts`
3. `apps/dashboard/src/components/ProfileLinkIcon.tsx`
4. `packages/shared/src/participation.ts`
5. `packages/shared/src/community.ts`
6. `packages/shared/src/tournament.ts`
7. `apps/server/src/routes/http-api.ts`
8. `apps/server/src/services/riot-api.ts`
9. `apps/server/src/services/data-dragon.ts`
10. `apps/server/src/services/lol-profile-store.ts`

작업 내용:

- public search API adapter 생성
- recent search/favorite storage adapter 분리
- search input/result를 먼저 추출
- profile summary와 match history를 다음 PR로 추출
- 기존 `PublicLolPage`를 fallback wrapper로 유지

### Sprint 5: Participation, Community, Tournament, API v1

목표: streamer-viewer loop의 핵심 기능을 feature boundary로 분리한다.

작업 순서:

1. `apps/dashboard/src/pages/ParticipationPage.tsx`
2. `apps/dashboard/src/pages/TournamentsPage.tsx`
3. `apps/dashboard/src/pages/StreamerRiotRequestsPage.tsx`
4. `apps/dashboard/src/pages/FollowersPage.tsx`
5. `apps/dashboard/src/pages/MyRiotAccountPage.tsx`
6. `apps/dashboard/src/pages/SoloRankPage.tsx`
7. `apps/server/src/routes/http-api.ts`
8. `apps/server/src/modules/participation.module.ts`
9. `apps/server/src/modules/lol-profile-enrichment.module.ts`
10. `apps/server/src/modules/lol-game-monitor.module.ts`
11. `apps/server/src/services/store.ts`
12. `packages/shared/src/community.ts`
13. `packages/shared/src/tournament.ts`

작업 내용:

- participation domain service 후보 분리
- community post/comment contract 분리
- tournament public/streamer route adapter
- `/api/v1/*` adapter 추가
- legacy `/api/*` 유지

### Sprint 6: Repository, Performance, Deprecation

목표: Store 직접 접근을 줄이고, deprecated layer를 제거할 준비를 한다.

작업 순서:

1. `apps/server/src/services/store.ts`
2. `apps/server/src/routes/http-api.ts`
3. `apps/server/src/index.ts`
4. `apps/server/src/services/overlay-hub.ts`
5. `apps/server/src/services/dashboard-hub.ts`
6. `apps/server/src/services/bridge-manager.ts`
7. `apps/server/src/core/action-dispatcher.ts`
8. `apps/dashboard/src/styles/index.css`
9. `apps/overlay/src/styles/overlay.css`

작업 내용:

- repository interface 도입
- JSON repository adapter 유지
- performance cleanup
- deprecated CSS/component 제거는 100% rollout 후 진행

## 4. PR 크기 기준

| PR 유형 | 최대 범위 |
|---|---|
| shared contract | domain 하나 |
| CSS token | token group 하나 |
| shared component | component 1~3개 |
| page refactor | page 하나의 section 하나 |
| API adapter | endpoint group 하나 |
| store abstraction | repository 하나 |
| overlay runtime | channel/mode 하나 |

## 5. 변경 금지 조합

- 파일 이동 + behavior change
- CSS token + visual redesign
- API namespace + auth policy 변경
- Store abstraction + Prisma 도입
- overlay visual + socket protocol 변경
- navigation IA 변경 + page content refactor

## 6. Execution 완료 기준

1. 모든 Sprint가 feature flag 또는 adapter로 rollback 가능하다.
2. 기존 public/dashboard/overlay route가 유지된다.
3. OBS Browser Source URL이 유지된다.
4. legacy API와 API v1이 병행된다.
5. deprecated code 제거는 100% rollout 이후 별도 PR로만 한다.

## 7. Documentation Update Plan

리팩토링 중 문서는 코드 변경과 같은 PR 또는 바로 다음 문서 PR에서 업데이트한다.

| 변경 유형 | 업데이트 문서 | 업데이트 시점 |
|---|---|---|
| shared component 추가 | `Design-System-Constitution.md`, `Architecture-Governance.md` | component PR 내 |
| token/layer 변경 | `Design-System-Constitution.md`, `Performance-Budget.md` | CSS PR 내 |
| route/navigation 변경 | `Navigation-Constitution.md`, `Architecture-v2.md` | route PR 내 |
| API v1 추가 | `Architecture-v2.md`, `Migration-Plan.md`, `Refactor-Acceptance.md` | API PR 내 |
| feature flag 추가 | `Feature-Flag-Plan.md`, `Rollout-Strategy.md` | flag PR 내 |
| QA 기준 변경 | `QA-Checkpoint.md`, `Definition-of-Done.md` | Sprint 종료 전 |
| release/rollout 변경 | `Release-Strategy.md`, `Rollout-Strategy.md` | release 전 |
| repository/store 변경 | `Architecture-v2.md`, `Rollback-Plan.md`, `Risk-Analysis.md` | repository PR 내 |
| deprecated 제거 | `Architecture-Governance.md`, `Execution-Plan.md` | cleanup PR 내 |

문서 업데이트 금지 사항:

- 구현과 다른 이상적인 구조만 문서에 적지 않는다.
- 아직 rollout되지 않은 기능을 완료된 구조로 표시하지 않는다.
- legacy fallback이 남아 있으면 deprecated 상태와 제거 조건을 함께 적는다.

## 8. Final Refactor Roadmap

최종 완료 순서는 다음과 같다.

| 단계 | 완료 목표 | Legacy 상태 |
|---:|---|---|
| 1 | baseline, QA, performance budget 고정 | 모두 유지 |
| 2 | feature flag와 adapter 기반 구축 | 모두 유지 |
| 3 | design token alias와 shared UI 도입 | legacy CSS 유지 |
| 4 | dashboard shell과 navigation role gate 정리 | legacy page 유지 |
| 5 | Today Broadcast dashboard 전환 | legacy dashboard fallback |
| 6 | Overlay Studio와 overlay runtime boundary 정리 | 기존 OBS URL 유지 |
| 7 | Public Search strangler 적용 | `PublicLolPage` fallback |
| 8 | Profile/Match History 분리 | legacy section fallback |
| 9 | Participation/Community/Tournament feature 분리 | legacy endpoint 유지 |
| 10 | API v1 adapter production rollout | `/api/*` 유지 |
| 11 | Repository interface와 JSON adapter 도입 | `Store` fallback |
| 12 | performance cleanup과 deprecated usage 제거 준비 | legacy 호출 감시 |
| 13 | 100% rollout 후 deprecated component/CSS/API 제거 | rollback 승인 후 삭제 |
| 14 | Prisma/DB migration 검토 | 별도 roadmap |

리팩토링 완료 정의:

- public search, streamer dashboard, overlay, participation, community가 feature boundary 안에서 운영된다.
- API v1과 shared contract가 source of truth가 된다.
- dashboard/overlay/public CSS가 token/layer 규칙을 따른다.
- legacy fallback 호출량이 제거 기준 이하가 된다.
- release manager가 cleanup release를 승인한다.
