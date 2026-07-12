# YORO.gg Architecture v2

## 1. 목적

Architecture v2는 YORO.gg를 `전적검색 사이트`가 아니라 `스트리머와 시청자가 함께 게임을 즐기는 플랫폼`으로 운영하기 위한 기술 구조이다. 기존 방송 안정성은 유지하면서 feature 중심 구조, Design System, API v1, Repository layer를 도입한다.

## 2. 현재 Architecture

```text
Twitch EventSub
  -> apps/server Twitch EventSub Client
  -> EventBus
  -> modules/*
  -> ActionDispatcher
  -> BridgeManager / TwitchChatService / OverlayHub
  -> apps/bridge -> OBS
  -> apps/overlay -> OBS Browser Source
```

현재 구조의 강점은 다음과 같다.

- OBS 위험 action이 `packages/shared/src/actions.ts` allowlist와 validator를 통과한다.
- bridge가 broadcast PC local OBS 제어를 분리한다.
- overlay message validation이 `packages/shared/src/overlay.ts`에 존재한다.
- Docker server 설정이 read-only, tmpfs, no-new-privileges 등 운영 안전성을 고려한다.

현재 구조의 한계는 다음과 같다.

- Dashboard app shell, role gate, page selection이 `App.tsx`와 `Layout.tsx`에 집중되어 있다.
- `PublicLolPage.tsx`가 9,000 lines 이상으로 public product 전체를 담고 있다.
- `http-api.ts`가 5,000 lines 이상으로 public, streamer, admin API를 모두 처리한다.
- 현재 server는 Express 기반이 아니라 native Node `http` handler와 `ws` upgrade handler 중심이다. 따라서 Express middleware/router 분석 대상은 `http-api.ts` 내부의 수동 routing, auth, CORS, rate limit, body parsing 로직이다.
- `Store`가 JSON persistence, domain mutation, query, state snapshot을 모두 담당한다.
- CSS가 token/layer 없이 누적되어 Design System migration 비용이 높다.
- API response contract가 shared package에 충분히 정리되어 있지 않다.
- Prisma가 현재 없으므로 DB 도입은 신규 architecture work로 다뤄야 한다.

## 3. Target Architecture

```text
apps/dashboard
  app        application bootstrap, router, providers
  pages      route-level composition
  widgets    cross-feature product blocks
  features   user-facing use cases
  entities   domain model UI and helpers
  shared     ui, api, styles, i18n, config

apps/overlay
  app        OBS source bootstrap, socket provider, mode routing
  overlays   rendered OBS scenes
  features   overlay message handling by domain
  shared     OBS-safe UI primitives, styles, socket

apps/server
  app             bootstrap and dependency wiring
  http            routes, controllers, middleware
  ws              dashboard, overlay, bridge gateway
  domains         participation, community, tournament, lol, twitch, overlay
  modules         event-driven bot modules
  services        external integrations and orchestration
  repositories    JSON and future Prisma repositories
  infrastructure  config, logger, filesystem, security

packages/shared
  contracts       API and WebSocket contracts
  schemas         validators
  domain          shared domain types
  utils           safe utility functions

packages/ui
  tokens
  primitives
  patterns
  product components
```

## 3.1 Express/HTTP Framework 방향

현재 프로젝트에는 Express dependency가 없다. Architecture v2는 즉시 Express 도입을 전제하지 않는다.

선택지는 두 가지다.

| 선택지 | 장점 | 위험 | 권장 |
|---|---|---|---|
| Native HTTP 유지 + internal router 분리 | dependency 증가 없음, 현재 운영 방식과 호환 | middleware 표준화 비용이 직접 발생 | 단기 권장 |
| Express 또는 유사 router 도입 | middleware, route group, test가 쉬움 | production auth/rate limit/WS upgrade 회귀 위험 | API v1 안정화 후 검토 |

결정 기준:

1. API v1 route table이 안정된 뒤 판단한다.
2. WebSocket upgrade path와 static serving path를 분리할 수 있어야 한다.
3. Express 도입 시에도 domain service와 repository layer는 framework-agnostic이어야 한다.
4. 도입 PR은 behavior change 없이 handler adapter부터 추가한다.

## 4. Frontend Layer Rule

| Layer | 역할 | Import 가능 |
|---|---|---|
| `app` | router, providers, auth surface, global error boundary | 모든 하위 layer |
| `pages` | route composition만 담당 | `widgets`, `features`, `entities`, `shared` |
| `widgets` | 여러 feature를 조합한 화면 블록 | `features`, `entities`, `shared` |
| `features` | 사용자 action 단위 | `entities`, `shared` |
| `entities` | Riot profile, streamer, participation entry 등 domain UI | `shared` |
| `shared` | ui primitive, api client, i18n, token | 외부 package만 |

