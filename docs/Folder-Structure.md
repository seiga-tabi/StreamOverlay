# YORO.gg Folder Structure v2

## 1. 현재 Folder Structure

```text
apps/
  bridge/
  dashboard/
    src/
      api/
      components/
      pages/
      styles/
      App.tsx
      i18n.ts
  overlay/
    src/
      components/
      overlays/
      styles/
      App.tsx
      socket.ts
  server/
    src/
      core/
      logging/
      modules/
      routes/
      scripts/
      security/
      services/
      index.ts
  tts-engine/
packages/
  shared/
```

## 2. 현재 구조상 집중 파일

| 파일 | 규모 | Migration 의미 |
|---|---:|---|
| `apps/dashboard/src/styles/index.css` | 23,732 lines | Design Token/layer 분리가 최우선 |
| `apps/dashboard/src/pages/PublicLolPage.tsx` | 9,337 lines | public feature strangler migration 필요 |
| `apps/server/src/routes/http-api.ts` | 5,197 lines | API namespace/controller 분리 필요 |
| `apps/overlay/src/styles/overlay.css` | 4,110 lines | overlay visual language와 OBS-safe style 분리 필요 |
| `apps/server/src/services/store.ts` | 1,987 lines | repository interface 도입 필요 |
| `packages/shared/src/actions.ts` | 1,136 lines | 안전 action contract의 기준 파일로 유지 |
| `packages/shared/src/overlay.ts` | 951 lines | overlay message contract의 기준 파일로 유지 |

## 3. Target Folder Structure

```text
apps/dashboard/src/
  app/
    App.tsx
    routes/
    providers/
    surfaces/
      PublicSurface.tsx
      MyYoroSurface.tsx
      StreamerStudioSurface.tsx
      AdminSurface.tsx
  pages/
    public/
    my-yoro/
    streamer-studio/
    admin/
  widgets/
    navigation/
    today-broadcast/
    streamer-discovery/
    overlay-preview/
    community-highlights/
  features/
    search/
    profile/
    streamer/
    participation/
    overlay-studio/
    community/
    tournament/
    analytics/
    settings/
    auth/
  entities/
    riot-profile/
    streamer/
    twitch-account/
    participation-entry/
    tournament/
    community-post/
    overlay-source/
  shared/
    api/
    config/
    i18n/
    lib/
    styles/
    ui/
```

```text
apps/overlay/src/
  app/
    OverlayApp.tsx
    OverlayProviders.tsx
    overlayMode.ts
  overlays/
    events/
    chat/
    subtitles/
    questions/
    mission/
    participation/
    solo-rank/
  features/
    overlay-socket/
    overlay-cache/
    overlay-preview/
    emergency/
  shared/
    styles/
    ui/
    lib/
```

```text
apps/server/src/
  app/
    createServer.ts
    dependencies.ts
  http/
    middleware/
    routes/
    controllers/
    presenters/
  ws/
    bridge/
    dashboard/
    overlay/
  domains/
    auth/
    twitch/
    lol/
    streamer/
    overlay/
    participation/
    community/
    tournament/
    analytics/
  modules/
  services/
  repositories/
    json/
    prisma/
    contracts/
  infrastructure/
    config/
    logger/
    filesystem/
    security/
```

```text
packages/shared/src/
  contracts/
    api/
    ws/
  schemas/
  domain/
  validators/
  utils/

packages/ui/src/
  tokens/
  primitives/
  components/
  patterns/
  css/
```

## 4. Dashboard Folder Migration Map

