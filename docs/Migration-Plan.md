# YORO.gg Migration Plan v1

## 0. 문서 목적

이 문서는 현재 `StreamOverlay` 저장소를 YORO.gg Product Constitution, Design System Constitution, IA v3, Navigation Constitution, Dashboard/Overlay/Community Philosophy 기준으로 단계적으로 이전하기 위한 공식 Migration Plan이다.

이번 문서는 설계 문서이며, 코드 변경 지시가 아니다. 실제 이전은 작은 PR 단위로 수행한다.

## 1. Migration 원칙

1. 한 번에 갈아엎지 않는다.
2. 기존 방송 운영 안정성을 우선한다.
3. 기존 URL, WebSocket, overlay source URL은 호환 계층을 둔다.
4. 화면보다 feature boundary를 먼저 세운다.
5. CSS는 Design Token → layer → component → page 순서로 이전한다.
6. DB는 현재 JSON `Store`를 즉시 제거하지 않고 Repository interface를 먼저 둔다.
7. API는 기존 `/api/*`를 유지하면서 `/api/v1/*`를 병행한다.
8. Dashboard는 관리 페이지가 아니라 `오늘 방송 운영` workflow로 재편한다.
9. Overlay는 설정 화면이 아니라 OBS Browser Source 운용 흐름으로 재편한다.
10. Community는 게시판이 아니라 streamer community experience로 재편한다.

## 2. Current Architecture 요약

| 영역 | 현재 구조 | 핵심 문제 |
|---|---|---|
| Monorepo | `apps/*`, `packages/*` npm workspaces | workspace 자체는 적절하지만 feature/package 경계가 약함 |
| Dashboard | `apps/dashboard/src/App.tsx`, `components/Layout.tsx`, `pages/*` | router, auth surface, role gate, page switch가 app component에 집중됨 |
| Public | `PublicLolPage.tsx` 단일 대형 파일 | 검색, 프로필, 커뮤니티, 대회, 참여, 로컬 상태가 한 파일에 결합됨 |
| CSS | `apps/dashboard/src/styles/index.css` 23,732 lines | token/layer/component/page 구분 없이 누적됨 |
| Overlay | `apps/overlay/src/App.tsx`, `overlays/*`, `styles/overlay.css` | mode/channel, cache, socket, render orchestration이 app에 집중됨 |
| Server | `apps/server/src/index.ts`, `routes/http-api.ts` | bootstrap, route, auth, public/admin/streamer API가 거대 파일에 집중됨 |
| Express | 현재 dependency와 server bootstrap에서 확인되지 않음 | native Node `http` handler가 Express router/middleware 역할까지 수행함 |
| Store | `apps/server/src/services/store.ts` JSON file store | persistence, query, mutation, domain rule이 한 class에 집중됨 |
| Shared | `packages/shared/src/*` | action/overlay validation은 강점이나 API response contract는 부족함 |
| Bridge | `apps/bridge/src/*` | 역할은 명확함. OBS command allowlist 유지 필요 |
| Docker | `docker-compose*.yml`, server read-only 설정 | 운영 안정성은 좋으나 app별 build/deploy boundary 명확화 필요 |
| Prisma | 현재 `schema.prisma` 없음 | DB migration은 신규 도입 계획으로 다뤄야 함 |

### 2.1 Current Architecture 세부 분석

