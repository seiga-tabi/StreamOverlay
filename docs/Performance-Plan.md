# YORO.gg Performance Plan

## 1. 현재 병목

| 영역 | 병목 | 영향 |
|---|---|---|
| Public frontend | `PublicLolPage.tsx` 9,337 lines | initial parse/evaluate 비용, 유지보수 난이도 증가 |
| Dashboard CSS | `index.css` 23,732 lines | 불필요한 CSS 다운로드, cascade 비용, visual regression 위험 |
| Overlay CSS | `overlay.css` 4,110 lines | OBS Browser Source 렌더 안정성 영향 |
| Server route | `http-api.ts` 5,197 lines | route 변경 리스크, endpoint별 최적화 어려움 |
| Store | JSON Store 단일 class | query/index/cache 최적화 어려움 |
| Public data fetch | direct fetch, feature cache 부재 | 중복 요청, loading state 불일치 |
| WebSocket snapshot | dashboard snapshot 중심 | role/feature별 diff push 최적화 어려움 |
| Image/media | alert assets/community images/profile images 혼재 | resize/lazy/cache policy 부족 |

## 2. 성능 목표

| Metric | 목표 |
|---|---|
| Public first usable search | 2초 이내 |
| Search API p95 | 800ms 이하, Riot API 외부 지연 제외 |
| Dashboard first render | 2초 이내 |
| Overlay first frame | OBS Browser Source에서 1초 이내 |
| Overlay reconnect recovery | 2초 이내 |
| Bundle split | public/search/profile/community/tournament chunk 분리 |
| CSS unused reduction | Sprint 5까지 dashboard global CSS 40% 이상 축소 목표 |

## 3. Frontend Bundle Plan

1. route-level lazy loading을 유지하고 feature-level chunk를 추가한다.
2. `PublicLolPage` 분해 시 search shell을 첫 chunk로 두고, match build/rune/community/tournament는 lazy load한다.
3. Dashboard는 `Today Broadcast`를 first chunk로 두고 admin-only pages는 lazy load한다.
4. Overlay는 OBS mode별 필요한 overlay만 로드하도록 channel/mode lazy boundary를 둔다.
5. bundle analyzer를 Sprint 1 baseline과 Sprint 5 결과에 적용한다.

## 4. React Rendering Plan

적용 대상:

- match history list
- expanded match detail
- participation queue
- overlay preview grid
- dashboard event/action log
- community feed

계획:

1. list key와 memo boundary를 정리한다.
2. derived state는 `useMemo` 또는 selector로 격리한다.
3. user input state와 remote data state를 분리한다.
4. large list는 virtualization 후보로 분류한다.
5. overlay runtime에서는 animation과 timer가 불필요한 re-render를 유발하지 않도록 reducer를 분리한다.

## 5. Data Fetching and Cache Plan

현재는 direct `fetch`와 `apiGet/apiPost`가 혼재한다.

Target:

- feature API module을 둔다.
- request key를 명시한다.
- stale time/cache time을 feature별로 정의한다.
- Riot/DataDragon/Match detail은 cache 우선 전략을 둔다.
- mutating request 후 invalidation rule을 문서화한다.

React Query 또는 동등한 query cache 도입 기준:

1. API response contract가 shared에 정리됨
2. feature boundary가 존재함
3. auth/session error policy가 통일됨
4. SSR이 아닌 CSR runtime 기준 cache policy가 확정됨

## 6. Server Performance Plan

| 영역 | 계획 |
|---|---|
| Riot API | profile/match/DataDragon cache key 정리 |
| Public search | input validation, suggestion debounce, rate limit 유지 |
| Community | pagination, category index, image serving cache |
| Tournament | slug lookup index |
| Participation | queue mutation lock 또는 atomic repository method |
| Dashboard snapshot | feature별 partial snapshot 또는 event diff |
| Overlay messages | dedupe key 유지, channel filtering 강화 |
| JSON Store | repository별 read/write split, write batching 검토 |

## 7. CSS Performance Plan

1. token/base/component/page layer를 분리한다.
2. page migration마다 unused selector를 제거한다.
3. global descendant selector를 component scope selector로 대체한다.
4. media query breakpoint를 Design System 기준으로 통일한다.
5. overlay CSS는 OBS-safe subset으로 유지하고, dashboard token과 직접 섞지 않는다.
6. `!important`는 migration debt로 추적한다.

## 8. Image and Asset Plan

| Asset | 정책 |
|---|---|
| Twitch profile image | lazy, fixed size, fallback avatar |
| Community image | upload size limit, thumbnail generation 후보 |
| Alert GIF/media | dashboard preview와 overlay runtime size 분리 |
| Ranked emblem | server cache 유지, cache header 검토 |
| Champion assets | DataDragon version cache |

## 9. Overlay Performance Plan

OBS Browser Source 기준:

- 첫 frame이 blank이면 실패로 본다.
- mode별 required CSS/JS만 로드한다.
- reconnect 중에도 마지막 안전 상태를 유지한다.
- localStorage/sessionStorage 실패를 정상 case로 처리한다.
- animation은 GPU-friendly transform/opacity 중심으로 제한한다.
- heavy shadow/filter는 overlay mode별 예산을 둔다.

## 10. 측정 계획

| Sprint | 측정 |
|---|---|
| Sprint 1 | bundle size, CSS size, endpoint latency baseline |
| Sprint 2 | dashboard first render, navigation interaction |
| Sprint 3 | public search/profile load, chunk split |
| Sprint 4 | overlay first frame, reconnect, preview render |
| Sprint 5 | API v1 latency, repository behavior, community pagination |

