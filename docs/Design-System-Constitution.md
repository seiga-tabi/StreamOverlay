# YORO.gg Design System Constitution v1

문서 상태: 공식 Design System 기준  
적용 범위: UI, CSS, Component, Motion, Accessibility, 다국어 UI

## 1. Design System의 목적

YORO.gg Design System은 Public, My YORO, Streamer Studio, Overlay Studio, Admin이 하나의 제품처럼 보이고 작동하게 만드는 기준이다.

Design System은 장식 규칙이 아니다. 사용자가 목표를 더 빠르고 안전하게 달성하게 하는 제품 인프라이다.

## 2. 절대 규칙

- 새 화면은 Design Token 없이 만들 수 없다.
- 새 CSS class는 기존 Component로 해결 불가능할 때만 만든다.
- Button, Card, PageHeader, StatusPill, FormField는 반드시 공통 Component를 우선 사용한다.
- KR / JP 다국어 구조는 UI 완료 조건이다.
- 모든 터치 target은 최소 44px를 지킨다.
- Focus visible은 제거할 수 없다.
- Motion은 prefers-reduced-motion을 존중해야 한다.
- 방송 중 action은 위험도에 따라 시각 위계를 가져야 한다.

## 3. Spacing

기본 spacing은 8px grid를 따른다.

- 4px: 미세 조정
- 8px: inline 요소 간격
- 12px: compact 내부 여백
- 16px: 기본 component padding
- 24px: card 내부 주요 여백
- 32px: section 간격
- 48px: page block 간격
- 64px: hero 또는 큰 구조 간격

임의 spacing 값은 금지한다.

## 4. Radius

허용 radius:

- 8px: small control, input
- 12px: default card, dropdown
- 16px: elevated card, modal
- 24px: hero panel, large glass surface
- 999px: pill, avatar

그 외 radius는 Design System 승인 없이 사용하지 않는다.

## 5. Color

Color는 semantic token으로만 사용한다.

- `brand.primary`
- `brand.secondary`
- `surface.base`
- `surface.glass`
- `surface.elevated`
- `surface.overlay`
- `text.primary`
- `text.secondary`
- `text.muted`
- `text.inverse`
- `state.success`
- `state.warning`
- `state.danger`
- `state.info`
- `role.guest`
- `role.user`
- `role.streamer`
- `role.admin`

색상은 기능 의미를 가져야 한다. 장식을 위해 새로운 hue를 추가하지 않는다.

## 6. Typography

Typography scale:

- Display: 브랜드 hero, 공개 홈
- Page Title: 주요 화면 제목
- Section Title: section heading
- Card Title: card heading
- Body: 기본 문장
- Caption: 보조 설명과 metadata
- Mono: token, URL, API, code

Hero-scale type은 hero에만 사용한다. Dashboard card 내부에서는 사용하지 않는다.

## 7. Shadow

Shadow는 3단계만 사용한다.

- `shadow.sm`: hover, small card
- `shadow.md`: elevated card
- `shadow.lg`: modal, overlay preview

여러 그림자를 중첩해 glass 효과를 만들지 않는다. Glass는 color, blur, border, opacity token으로 관리한다.

## 8. Motion

Motion duration:

- 120ms: hover, press
- 180ms: dropdown, toast
- 280ms: modal, drawer
- 360ms: overlay entrance

Motion은 상태 변화를 설명해야 한다. 장식만을 위한 반복 animation은 금지한다.

## 9. Breakpoints

Breakpoint는 다음만 사용한다.

- mobile: 0-639
- tablet: 640-1023
- desktop: 1024-1439
- wide: 1440+

예외 breakpoint는 Design System 문서에 등록해야 한다.

## 10. Component State

모든 interactive component는 다음 상태를 가져야 한다.

- default
- hover
- active
- focus
- disabled
- loading
- error

상태가 없는 component는 제품에 배포할 수 없다.

## 11. Loading / Skeleton

데이터 의존 화면은 text loading만 사용하지 않는다.

필수 skeleton 대상:

- Riot profile
- Match history
- Streamer list
- Participation queue
- Overlay preview
- Tournament list
- Follower list

## 12. Toast / Modal / Dropdown

`alert()`는 제품 UI로 사용하지 않는다.

Toast는 작업 결과를 알려야 한다. Modal은 사용자의 결정을 요구할 때만 사용한다. Dropdown은 hover만으로 열리면 안 되며 keyboard 접근이 가능해야 한다.

## 13. Card

Card는 정보를 묶는 용도이다. Page section을 모두 card로 감싸지 않는다.

Card는 다음 중 하나여야 한다.

- 정보 요약
- action group
- list item
- modal content
- preview frame

CTA 없는 card, 숫자 0만 보여주는 card, 중복 warning card는 금지한다.

## 14. Button

Button variant:

- primary
- secondary
- tertiary
- ghost
- danger
- icon

Compact button은 방송 중 조작에 사용하지 않는다.

## 15. Accessibility

필수 기준:

- Keyboard navigation
- Visible focus
- Minimum contrast
- 44px touch target
- Screen reader label
- Reduced motion
- Error text association
- Loading aria state

Accessibility는 후속 QA가 아니라 기능 완료 기준이다.