| 현재 | Target | 우선순위 |
|---|---|---:|
| `App.tsx` | `app/App.tsx`, `app/routes/*`, `app/providers/*` | 1 |
| `components/Layout.tsx` | `widgets/navigation/AppShell.tsx` | 1 |
| `api/client.ts` | `shared/api/httpClient.ts`, feature API modules | 1 |
| `api/socket.ts` | `shared/api/dashboardSocket.ts` | 2 |
| `i18n.ts` | `shared/i18n/*`, feature copy files | 2 |
| `pages/DashboardPage.tsx` | `pages/streamer-studio/TodayBroadcastPage.tsx` | 1 |
| `pages/PublicLolPage.tsx` | public pages + feature modules | 3 |
| `pages/ParticipationPage.tsx` | `features/participation/*` | 3 |
| `pages/TournamentsPage.tsx` | `features/tournament/*` | 4 |
| `pages/SoloRankPage.tsx` | `features/profile/solo-rank/*` | 4 |
| `components/Overlay*` | `features/overlay-studio/*` | 2 |
| `components/TwitchConnectionCard.tsx` | `features/twitch/connect/*` | 2 |
| `styles/index.css` | `shared/styles/*` + feature css | 1 |

## 5. Overlay Folder Migration Map

| 현재 | Target | 우선순위 |
|---|---|---:|
| `App.tsx` | `app/OverlayApp.tsx`, `features/overlay-socket/*` | 1 |
| `socket.ts` | `features/overlay-socket/client.ts` | 1 |
| `components/Banner.tsx` | `overlays/events/EventBanner.tsx` | 2 |
| `components/SubtitleBox.tsx` | `overlays/subtitles/SubtitleBox.tsx` | 2 |
| `overlays/ParticipationOverlay.tsx` | `overlays/participation/*` | 2 |
| `overlays/SoloRankOverlay.tsx` | `overlays/solo-rank/*` | 3 |
| `styles/overlay.css` | `shared/styles/tokens.css`, overlay-specific css | 1 |

## 6. Server Folder Migration Map

| 현재 | Target | 우선순위 |
|---|---|---:|
| `index.ts` | `app/createServer.ts`, `app/dependencies.ts` | 1 |
| `routes/http-api.ts` | `http/routes/*`, `http/controllers/*` | 2 |
| `security/auth.ts` | `http/middleware/auth.ts`, `domains/auth/*` | 2 |
| `security/rate-limit.ts` | `http/middleware/rateLimit.ts` | 2 |
| `services/store.ts` | `repositories/json/*`, `domains/*/repositories.ts` | 3 |
| `services/riot-api.ts` | `services/riot/RiotApiClient.ts` | 3 |
| `services/twitch-*` | `domains/twitch/*`, `services/twitch/*` | 3 |
| `services/overlay-hub.ts` | `ws/overlay/OverlayGateway.ts` | 2 |
| `services/dashboard-hub.ts` | `ws/dashboard/DashboardGateway.ts` | 2 |
| `services/bridge-manager.ts` | `ws/bridge/BridgeGateway.ts` | 2 |
| `modules/*` | 유지, domain service 의존으로 점진 변경 | 4 |

## 7. 파일 이동 규칙

1. 파일 이동 PR은 behavior change를 포함하지 않는다.
2. 이동한 파일은 import path만 정리한다.
3. rename과 refactor는 같은 PR에 섞지 않는다.
4. legacy export barrel을 두어 downstream import를 단계적으로 바꾼다.
5. CSS 파일 이동 시 visual token 값 변경을 동시에 하지 않는다.
6. API route 이동 시 기존 route와 target route를 동시에 테스트한다.

## 8. 삭제 후보

즉시 삭제하지 않고 deprecated 처리 후 사용량을 확인한다.

| 대상 | 이유 | 처리 |
|---|---|---|
| Public page 내부 중복 CTA block | 검색/커뮤니티/대회 CTA 중복 | feature별 CTA로 통합 |
| overlay dashboard channel hardcode | shared overlay channel과 불일치 | shared contract 참조로 대체 |
| page-level ad hoc card class | Design System과 충돌 | `Card`, `Panel`, `Metric`으로 통합 |
| direct `fetch` in public page | API contract 분산 | feature API client로 이동 |
| controller-level store mutation | backend boundary 위반 | domain service로 이동 |