금지 규칙:

- `shared`가 `features`를 import하지 않는다.
- `features`끼리 직접 import하지 않는다. 필요한 조합은 `widgets`에서 수행한다.
- `pages`에 API fetch와 복잡한 state machine을 두지 않는다.
- 새 CSS는 global page selector로 시작하지 않는다.

## 5. Backend Layer Rule

| Layer | 역할 |
|---|---|
| `app` | config load, dependency injection, server start |
| `http/middleware` | auth, csrf, cors, rate limit, body parsing |
| `http/routes` | endpoint registration |
| `http/controllers` | request/response mapping |
| `domains/*` | business rule, command/query service |
| `repositories/*` | persistence abstraction |
| `services/*` | Twitch, Riot, DataDragon, TTS, OBS bridge orchestration |
| `ws/*` | dashboard/overlay/bridge websocket gateway |
| `modules/*` | EventBus 기반 broadcast automation |
| `infrastructure/*` | logger, file, env, security utility |

금지 규칙:

- controller가 JSON file을 직접 읽고 쓰지 않는다.
- domain service가 `IncomingMessage`나 `ServerResponse`를 알지 않는다.
- repository가 HTTP status를 반환하지 않는다.
- unsafe action type은 shared schema 없이 추가하지 않는다.

## 6. API Architecture v2

API는 사용자 권한 기준으로 나눈다.

```text
/api/v1/public/*      guest-readable resources
/api/v1/me/*          logged-in viewer resources
/api/v1/streamer/*    streamer studio resources
/api/v1/admin/*       admin and operations resources
/api/v1/auth/*        auth/session flows
```

기존 `/api/*`는 adapter로 유지한다.

공통 response envelope:

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    detail?: unknown;
  };
  requestId: string;
};
```

## 7. Data Architecture v2

현재는 Prisma가 없고 JSON file store가 persistence 역할을 한다.

Target:

```text
Controller
  -> Domain Service
  -> Repository Interface
  -> JsonRepository | PrismaRepository
```

Prisma 도입 전 필수 조건:

1. domain별 repository interface가 존재한다.
2. JSON repository behavior test가 존재한다.
3. seed/export/import 전략이 존재한다.
4. migration rollback 전략이 존재한다.
5. relation/index 설계가 Product KPI query를 지원한다.

Prisma model 설계 원칙:

- model은 page 기준이 아니라 domain 기준으로 만든다.
- `StreamerProfile`을 product relationship의 중심 entity로 둔다.
- public search cache와 streamer-owned settings를 분리한다.
- participation/tournament/community는 streamer context를 반드시 가진다.
- overlay log는 broadcast troubleshooting을 위해 `streamerId`, `channel`, `createdAt` index를 가진다.
- analytics event는 KPI query를 위해 `surface`, `feature`, `createdAt` index를 가진다.

## 8. WebSocket Architecture

| Channel | 현재 | Target |
|---|---|---|
| `/bridge` | bridge auth 후 OBS command 전달 | 그대로 유지, message contract 강화 |
| `/ws/dashboard` | dashboard snapshot push | role별 snapshot channel 분리 |
| `/ws/overlay` | overlay channel별 message push | streamer/channel/mode contract 명확화 |

WebSocket message도 `packages/shared/contracts/ws`에 contract를 둔다.

## 9. Security Architecture

유지해야 할 원칙:

- viewer input은 shell/file/OBS arbitrary command로 이어지면 안 된다.
- OBS action은 allowlist와 validation을 통과해야 한다.
- streamer/admin 권한은 endpoint와 navigation 양쪽에서 중복 검증한다.
- overlay token은 URL fragment/hash 사용 정책을 유지하되 관리 UI에서 노출 통제를 강화한다.
- CSRF는 dashboard mutating request에 유지한다.
- rate limit은 public search, auth, participation, community write에 필수 적용한다.

## 10. Observability Architecture

Target event taxonomy:

- `guest.search.submitted`
- `guest.profile.loaded`
- `viewer.twitch.connected`
- `viewer.participation.joined`
- `streamer.broadcast.ready_checked`
- `streamer.overlay.source_copied`
- `streamer.participation.opened`
- `community.post.created`
- `tournament.registration.opened`
- `admin.action.tested`

각 event는 `actor`, `surface`, `feature`, `result`, `latencyMs`, `requestId`를 포함한다.

## 11. Architecture v2 완료 기준

1. feature별 owner와 import boundary가 문서화된다.
2. legacy route와 target route가 함께 동작한다.
3. Dashboard, Overlay, Public app이 같은 Design Token을 참조한다.
4. shared package에 API/WS contract가 추가된다.
5. Store 직접 호출이 controller에서 제거된다.
6. Prisma 도입 여부와 무관하게 repository swap이 가능해진다.
