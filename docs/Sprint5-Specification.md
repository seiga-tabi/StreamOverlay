# YORO.gg Sprint5 Specification

## 1. Sprint 목표

Sprint5는 Participation, Community, Tournament를 feature boundary로 정리하고 API v1 adapter와 Repository 준비를 시작한다.

## 2. 작업 순서

```text
Participation Contract
  -> Participation Dashboard Boundary
  -> Public Participation Boundary
  -> Community Contract
  -> Streamer Community Boundary
  -> Tournament Contract
  -> Tournament Public/Manage Boundary
  -> API v1 Adapter
  -> Repository Interface Draft
```

## 3. 파일 단위 작업 순서

| 순서 | 파일 | 작업 | Risk |
|---:|---|---|---|
| 1 | `apps/dashboard/src/pages/ParticipationPage.tsx` | queue/manual feature boundary | High |
| 2 | `apps/dashboard/src/pages/TournamentsPage.tsx` | manage boundary | Medium |
| 3 | `apps/dashboard/src/pages/StreamerRiotRequestsPage.tsx` | admin request boundary | Medium |
| 4 | `apps/dashboard/src/pages/FollowersPage.tsx` | follower feature boundary | Medium |
| 5 | `apps/dashboard/src/pages/MyRiotAccountPage.tsx` | streamer profile boundary | Medium |
| 6 | `apps/dashboard/src/pages/SoloRankPage.tsx` | solo rank settings boundary | Medium |
| 7 | `packages/shared/src/community.ts` | community contract | Medium |
| 8 | `packages/shared/src/tournament.ts` | tournament contract | Medium |
| 9 | `apps/server/src/routes/http-api.ts` | API v1 adapter | High |
| 10 | `apps/server/src/modules/participation.module.ts` | event behavior 유지 | High |
| 11 | `apps/server/src/modules/lol-profile-enrichment.module.ts` | profile enrichment boundary | High |
| 12 | `apps/server/src/services/store.ts` | repository interface draft | High |

## 4. Feature 단위 순서

1. Participation queue read
2. Participation manual control
3. Participation invite message
4. Public participation join/cancel
5. Community post list
6. Community post/comment write
7. Tournament list/detail
8. Tournament manage
9. API v1 route adapter
10. JsonRepository interface draft

## 5. Feature Flag

- `YORO_PARTICIPATION_V2_ENABLED`
- `YORO_COMMUNITY_V2_ENABLED`
- `YORO_TOURNAMENT_V2_ENABLED`
- `YORO_API_V1_ENABLED`
- `YORO_REPOSITORY_LAYER_ENABLED`

## 6. Legacy 유지

- `/api/public/participation/*` 유지
- `/api/public/community/*` 유지
- `/api/public/tournaments/*` 유지
- `/api/participation/*` 유지
- `/api/tournaments` 유지
- `Store` JSON source of truth 유지

## 7. QA Gate

- public join/cancel
- streamer manual open/close/in-game/finish
- invite bulk
- community post/comment
- tournament list/detail/save/delete
- API v1/legacy parity
- Store behavior parity
- rollback flag off

## 8. 완료 조건

- North Star Loop 핵심 flow 유지
- API v1 adapter safe
- repository layer는 draft/adapter 수준
- Prisma 도입 없음
- production rollout은 단계적 적용

