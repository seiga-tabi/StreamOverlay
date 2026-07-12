# YORO.gg Feature Acceptance Rules v1

문서 상태: 공식 기능 수용 기준  
적용 범위: 신규 기능, 수정 기능, 화면 추가, Component 추가

## 1. 기능 추가 전 필수 질문

모든 신규 기능은 다음 질문을 통과해야 한다.

1. 이 기능은 누구를 위한 것인가?
2. Guest, User, Streamer, Admin 중 primary persona는 누구인가?
3. 이 기능은 Streamer와 Viewer를 연결하는가?
4. North Star Loop에 기여하는가?
5. 기존 기능으로 해결 가능한가?
6. 새 페이지가 아니라 기존 flow 개선으로 해결 가능한가?
7. 방송 안전성을 해치지 않는가?
8. 사용자 journey를 단축하는가?
9. Design System을 깨지 않는가?
10. 기존 Component를 재사용할 수 있는가?
11. KR / JP 다국어 구조가 준비되어 있는가?
12. mobile에서 정상적으로 사용할 수 있는가?
13. loading, error, empty state가 정의되어 있는가?
14. 접근성 기준을 만족하는가?
15. 성공 KPI를 측정할 수 있는가?

## 2. Feature Acceptance Checklist

기능은 다음 항목을 모두 만족해야 한다.

- Persona 정의
- User Journey 정의
- Success State 정의
- Empty State 정의
- Loading State 정의
- Error State 정의
- Permission State 정의
- Design Token 사용
- Component 재사용
- i18n 구조
- Analytics event 정의
- Safety review
- Mobile behavior
- Accessibility behavior

## 3. 거절 기준

다음에 해당하는 기능은 추가하지 않는다.

- 단순히 기능 수를 늘리는 기능
- 기존 화면과 중복되는 기능
- Admin 편의를 위해 User flow를 복잡하게 만드는 기능
- 방송 중 위험을 증가시키는 기능
- Design System을 우회하는 기능
- CSS 예외를 대량으로 요구하는 기능
- KR / JP 중 하나만 고려한 기능
- 측정 가능한 성공 기준이 없는 기능

## 4. 화면 추가 기준

새 화면은 다음 조건을 만족해야 한다.

- 독립적인 user goal이 있다.
- 최소 3개 이상의 관련 action이 있다.
- 기존 navigation 안에서 자연스럽게 위치한다.
- 기존 화면에 추가하면 journey가 복잡해진다는 근거가 있다.
- 6개월 이상 유지될 제품 영역이다.

## 5. Component 추가 기준

새 Component는 Component Governance를 통과해야 한다.

필수:

- 재사용 가능성
- state 정의
- responsive 정의
- accessibility 정의
- Storybook 등록

## 6. Launch Readiness

기능 배포 전 확인:

- 주요 persona journey가 깨지지 않는다.
- fallback이 있다.
- error가 사용자 언어로 설명된다.
- dashboard 또는 admin에서 상태 확인 가능하다.
- 관련 KPI가 수집 가능하다.