| 항목 | 현재 확인 내용 | Migration 판단 |
|---|---|---|
| React | React 18 + Vite 기반 dashboard/overlay app | 유지하되 app/page/feature boundary를 만든다 |
| TypeScript | workspace 공통 `tsconfig.base.json`, app/package별 `tsconfig` | shared contract를 늘려 client/server type drift를 줄인다 |
| Router | React Router 없이 `App.tsx` page state와 path/surface 분기 | route definition을 data-driven 구조로 이전한다 |
| Hook | page 내부 `useState`, `useEffect`, `useMemo` 중심 | feature hook과 API hook으로 분리한다 |
| Context | 명시적 global context보다 prop/state 전달 중심 | auth, locale, surface, socket provider만 제한적으로 도입한다 |
| Store | server JSON `Store` class가 여러 domain state를 소유 | repository interface 뒤로 감춘다 |
| API Client | dashboard `apiGet/apiPost`, public page direct `fetch` 혼재 | shared HTTP client + feature API module로 정리한다 |
| CSS | dashboard/overlay 대형 global CSS | token/layer/component/page CSS로 분리한다 |
| Dependency | React, Vite, ws, obs-websocket-js, dotenv 중심 | 새 dependency는 governance 승인 후 추가한다 |
| Docker | server, tts-engine, voicevox, cloudflared optional | app별 runtime 책임과 env contract를 문서화한다 |

## 3. Target Architecture 요약

최종 구조는 `apps`와 `packages`를 유지하되, 각 app 내부를 feature-oriented architecture로 이전한다.

```text
apps/
  dashboard/
    src/
      app/
      pages/
      widgets/
      features/
      entities/
      shared/
  overlay/
    src/
      app/
      overlays/
      features/
      shared/
  server/
    src/
      app/
      http/
      ws/
      modules/
      domains/
      services/
      repositories/
      infrastructure/
  bridge/
  tts-engine/
packages/
  shared/
  ui/
  config/
```

## 4. 단계별 Migration

| Phase | 목표 | 주요 작업 | 위험도 | 완료 기준 |
|---|---|---|---|---|
| Phase 0 | 기준선 고정 | 문서, route map, CSS inventory, API inventory 작성 | 낮음 | 모든 현행 endpoint/page/component 목록화 |
| Phase 1 | 구조 경계 생성 | `app/pages/widgets/features/entities/shared` 폴더 추가, legacy wrapper 유지 | 낮음 | import boundary rule 문서화, 동작 변화 없음 |
| Phase 2 | Design Token 도입 | CSS variables token layer 추가, 기존 CSS에 alias 연결 | 중간 | 기존 화면 visual diff 허용 범위 내 유지 |
| Phase 3 | Dashboard 재편 | `오늘 방송 운영` 중심 dashboard widget/feature 추출 | 중간 | 기존 admin/streamer 권한 동작 유지 |
| Phase 4 | Public 분해 | `PublicLolPage`를 Search/Profile/Community/Tournament/Participation feature로 분리 | 높음 | URL과 검색/참여/커뮤니티 플로우 회귀 없음 |
| Phase 5 | Overlay Studio 재편 | OBS source 생성, preview, test, copy flow 분리 | 높음 | 기존 OBS URL, overlay auth, reconnect 유지 |
| Phase 6 | API v1 병행 | public/me/streamer/admin namespace 도입 | 중간 | 기존 `/api/*` adapter와 `/api/v1/*` 병행 |
| Phase 7 | Repository/DB 준비 | JSON store 뒤에 repository interface 도입, Prisma 설계 | 높음 | Store behavior test 후 Prisma migration 가능 |

## 5. Folder Migration

| 현재 | 새 위치 | 방식 |
|---|---|---|
| `apps/dashboard/src/App.tsx` | `apps/dashboard/src/app/App.tsx`, `app/routes/*` | route/surface/auth provider로 분해 |
| `apps/dashboard/src/components/Layout.tsx` | `widgets/navigation/AppShell.tsx` | public/my-yoro/streamer/admin shell로 분리 |
| `apps/dashboard/src/pages/PublicLolPage.tsx` | `pages/public/*`, `features/search/*`, `features/community/*` | strangler 방식, 기존 export 유지 |
| `apps/dashboard/src/api/client.ts` | `shared/api/httpClient.ts`, `features/*/api.ts` | generic client와 feature API 분리 |
| `apps/dashboard/src/api/socket.ts` | `shared/api/dashboardSocket.ts` | typed message contract 추가 |
| `apps/dashboard/src/styles/index.css` | `shared/styles/tokens.css`, `shared/styles/base.css`, `features/*/*.css` | token alias 후 점진 분리 |
| `apps/overlay/src/App.tsx` | `overlay/src/app/OverlayApp.tsx` | socket/provider/state reducer 분리 |
| `apps/overlay/src/styles/overlay.css` | `shared/styles/tokens.css`, `overlays/*/*.css` | OBS-safe visual token 분리 |
| `apps/server/src/routes/http-api.ts` | `http/routes/*`, `http/controllers/*` | endpoint group별 router로 분리 |
| `apps/server/src/services/store.ts` | `repositories/json/*`, `domains/*/services/*` | repository interface 뒤로 이동 |

