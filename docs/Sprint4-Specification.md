# YORO.gg Sprint4 Specification

## 1. Sprint 목표

Sprint4는 `PublicLolPage.tsx`를 strangler 방식으로 분리하여 Public Search와 Profile/Match History를 안정화한다.

## 2. 작업 순서

```text
Public API Adapter
  -> Search Storage Adapter
  -> Search Input
  -> Suggestions
  -> Profile Summary
  -> Match History
  -> Expanded Match Detail
  -> Public Fallback Wrapper
```

## 3. 파일 단위 작업 순서

| 순서 | 파일 | 작업 | Risk |
|---:|---|---|---|
| 1 | `apps/dashboard/src/pages/PublicLolPage.tsx` | strangler boundary | High |
| 2 | `apps/dashboard/src/api/client.ts` | public API adapter | Medium |
| 3 | `apps/dashboard/src/components/ProfileLinkIcon.tsx` | shared entity candidate | Low |
| 4 | `packages/shared/src/participation.ts` | public profile/role contract 확인 | Medium |
| 5 | `packages/shared/src/community.ts` | public community contract 확인 | Medium |
| 6 | `packages/shared/src/tournament.ts` | tournament contract 확인 | Medium |
| 7 | `apps/server/src/routes/http-api.ts` | public API adapter parity | High |
| 8 | `apps/server/src/services/riot-api.ts` | search latency/caching 확인 | Medium |
| 9 | `apps/server/src/services/data-dragon.ts` | asset/cache 확인 | Medium |
| 10 | `apps/server/src/services/lol-profile-store.ts` | cache repository 준비 | Medium |

## 4. Component 단위 순서

1. PublicSearchShell
2. SearchInput
3. SearchSuggestions
4. RecentSearches
5. FavoriteProfiles
6. ProfileSummary
7. RankSummary
8. MatchHistoryList
9. MatchDetailPanel
10. PublicFallbackBoundary

## 5. Feature Flag

- `YORO_PUBLIC_SEARCH_V2_ENABLED`
- `YORO_PUBLIC_PROFILE_V2_ENABLED`

Flag off 시 기존 `PublicLolPage` 전체가 렌더링되어야 한다.

## 6. Legacy 유지

- `/`, `/lol`, `/privacy`, `/terms`, `/contact`, `/lol/tournaments` route 유지
- direct fetch helper 즉시 삭제 금지
- localStorage key 유지
- recent/favorite migration adapter 필요

## 7. QA Gate

- 첫 검색 성공
- suggestion 표시
- recent/favorite 유지
- profile loaded
- match history pagination
- expanded match build/rune
- KR/JP locale switching
- mobile layout
- LCP <= 2.5s

## 8. 완료 조건

- public conversion flow 회귀 없음
- legacy fallback 동작
- API response parity
- visual regression 기준 통과

