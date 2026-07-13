# P1 Frontend Release Risks

P1/P2 개선 이후에도 대규모 CSS/React 분해는 작은 PR과 visual regression을 거쳐 진행한다.

## Bundle Baseline

- Dashboard JS total: 약 723KB, gzip total 약 215KB, largest chunk 약 310KB
- Dashboard CSS total: 약 979KB
- Overlay JS total: 약 199KB
- Overlay CSS total: 약 64KB
- `styles/index.css`: import entry 13줄
- 주요 legacy CSS: `01-core.css` 19,977줄, `02-legacy.css` 10,354줄, `05-overrides.css` 4,474줄
- `PublicLolPage.tsx`: 7,755줄

CI `npm run check:budgets`는 raw build footprint, gzip 전송량, largest chunk를 함께 검사한다. 목표 budget은 feature 분리와 CSS 정리 작업에서 단계적으로 낮춘다.

`npm run check:tokens`는 Shared UI, 신규 관리자 화면, 최종 Public override에 raw 색상·gradient·shadow·px가 다시 추가되는 것을 차단한다. 과거 legacy CSS의 raw 값은 visual regression을 동반한 페이지 단위 PR로 이전한다.

## Asset Candidates

중복 원본은 사용처 확인 후 제거했고 실행 자산은 다음 형식으로 교체했다.

- 로고: lossless WebP
- 홈 배경: AVIF 우선, WebP fallback
- `yorogg-og.png`: SNS 공유용 원본 유지

향후 신규 이미지는 WebP/AVIF를 우선하고, OG 이미지처럼 플랫폼 호환성이 필요한 경우에만 PNG를 유지한다.

## Touch Target Priority

Public Home과 Community를 1440px/390px에서 실측했으며 보이는 control은 최소 `44x44 CSS px`, horizontal overflow는 0이었다. Dashboard와 Overlay의 페이지별 전체 audit는 계속 유지한다.

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
