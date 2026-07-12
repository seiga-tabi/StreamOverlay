# YORO.gg Component Governance v1

문서 상태: 공식 Component 운영 기준  
적용 범위: Component 생성, 수정, 삭제, version, deprecated, Storybook

## 1. Component Governance 목적

Component Governance는 YORO.gg가 기능이 늘어나도 같은 제품처럼 유지되도록 만드는 운영 규칙이다.

Component는 단순 UI 조각이 아니라 제품 언어의 단위이다.

## 2. Component 생성 규칙

새 Component는 다음 조건을 모두 만족할 때만 생성한다.

- 기존 Component로 해결할 수 없다.
- 최소 2개 이상의 화면에서 재사용 가능하다.
- Design Token만으로 스타일링할 수 있다.
- default, hover, focus, disabled, loading, error 상태가 정의되어 있다.
- KR / JP 문구 구조를 수용할 수 있다.
- mobile / tablet / desktop 동작이 정의되어 있다.
- Storybook 또는 component inventory에 등록할 수 있다.

## 3. Component 수정 규칙

기존 Component 수정 시 다음을 확인한다.

- 기존 사용 화면의 UX를 깨지 않는다.
- visual regression이 예상되는 화면을 명시한다.
- prop 추가가 기존 variant를 대체하지 않는다.
- 임시 예외 스타일을 Component 내부에 넣지 않는다.
- breaking change면 version을 올린다.

## 4. Component 삭제 규칙

Component 삭제는 다음 조건을 만족해야 한다.

- 사용처가 0개이다.
- 대체 Component가 명확하다.
- deprecated 기간이 끝났다.
- 문서에서 제거되었다.
- migration note가 남아 있다.

## 5. Component 추가 규칙

Component 추가 PR 또는 작업은 다음 정보를 포함해야 한다.

- 문제 정의
- 대상 persona
- 재사용 예상 화면
- states
- responsive behavior
- accessibility behavior
- i18n behavior
- 기존 Component로 해결할 수 없는 이유

## 6. Version 규칙

Component version은 다음 기준을 따른다.

- patch: bug fix, visual correction
- minor: backward-compatible prop or variant
- major: breaking structure, behavior, naming change

Design Token 변경은 Component major change로 간주될 수 있다.

## 7. Deprecated 규칙

Deprecated Component는 다음 상태를 가진다.

- `deprecated`
- `replacement`
- `removeAfter`
- `migrationGuide`

Deprecated Component는 새 화면에서 사용할 수 없다.

## 8. Naming 규칙

Component 이름은 역할 기반으로 작성한다.

좋은 이름:

- `PageHeader`
- `StatusPill`
- `OverlayPreviewTile`
- `ParticipationQueue`
- `StreamerProfileCard`

나쁜 이름:

- `BlueCard`
- `NewPanel`
- `DashboardBox`
- `PrettyButton`
- `TempLayout`

CSS class는 Component 이름과 semantic part를 따른다.

예:

- `overlay-preview-tile`
- `participation-queue-row`
- `streamer-profile-card`

## 9. Storybook 관리 규칙

모든 shared Component는 Storybook 또는 동일 역할의 component catalog에 등록한다.

필수 stories:

- Default
- Hover
- Focus
- Disabled
- Loading
- Error
- Empty
- Mobile
- Japanese text
- Korean text

도메인 Component는 실제 mock data를 사용해야 한다.

## 10. Component Review Checklist

- 이 Component는 어떤 persona를 돕는가?
- Product Principle을 위반하지 않는가?
- 기존 Component로 대체 가능한가?
- token을 벗어난 값이 없는가?
- keyboard와 screen reader를 지원하는가?
- 44px target을 지키는가?
- KR / JP 긴 문구에서 깨지지 않는가?