## 6. Component Migration

| 현재 Component | Target Component | 처리 |
|---|---|---|
| `StatusCard` | `MetricCard`, `StatusPanel` | 통합 |
| `EventSubStatusCard` | `TwitchConnectionStatus` | feature component로 이동 |
| `OverlayClientStatusCard` | `OverlaySourceList`, `OverlayPreviewGrid`, `OverlayConnectionStatus` | 분리 |
| `TwitchConnectionCard` | `TwitchConnectPanel` | 재사용, copy/CTA token 정리 |
| `ActionTester` | `OverlayTestActionPanel` | admin-only feature로 이동 |
| `OverlayTestPanel` | `OverlayTestSuite` | payload preset과 UI 분리 |
| `RewardMappingPanel` | `RewardActionMappingTable` | read-only admin widget |
| `AlertAssetPanel` | `AlertAssetManager` | upload/API 로직 분리 |
| `LoginPage` | `AuthEntry`, `AdminLogin`, `StreamerLogin` | surface별 분리 |
| `PublicLolPage` 내부 component | `SearchHero`, `SummonerProfile`, `MatchHistory`, `StreamerDiscovery`, `CommunityFeed`, `TournamentCalendar` | 단계적 추출 |
| Overlay `Banner` | `EventBanner`, `MediaBanner`, `SpeechBanner` | behavior 분리 |
| Overlay `ParticipationOverlay` | `QueueOverlay`, `SelectedPlayersOverlay`, `TeamOverlay` | mode별 분리 |

## 7. CSS Migration 순서

1. 현행 CSS 값을 inventory로 고정한다.
2. Design System Constitution 기준 token 이름을 확정한다.
3. `:root` token을 추가하되 기존 class 값은 alias로 연결한다.
4. reset/base/typography/layout/component/page layer를 분리한다.
5. 새 component는 token만 사용하도록 제한한다.
6. 기존 CSS는 page migration 시 삭제하거나 deprecated section으로 이동한다.
7. `!important`는 예외 사유가 있는 경우만 남긴다.
8. overlay CSS는 OBS Browser Source 안전성을 기준으로 별도 token subset을 둔다.

## 8. Page Migration 우선순위

| 우선순위 | Page | 이유 |
|---:|---|---|
| 1 | Dashboard | 제품 철학상 `오늘 방송 운영`의 중심이며 streamer retention에 직접 영향 |
| 2 | Overlay | OBS 연결 실패가 방송 리스크로 직결됨 |
| 3 | Public Search/Profile | 신규 유저 첫 경험이자 North Star Loop 시작점 |
| 4 | Participation | streamer-viewer 연결의 핵심 전환 기능 |
| 5 | Community | 게시판에서 streamer community experience로 전환 필요 |
| 6 | Tournament | community/participation과 연결된 growth 기능 |
| 7 | Analytics | migration 이후 event taxonomy가 안정된 뒤 재설계 |
| 8 | Settings/Admin | 운영 도구이므로 안정성 우선, 화면 개편은 후순위 |

## 9. Feature Migration

