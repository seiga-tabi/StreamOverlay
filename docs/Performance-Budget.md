# YORO.gg Performance Budget

## 1. 목적

Performance Budget은 refactor 중 성능 회귀를 막기 위한 최대 허용 기준이다. 예산 초과 시 merge 또는 rollout을 중단한다.

## 2. Frontend Bundle Budget

| Surface | JS Initial Gzip | JS Route Chunk Gzip | CSS Initial Gzip | 비고 |
|---|---:|---:|---:|---|
| Public Search | 220 KB | 120 KB | 80 KB | search shell 우선 |
| Public Profile | 260 KB | 160 KB | 90 KB | match detail lazy |
| Dashboard | 240 KB | 140 KB | 90 KB | admin-only lazy |
| Overlay | 180 KB | 80 KB | 60 KB | OBS first frame 우선 |
| Admin | 260 KB | 160 KB | 100 KB | low frequency |

Hard limit:

- 단일 lazy chunk gzip 200 KB 초과 금지
- 새 dependency로 initial gzip 30 KB 이상 증가 시 architecture review 필요

## 3. Image/Asset Budget

| Asset | 최대 크기 | 정책 |
|---|---:|---|
| Twitch profile image | 80 KB | fixed size, lazy |
| Community thumbnail | 180 KB | thumbnail 생성 후보 |
| Alert GIF/media preview | 3 MB | dashboard preview와 overlay runtime 분리 |
| Overlay runtime image | 500 KB | OBS first frame 우선 |
| Champion/emblem asset | cache hit 우선 | DataDragon/version cache |

## 4. API Response Budget

| API | Size Budget | Latency p95 | 비고 |
|---|---:|---:|---|
| `/api/lol/profile` | 80 KB | 800ms | Riot external latency 제외 |
| `/api/lol/matches` | 180 KB | 1000ms | pagination 필수 |
| `/api/public/community/posts` | 120 KB | 600ms | pagination/category |
| `/api/public/tournaments` | 100 KB | 600ms | list/detail 분리 |
| `/api/public/participation/state` | 60 KB | 400ms | queue size 제한 |
| `/api/overlay/status` | 80 KB | 300ms | recent log 제한 |
| `/api/status` | 120 KB | 400ms | dashboard snapshot 축소 필요 |

## 5. Core Web Vitals Budget

| Metric | Public | Dashboard | Overlay Preview |
|---|---:|---:|---:|
| LCP | <= 2.5s | <= 2.5s | <= 1.5s |
| CLS | <= 0.05 | <= 0.05 | <= 0.02 |
| INP | <= 200ms | <= 200ms | <= 150ms |
| TTFB | <= 800ms | <= 800ms | <= 500ms |

## 6. Memory Budget

| Surface | Budget |
|---|---:|
| Public Search idle | <= 120 MB |
| Public Profile with match list | <= 180 MB |
| Dashboard idle | <= 160 MB |
| Overlay OBS runtime | <= 120 MB |
| Overlay participation mode | <= 150 MB |

## 7. CSS Budget

| File/Layer | Budget |
|---|---:|
| Token/base CSS | <= 20 KB gzip |
| Dashboard shared CSS | <= 60 KB gzip |
| Public feature CSS | <= 80 KB gzip |
| Overlay runtime CSS | <= 60 KB gzip |

Migration 목표:

- Sprint 3까지 token alias 도입
- Sprint 5까지 dashboard global CSS unused 40% 감소 목표
- `!important` 신규 추가 금지

## 8. Runtime Budget

| 작업 | Budget |
|---|---:|
| Search input response | <= 100ms |
| Suggestion debounce | 200~300ms |
| Navigation route transition | <= 300ms |
| Overlay first frame | <= 1000ms |
| Overlay reconnect | <= 2000ms |
| Participation manual control feedback | <= 500ms |

## 9. Budget 위반 처리

| 위반 | 조치 |
|---|---|
| Minor, dev only | Sprint 내 수정 |
| Stage budget 초과 | rollout 중단 |
| Production budget 초과 | feature flag off |
| Overlay first frame 실패 | 즉시 rollback |
| API p95 악화 | v1 adapter off 또는 cache 보강 |

