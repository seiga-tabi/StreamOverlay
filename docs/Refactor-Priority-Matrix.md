# YORO.gg Refactor Priority Matrix

## 1. 평가 기준

| 기준 | High | Medium | Low |
|---|---|---|---|
| Business Impact | North Star Loop와 매출/유지율에 직접 영향 | 특정 persona 효율 개선 | 보조 기능 |
| Risk | 방송/인증/데이터/API 회귀 가능성 높음 | UI/flow 회귀 가능성 | 문서/표시 중심 |
| Complexity | 대형 파일, 다수 API, 상태 복잡 | component/API 일부 결합 | 단일 component |
| User Frequency | 매일 또는 첫 방문마다 사용 | 주기적 사용 | 드문 운영 작업 |

우선순위 산정:

- P0: foundation, safety, zero downtime 필수
- P1: business impact와 user frequency가 높음
- P2: 중요하지만 의존성 이후 진행
- P3: 안정화 이후 진행
- P4: deprecated/removal/cleanup

## 2. Page Priority Matrix

| Page/Product Area | 현재 파일 | Business Impact | Risk | Complexity | User Frequency | Priority | 실행 Sprint |
|---|---|---|---|---|---|---|---|
| Index/Public Search | `PublicLolPage.tsx` | High | High | High | High | P1 | 4 |
| Profile/Match History | `PublicLolPage.tsx` | High | High | High | High | P1 | 4 |
| Rankings | `PublicLolPage.tsx` 내부/목표 IA | Medium | Medium | Medium | Medium | P2 | 4~5 |
| Streamers Discovery | `PublicLolPage.tsx` 내부/목표 IA | High | Medium | High | Medium | P1 | 4~5 |
| Streamer Detail | `PublicLolPage.tsx`, streamer data | High | Medium | High | Medium | P1 | 5 |
| Dashboard | `DashboardPage.tsx` | High | Medium | Medium | High | P1 | 2~3 |
| Analytics | `EventsPage.tsx`, status/action logs | Medium | Medium | Medium | Medium | P2 | 5~6 |
| Profile Card/My Riot | `MyRiotAccountPage.tsx`, `ProfileLinkIcon.tsx` | High | Medium | Medium | Medium | P2 | 5 |
| Overlay | `OverlayOpsPage.tsx`, `apps/overlay/src/App.tsx` | High | High | High | High | P1 | 3 |
| Overlay Manager | `OverlayClientStatusCard.tsx` | High | High | Medium | High | P1 | 3 |
| Overlay Editor | `OverlayTestPanel.tsx`, `AlertAssetPanel.tsx` | High | High | Medium | Medium | P1 | 3 |
| Settings | `SettingsPage.tsx`, `RiotApiKeyCard.tsx` | Medium | Medium | Low | Low | P3 | 5~6 |
| Login | `LoginPage.tsx`, auth APIs | High | High | Medium | High | P1 | 2 |
| Signup/Streamer 신청 | `PublicLolPage.tsx`, Riot request flow | High | Medium | Medium | Medium | P2 | 5 |
| Tournament | `TournamentsPage.tsx`, public tournament block | Medium | Medium | High | Medium | P2 | 5 |
| Community | `PublicLolPage.tsx`, community endpoints | High | Medium | High | Medium | P1 | 5 |
| Participation | `ParticipationPage.tsx`, public participation block | High | High | High | High | P1 | 5 |
| Followers | `FollowersPage.tsx` | Medium | Medium | Medium | Medium | P2 | 5 |
| Twitch Connection | `TwitchConnectionPage.tsx`, `TwitchConnectionCard.tsx` | High | High | Medium | Medium | P1 | 2~3 |
| Admin Requests | `StreamerRiotRequestsPage.tsx` | Medium | Medium | Medium | Low | P3 | 5 |

## 3. Feature Priority Matrix

| Feature | Business Impact | Risk | Complexity | User Frequency | Priority | 이유 |
|---|---|---|---|---|---|---|
| Design Token Alias | High | Medium | Medium | All | P0 | 모든 UI migration의 전제 |
| Feature Flag Infra | High | Low | Low | All | P0 | zero downtime 전제 |
| API Client Adapter | High | Medium | Medium | All | P0 | legacy/API v1 병행 전제 |
| Shared Layout | High | Medium | Medium | High | P0 | navigation/surface migration 전제 |
| Shared Button/Card/PageHeader | High | Low | Medium | High | P0 | UI 일관성 확보 |
| Dashboard Today Broadcast | High | Medium | Medium | High | P1 | streamer retention 핵심 |
| Overlay Studio | High | High | High | High | P1 | 방송 실패 리스크 직접 영향 |
| Public Search | High | High | High | High | P1 | guest conversion 시작점 |
| Profile/Match History | High | High | High | High | P1 | 검색 성공 경험의 핵심 |
| Participation | High | High | High | High | P1 | streamer-viewer 연결 핵심 |
| Community | High | Medium | High | Medium | P1 | North Star Loop 확장 |
| Tournament | Medium | Medium | High | Medium | P2 | community/participation 강화 |
| Analytics | Medium | Medium | Medium | Medium | P2 | KPI 운영에 필요 |
| Settings | Medium | Medium | Low | Low | P3 | 운영 보조 |
| Admin Tools | Medium | Medium | Medium | Low | P3 | 내부 운영 효율 |
| Repository Layer | High | High | High | All | P2 | DB migration 전제이나 UI 안정 후 진행 |
| Prisma Prep | Medium | High | High | Internal | P3 | 현재 Prisma 없음. repository 이후 |
| Deprecated Cleanup | Low | Medium | Medium | Internal | P4 | rollout 완료 후 진행 |

## 4. 우선순위 결론

1. P0: Feature Flag, API Adapter, Design Token Alias, Shared Layout/UI
2. P1: Dashboard, Overlay, Public Search, Profile, Participation, Community
3. P2: Tournament, Analytics, Repository Layer
4. P3: Settings, Admin, Prisma Prep
5. P4: Deprecated legacy cleanup

