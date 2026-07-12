# P1 Frontend Release Risks

이번 P0 작업에서는 대규모 CSS/React 분해를 하지 않는다. 아래 항목은 release candidate에서 별도 PR과 visual regression을 거쳐야 한다.

## Bundle Baseline

- Dashboard JS total: 약 661KB, largest chunk 약 489KB
- Dashboard CSS total: 약 962KB
- Overlay JS total: 약 199KB
- Overlay CSS total: 약 64KB
- `index.css`: 38,080줄
- `PublicLolPage.tsx`: 10,395줄

CI `npm run check:budgets`는 현재 production baseline보다 커지는 회귀를 차단한다. 목표 budget은 별도 리팩터링에서 단계적으로 낮춘다.

## Asset Candidates

삭제 전 사용처와 시각 회귀를 확인한다.

- `yorogg-horizontal-logo.png`: 약 1.25MB
- `yorogg-logo.png`: 약 789KB
- `seigagg.png`: 약 789KB
- `seigagg-logo.png`: 약 789KB
- `yorogg-og.png`: 약 631KB

동일 binary 중복 여부, 실제 import/URL 사용 여부, WebP/AVIF 또는 최적화 PNG 대체를 별도 PR에서 검토한다.

## Touch Target Priority

현재 CSS 정적 검사에서 44px 미만의 interactive 후보가 다수 확인됐다. icon 자체 크기와 hit area를 구분해 Playwright로 실제 bounding box를 측정해야 한다.

우선순위:

1. `.public-locale-button`, `.public-locale-popover button`
2. `.public-topbar nav button`
3. `.top-action`, `.secondary.top-action`
4. `.public-favorite-button`
5. `.public-profile-tabs button`
6. `.public-overview-filter-row button`
7. `.public-match-filter-bar select`, `.public-match-filter-bar button`
8. `.public-match-more button`
9. 모바일 header/search/clear/menu icon controls

각 control은 desktop과 mobile에서 최소 `44x44 CSS px`, keyboard focus-visible, accessible name, disabled state를 확인한다.

## Required QA

- 1440px desktop, 768px tablet, 390px mobile
- KR/JP locale의 긴 문자열
- keyboard-only navigation
- focus order와 focus visibility
- 200% zoom
- reduced motion
- horizontal overflow
- Lighthouse accessibility와 axe 결과
- Public Home, Profile, Recent Match, Community, Tournament, Dashboard, Overlay Studio visual baseline
