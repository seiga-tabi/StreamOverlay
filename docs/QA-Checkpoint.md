# YORO.gg QA Checkpoint

## 1. 공통 QA Gate

각 Sprint 종료 시 다음 항목을 확인한다.

| 항목 | 기준 |
|---|---|
| Build | `npm run build` 통과 |
| Type Check | workspace build의 TypeScript 통과 |
| Config | `npm run validate:config` 통과 |
| Test | `npm test` 통과 또는 미실행 사유 기록 |
| Lighthouse | Public/Dashboard 주요 route 측정 |
| Accessibility | keyboard, focus, contrast, aria |
| Responsive | mobile/tablet/desktop |
| i18n | Korean/Japanese copy와 layout |
| Bundle Size | Performance Budget 이내 |
| Memory | surface별 budget 이내 |
| Performance | LCP/CLS/INP/API p95 |
| Visual Regression | baseline screenshot 비교 |

## 2. Sprint별 QA Checkpoint

### Sprint 1: Foundation

- token alias 적용 전후 visual diff 확인
- feature flag default 확인
- API client legacy endpoint parity
- i18n key 누락 없음
- dashboard/overlay CSS import order 유지

### Sprint 2: Dashboard Shell

- admin login flow
- streamer login flow
- role별 navigation visibility
- mobile sidebar/header behavior
- dashboard socket 연결 상태
- legacy page fallback

### Sprint 3: Overlay Studio

- OBS URL copy 정확성
- overlay token/hash auth
- mock preview render
- live WebSocket reconnect
- event/chat/participation/solo-rank mode 표시
- blank frame 없음
- overlay CSS budget

### Sprint 4: Public Search/Profile

- 첫 검색 성공
- recent search/favorite 저장
- profile summary 표시
- match history pagination
- expanded match build/rune 로딩
- public route history behavior
- mobile search layout
- KR/JP locale switching

### Sprint 5: Participation/Community/Tournament/API v1

- participation join/cancel
- streamer manual control
- invite message bulk action
- community post/comment create
- tournament list/detail/manage
- legacy `/api/*`와 `/api/v1/*` parity
- auth/rate limit/CSRF 유지

### Sprint 6: Repository/Performance/Cleanup

- Store behavior fixture parity
- JSON repository read/write
- dashboard snapshot 정상
- overlay message log 정상
- deprecated selector/component usage 없음
- performance budget 재측정

## 3. Accessibility Checklist

- focus visible
- button/link accessible name
- modal/dropdown keyboard close
- loading state `aria-live` 검토
- form label 연결
- color contrast 기준 충족
- reduced motion 고려

## 4. Responsive Checklist

| Viewport | 확인 |
|---|---|
| 390px mobile | public search, dashboard nav, participation |
| 768px tablet | card grid, overlay studio preview |
| 1024px desktop | dashboard shell |
| 1440px desktop | public/profile layout |
| OBS 1920x1080 | overlay runtime |
| OBS 1280x720 | overlay runtime compact |

## 5. Visual Regression 기준

허용:

- token alias 적용으로 픽셀 단위 미세 차이
- spacing rounding 1~2px

불허:

- primary CTA 위치 변경
- overlay frame blank
- text overflow
- card/button height jump
- mobile horizontal scroll
- locale 전환 시 layout collapse

