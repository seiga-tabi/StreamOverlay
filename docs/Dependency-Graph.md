# YORO.gg Refactor Dependency Graph

## 1. 현재 Frontend Dependency Graph

```mermaid
flowchart TD
  "apps/dashboard/src/main.tsx" --> "apps/dashboard/src/App.tsx"
  "apps/dashboard/src/App.tsx" --> "api/client.ts"
  "apps/dashboard/src/App.tsx" --> "api/socket.ts"
  "apps/dashboard/src/App.tsx" --> "components/Layout.tsx"
  "apps/dashboard/src/App.tsx" --> "components/LoginPage.tsx"
  "apps/dashboard/src/App.tsx" --> "pages/PublicLolPage.tsx"
  "apps/dashboard/src/App.tsx" --> "pages/DashboardPage.tsx"
  "apps/dashboard/src/App.tsx" --> "pages/OverlayOpsPage.tsx"
  "apps/dashboard/src/App.tsx" --> "pages/ParticipationPage.tsx"
  "apps/dashboard/src/App.tsx" --> "pages/TournamentsPage.tsx"
  "pages/DashboardPage.tsx" --> "components/StatusCard.tsx"
  "pages/DashboardPage.tsx" --> "components/EventLog.tsx"
  "pages/DashboardPage.tsx" --> "components/ActionTester.tsx"
  "pages/OverlayOpsPage.tsx" --> "components/OverlayClientStatusCard.tsx"
  "pages/OverlayOpsPage.tsx" --> "components/OverlayTestPanel.tsx"
  "pages/OverlayOpsPage.tsx" --> "components/RewardMappingPanel.tsx"
  "pages/OverlayOpsPage.tsx" --> "components/AlertAssetPanel.tsx"
  "pages/PublicLolPage.tsx" --> "api/client.ts"
  "pages/PublicLolPage.tsx" --> "components/ProfileLinkIcon.tsx"
  "api/client.ts" --> "runtime-config.ts"
```

## 2. 현재 Overlay Dependency Graph

```mermaid
flowchart TD
  "apps/overlay/src/main.tsx" --> "apps/overlay/src/App.tsx"
  "apps/overlay/src/App.tsx" --> "socket.ts"
  "apps/overlay/src/App.tsx" --> "overlays/EventOverlay.tsx"
  "apps/overlay/src/App.tsx" --> "overlays/ChatOverlay.tsx"
  "apps/overlay/src/App.tsx" --> "overlays/SubtitleOverlay.tsx"
  "apps/overlay/src/App.tsx" --> "overlays/QuestionOverlay.tsx"
  "apps/overlay/src/App.tsx" --> "overlays/MissionOverlay.tsx"
  "apps/overlay/src/App.tsx" --> "overlays/ParticipationOverlay.tsx"
  "apps/overlay/src/App.tsx" --> "overlays/SoloRankOverlay.tsx"
  "overlays/EventOverlay.tsx" --> "components/Banner.tsx"
  "overlays/SubtitleOverlay.tsx" --> "components/SubtitleBox.tsx"
  "socket.ts" --> "runtime-config.ts"
  "socket.ts" --> "@streamops/shared overlay contract"
```

## 3. 현재 Backend Dependency Graph

```mermaid
flowchart TD
  "apps/server/src/index.ts" --> "config.ts"
  "apps/server/src/index.ts" --> "routes/http-api.ts"
  "apps/server/src/index.ts" --> "services/store.ts"
  "apps/server/src/index.ts" --> "core/action-dispatcher.ts"
  "apps/server/src/index.ts" --> "services/overlay-hub.ts"
  "apps/server/src/index.ts" --> "services/dashboard-hub.ts"
  "apps/server/src/index.ts" --> "services/bridge-manager.ts"
  "apps/server/src/index.ts" --> "services/twitch-api.ts"
  "apps/server/src/index.ts" --> "services/riot-api.ts"
  "routes/http-api.ts" --> "services/store.ts"
  "routes/http-api.ts" --> "core/action-dispatcher.ts"
  "routes/http-api.ts" --> "services/riot-api.ts"
  "routes/http-api.ts" --> "services/data-dragon.ts"
  "routes/http-api.ts" --> "services/public-twitch-auth.ts"
  "core/action-dispatcher.ts" --> "services/bridge-manager.ts"
  "core/action-dispatcher.ts" --> "services/overlay-hub.ts"
  "core/action-dispatcher.ts" --> "services/store.ts"
  "core/action-dispatcher.ts" --> "@streamops/shared actions"
```

## 4. Target Dependency Direction

```mermaid
flowchart TD
  "app" --> "pages"
  "pages" --> "widgets"
  "widgets" --> "features"
  "features" --> "entities"
  "entities" --> "shared"
  "shared" --> "packages/shared"
```

금지 방향:

- `shared` -> `features`
- `features` -> 다른 `features`
- `entities` -> `widgets`
- `pages` -> server-specific implementation

## 5. 공통 Component 재작성 순서

| 순서 | Component/Module | 현재 위치 | 이유 |
|---:|---|---|---|
| 1 | API client adapter | `apps/dashboard/src/api/client.ts` | 모든 feature API의 기반 |
| 2 | Socket adapter | `apps/dashboard/src/api/socket.ts`, `apps/overlay/src/socket.ts` | dashboard/overlay 안정성 기반 |
| 3 | i18n adapter | `apps/dashboard/src/i18n.ts` | KR/JP copy 유지 기반 |
| 4 | Design token alias | `apps/dashboard/src/styles/index.css` | visual change 없는 token bridge |
| 5 | Layout/AppShell | `components/Layout.tsx` | navigation과 role gate 기반 |
| 6 | PageHeader | 신규 shared component 후보 | page title/CTA 통일 |
| 7 | Button | 신규 shared component 후보 | 클릭 영역/상태 통일 |
| 8 | Card/Panel | `StatusCard.tsx` 통합 후보 | dashboard/public card 통일 |
| 9 | MetricCard | `StatusCard.tsx` 확장 후보 | dashboard metric 통일 |
| 10 | Empty/Loading/Error State | 신규 shared pattern 후보 | QA와 accessibility 기반 |

## 6. Page Refactor Dependency

| Page | 선행 의존성 | 후행 가능 작업 |
|---|---|---|
| Dashboard | Layout, Card, MetricCard, API adapter | Today Broadcast widget |
| OverlayOps | API adapter, Overlay contract, Card, Button | Overlay Studio |
| Public Search | API adapter, i18n, token alias | Profile/Community/Tournament extraction |
| Participation | API adapter, shared participation contract | queue/store repository |
| Community | public API adapter, shared community contract | streamer community experience |
| Tournament | shared tournament contract, public API adapter | calendar/detail/manage split |
| Settings | Button/Card/PageHeader | low-risk cleanup |

## 7. Server Refactor Dependency

| 순서 | File | 선행 조건 | 이유 |
|---:|---|---|---|
| 1 | `packages/shared/src/*` | 없음 | API/WS contract 기준 |
| 2 | `apps/server/src/security/*` | route map | auth/rate limit middleware 분리 |
| 3 | `apps/server/src/routes/http-api.ts` | shared contract | API v1 adapter |
| 4 | `apps/server/src/services/store.ts` | repository interface 설계 | JSON legacy adapter |
| 5 | `apps/server/src/modules/*` | domain service | event-driven behavior 유지 |
| 6 | `apps/server/src/index.ts` | dependency modules 준비 | bootstrap DI 정리 |