| Feature | 현재 위치 | Target boundary | 비고 |
|---|---|---|---|
| Search | `PublicLolPage`, server LoL endpoints | `features/search`, `domains/lol` | Riot/DataDragon cache 포함 |
| Profile | `PublicLolPage`, `MyRiotAccountPage`, `SoloRankPage` | `entities/riot-profile`, `features/profile` | public/my/streamer profile 분리 |
| Streamer | public Twitch auth, follower, requests | `features/streamer-discovery`, `domains/streamer` | KR/JP streamer profile contract 필요 |
| Overlay | dashboard overlay cards, overlay app | `features/overlay-studio`, `overlay/features/*` | OBS URL flow 우선 |
| Participation | public page, dashboard page, modules | `features/participation`, `domains/participation` | queue state contract 강화 |
| Tournament | public/dashboard tournament | `features/tournament`, `domains/tournament` | slug/public detail 분리 |
| Community | public page/server store | `features/community`, `domains/community` | streamer context 필수화 |
| Analytics | status/events/actions logs | `features/analytics`, `domains/telemetry` | event taxonomy 선행 |
| Settings | scattered cards | `features/settings` | role별 노출 정책 필요 |

## 10. API Migration

| 현재 Endpoint | Target Endpoint | 원칙 |
|---|---|---|
| `/api/lol/profile` | `/api/v1/public/lol/profile` | guest-safe read API |
| `/api/lol/matches` | `/api/v1/public/lol/matches` | pagination contract 명확화 |
| `/api/public/twitch/status` | `/api/v1/me/twitch/status` | viewer session API |
| `/api/public/participation/*` | `/api/v1/public/participation/*` + `/api/v1/me/participation/*` | guest/viewer action 분리 |
| `/api/public/community/posts` | `/api/v1/public/community/posts` | public read와 authenticated write 분리 |
| `/api/tournaments` | `/api/v1/streamer/tournaments` | streamer-owned resource |
| `/api/participation/*` | `/api/v1/streamer/participation/*` | broadcast operation API |
| `/api/overlay/status` | `/api/v1/streamer/overlay/status` | OBS/overlay studio API |
| `/api/actions/test` | `/api/v1/admin/actions/test` | admin-only, allowlist 유지 |
| `/api/dashboard/auth/*` | `/api/v1/auth/dashboard/*` | auth surface 명시 |

API v1 도입 시 기존 endpoint는 최소 2개 release 동안 adapter로 유지한다.

API Migration 규칙:

| 항목 | 규칙 |
|---|---|
| Endpoint | `/api/v1/public`, `/api/v1/me`, `/api/v1/streamer`, `/api/v1/admin`, `/api/v1/auth` 중 하나에 속해야 한다 |
| Response | `ok`, `data` 또는 `error`, `requestId`를 가진 envelope로 표준화한다 |
| Error | domain별 error code를 정의하고 user-facing message는 KR/JP copy 구조를 따른다 |
| Permission | endpoint별 Guest/User/Streamer/Admin matrix를 둔다 |
| Version | breaking change는 새 version 또는 deprecated 기간을 둔다 |
| Legacy | 기존 `/api/*`는 adapter로 유지하고 즉시 삭제하지 않는다 |
| Middleware | auth, csrf, rate limit, body limit, CORS 적용 여부를 route table에 명시한다 |

## 11. Database Migration

현재 저장소에는 Prisma 스키마가 없다. 따라서 DB migration은 `JSON Store → Repository Interface → Prisma Schema → Dual Read/Write → Cutover` 순서로 진행한다.

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| DB-0 | 현재 JSON 파일 구조와 key를 inventory화 | state file별 owner 정의 |
| DB-1 | domain별 repository interface 작성 | Store 직접 호출 감소 |
| DB-2 | Prisma model draft 작성 | relation/index/unique constraint 리뷰 |
| DB-3 | seed/export/import script 설계 | JSON → DB 재현 가능 |
| DB-4 | dual write behind feature flag | JSON과 DB checksum 비교 |
| DB-5 | read cutover | 주요 flow DB read 전환 |
| DB-6 | JSON fallback 보존 | rollback 가능 상태 유지 |

### 11.1 Prisma Model 후보

