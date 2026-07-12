# YORO.gg Design System Rules

## 1. 기본 원칙

새 UI는 Design Token 없이 만들 수 없다. 임의 px, 임의 color, 임의 shadow, 임의 gradient를 추가하지 않는다.

기준 문서:

- `docs/Design-System-Constitution.md`
- `docs/Component-Governance.md`
- `docs/Architecture-Governance.md`

## 2. Design Token 사용 규칙

Token 종류:

- color
- spacing
- radius
- shadow
- typography
- motion
- z-index
- breakpoint
- state

규칙:

- component CSS는 token을 참조한다.
- page마다 다른 button/card 값을 만들지 않는다.
- token 추가는 design system 문서 업데이트와 함께 진행한다.
- 기존 CSS migration은 token alias부터 시작한다.

## 3. Spacing 규칙

- 기본 단위는 8px grid다.
- 작은 간격은 4px 단위만 허용한다.
- 주요 section 간격은 24px, 32px, 48px 계열을 사용한다.
- 임의 `13px`, `17px`, `23px` 같은 값 추가 금지.

## 4. Radius 규칙

- card radius는 Design System scale을 따른다.
- 버튼, input, modal, toast는 각 component token을 사용한다.
- page별로 radius를 새로 정하지 않는다.
- 원형 avatar/icon만 `50%` 사용을 허용한다.

## 5. Color 규칙

색상은 다음 role로만 사용한다.

- primary
- secondary
- background
- surface
- border
- text
- muted
- hover
- disabled
- danger
- warning
- success
- info

금지:

- 임의 hex 추가
- 같은 의미에 다른 색 사용
- contrast 부족 색상
- one-note palette
- decorative gradient 남용

## 6. Shadow 규칙

- shadow token만 사용한다.
- card마다 다른 shadow를 만들지 않는다.
- overlay는 OBS readability와 performance를 우선한다.
- heavy blur/filter는 performance budget 검토 없이 금지한다.

## 7. Typography 규칙

- type scale을 사용한다.
- viewport width 기반 font-size 금지.
- letter spacing은 기본 0을 유지한다.
- 긴 한국어/일본어 텍스트 overflow를 반드시 검증한다.
- dashboard panel 내부에는 hero-scale typography를 쓰지 않는다.

## 8. Motion 규칙

- motion token을 사용한다.
- reduced motion을 고려한다.
- hover/focus feedback은 즉각적이어야 한다.
- overlay motion은 transform/opacity 중심으로 제한한다.
- 방송 화면을 방해하는 과한 animation 금지.

## 9. Component 규칙

| Component | 규칙 |
|---|---|
| Button | 최소 44px touch target, icon/button state 필수 |
| Card | 중첩 card 금지, 목적이 명확해야 함 |
| Modal | focus trap, ESC close, backdrop 정책 필요 |
| Toast | status별 token, 자동 사라짐 시간 정의 |
| Dropdown | keyboard navigation, outside click 처리 |
| PageHeader | title, description, primary action 구조 통일 |
| Metric | label/value/status 변화 명확 |

## 10. 접근성 기준

- touch target 최소 44px
- keyboard focus visible
- contrast WCAG AA 이상
- aria label/role 적절히 사용
- loading/error는 assistive tech에 전달
- color만으로 상태를 전달하지 않는다.

## 11. 금지 행동

- 임의 px 값 추가
- 임의 gradient 추가
- 임의 shadow 추가
- token 없는 color 추가
- page 전용 button/card 새로 만들기
- mobile overflow 방치
- text clipping 방치
- hover/focus 없는 interactive element 추가
