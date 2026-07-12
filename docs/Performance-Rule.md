# YORO.gg Performance Rule

## 1. 목적

Performance Rule은 refactor 중 UX 성능 회귀를 막기 위한 hard budget이다.

## 2. Lighthouse 기준

| Surface | Performance | Accessibility | Best Practices |
|---|---:|---:|---:|
| Public | >= 85 | >= 95 | >= 90 |
| Dashboard | >= 80 | >= 95 | >= 90 |
| Overlay Preview | >= 85 | >= 90 | >= 90 |

## 3. Core Web Vitals

| Metric | Public | Dashboard | Overlay Preview |
|---|---:|---:|---:|
| LCP | <= 2.5s | <= 2.5s | <= 1.5s |
| CLS | <= 0.05 | <= 0.05 | <= 0.02 |
| INP | <= 200ms | <= 200ms | <= 150ms |
| TTFB | <= 800ms | <= 800ms | <= 500ms |

## 4. JS/CSS Budget

| Surface | Initial JS gzip | Route chunk gzip | Initial CSS gzip |
|---|---:|---:|---:|
| Public Search | <= 220 KB | <= 120 KB | <= 80 KB |
| Public Profile | <= 260 KB | <= 160 KB | <= 90 KB |
| Dashboard | <= 240 KB | <= 140 KB | <= 90 KB |
| Overlay | <= 180 KB | <= 80 KB | <= 60 KB |

## 5. Image Budget

| Asset | Max |
|---|---:|
| Twitch profile image | 80 KB |
| Community thumbnail | 180 KB |
| Overlay runtime image | 500 KB |
| Alert media preview | 3 MB |

## 6. API Response Budget

| API | Size | p95 |
|---|---:|---:|
| profile | <= 80 KB | <= 800ms |
| matches | <= 180 KB | <= 1000ms |
| community posts | <= 120 KB | <= 600ms |
| tournaments | <= 100 KB | <= 600ms |
| participation state | <= 60 KB | <= 400ms |
| overlay status | <= 80 KB | <= 300ms |

## 7. 위반 처리

- Sprint 작업 중 초과: Sprint 내 수정
- Stage 초과: rollout 금지
- Production 초과: feature flag off
- Overlay first frame 실패: 즉시 rollback