| Domain | 후보 Model | 주요 Relation |
|---|---|---|
| Auth/User | `User`, `Session`, `TwitchAccount` | User 1:N Session, User 1:1 TwitchAccount |
| Streamer | `StreamerProfile`, `StreamerLink`, `StreamerRiotAccount` | StreamerProfile 1:N Link, 1:1 RiotAccount |
| Riot/Profile | `RiotProfile`, `LolMatchCache`, `LolRankHistory` | RiotProfile 1:N MatchCache, 1:N RankHistory |
| Participation | `ParticipationRoom`, `ParticipationEntry`, `ParticipationInvite` | Room 1:N Entry, Entry 1:N Invite |
| Overlay | `OverlaySource`, `OverlayMessageLog`, `AlertAsset` | StreamerProfile 1:N OverlaySource/Log/Asset |
| Community | `CommunityPost`, `CommunityComment`, `CommunityReaction` | Post 1:N Comment/Reaction |
| Tournament | `Tournament`, `TournamentRegistration` | Tournament 1:N Registration |
| Analytics | `EventLog`, `ActionLog`, `ProductEvent` | actor/surface/feature 기준 log |
| Settings | `RewardMapping`, `StreamerSetting`, `SystemSetting` | streamer-owned setting과 admin setting 분리 |

### 11.2 Index 후보

| Model | Index/Unique 후보 | 이유 |
|---|---|---|
| `TwitchAccount` | `twitchUserId unique`, `login index` | login/session/follower lookup |
| `StreamerProfile` | `slug unique`, `twitchUserId unique` | public streamer route와 overlay URL |
| `RiotProfile` | `normalizedRiotId index`, `puuid unique` | search/profile cache |
| `ParticipationEntry` | `(roomId, status, createdAt)` | queue ordering |
| `CommunityPost` | `(streamerId, category, createdAt)` | community feed |
| `Tournament` | `slug unique`, `(streamerId, startsAt)` | public detail/calendar |
| `OverlayMessageLog` | `(streamerId, channel, createdAt)` | overlay status/recent messages |
| `ProductEvent` | `(surface, feature, createdAt)` | KPI query |

### 11.3 Seed/Migration 기준

1. JSON state export를 seed source로 사용한다.
2. seed는 idempotent하게 작성한다.
3. migration 전후 row count와 checksum을 비교한다.
4. production cutover 전 staging에서 JSON backup restore rehearsal을 진행한다.
5. Prisma migration은 expand/contract 방식으로만 진행한다.

## 12. Rollback 요약

1. UI migration은 feature flag 또는 legacy component export로 되돌린다.
2. API migration은 `/api/*` adapter를 유지해 client rollback이 가능해야 한다.
3. CSS migration은 token alias를 유지해 값 변경 rollback을 단일 파일로 제한한다.
4. DB migration은 dual write 기간 전에는 schema만 추가하고 destructive migration 금지.
5. Overlay migration은 기존 OBS URL을 절대 즉시 제거하지 않는다.

## 13. Sprint 요약

| Sprint | 목표 |
|---|---|
| Sprint 1 | inventory, target folder, token naming, API map 작성 |
| Sprint 2 | Dashboard shell/provider/router 경계 구축 |
| Sprint 3 | Public Search/Profile strangler migration |
| Sprint 4 | Overlay Studio와 overlay app boundary 구축 |
| Sprint 5 | Community/Participation/Tournament/API v1/Repository 준비 |

상세 Sprint 계획은 `Sprint-Plan.md`를 기준으로 한다.

## 14. Migration 완료 기준

1. 기존 public URL, dashboard URL, overlay URL이 유지된다.
2. streamer가 방송 준비를 기존보다 더 오래 걸리지 않는다.
3. guest가 검색 → 스트리머 발견 → 참여 또는 커뮤니티로 이동하는 흐름이 끊기지 않는다.
4. admin 기능은 streamer surface에 노출되지 않는다.
5. 새 component/CSS/API/hook은 Architecture Governance를 통과한다.
6. `npm run build`, `npm run validate:config`, `npm test`를 목표 기준으로 유지한다.
