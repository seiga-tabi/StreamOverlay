# YORO.gg Accessibility Rule

## 1. 기준

YORO.gg UI는 WCAG 2.1 AA를 기준으로 한다.

## 2. 필수 규칙

- keyboard only 사용 가능
- focus visible
- screen reader label 제공
- color contrast AA 이상
- touch target 최소 44px
- color만으로 상태 전달 금지
- reduced motion 고려
- loading/error/empty state 전달

## 3. Keyboard 규칙

필수:

- Tab 순서 자연스러움
- Shift+Tab 역순 가능
- Enter/Space activation
- ESC modal/dropdown close
- focus trap for modal
- skip 불가능한 hidden focus 금지

## 4. Focus 규칙

- focus ring 제거 금지
- custom focus style은 contrast 충분
- route change 후 focus 위치 고려
- modal open 시 첫 interactive element로 focus
- modal close 후 trigger로 focus 복귀

## 5. Screen Reader 규칙

- button/link accessible name
- input label 연결
- status는 `aria-live` 검토
- icon-only button은 aria label 필수
- decorative image는 적절한 alt 처리

## 6. Sprint별 접근성 Gate

| Sprint | Gate |
|---|---|
| Sprint1 | shared component accessibility spec |
| Sprint2 | dashboard navigation keyboard |
| Sprint3 | overlay studio controls and preview labels |
| Sprint4 | public search form and results |
| Sprint5 | forms, queues, community write flows |

