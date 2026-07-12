# YORO.gg Review Rules

## 1. 리뷰 목적

PR 리뷰는 코드 스타일보다 제품 안정성, 아키텍처 일관성, 디자인 시스템 준수, 방송 안전성, 보안을 우선한다.

## 2. PR 리뷰 체크리스트

공통:

- Product Constitution 위반이 없는가?
- Architecture v2 layer rule을 지켰는가?
- Migration/Execution Plan 순서를 벗어나지 않는가?
- Feature Flag 또는 Compatibility Layer가 필요한 변경인가?
- Rollback 방법이 명확한가?

## 3. Product Constitution 확인

다음을 확인한다.

- Streamer와 Viewer를 연결하는가?
- 단순 관리자 페이지처럼 만들지 않았는가?
- 검색보다 관계와 참여 경험을 강화하는가?
- 불필요한 페이지/기능을 추가하지 않았는가?

## 4. Design System 확인

- Design Token을 사용했는가?
- 임의 color/spacing/radius/shadow가 없는가?
- Button/Card/Modal/Toast/PageHeader 규칙을 지켰는가?
- 44px touch target을 지켰는가?
- hover/focus/loading/error/empty state가 있는가?

## 5. Architecture 확인

- `app/pages/widgets/features/entities/shared` 방향을 지켰는가?
- feature끼리 직접 import하지 않았는가?
- shared가 feature에 의존하지 않는가?
- controller가 Store/file system을 직접 조작하지 않는가?
- API contract가 shared 또는 문서에 정의되었는가?

## 6. 성능 예산 확인

- bundle size 증가가 budget 이내인가?
- CSS 증가가 budget 이내인가?
- image/media budget을 지켰는가?
- API response size와 p95 latency가 악화되지 않았는가?
- overlay first frame이 안전한가?

## 7. i18n 확인

- UI text 하드코딩이 없는가?
- 한국어/일본어 copy가 함께 있는가?
- key naming이 일관적인가?
- 날짜/시간/숫자 포맷이 locale 기준인가?
- Riot ID, Twitch, OBS 등 고유명사를 임의 번역하지 않았는가?

## 8. 접근성 확인

- keyboard navigation 가능
- focus visible
- aria label 적절
- contrast 기준 충족
- color만으로 상태 전달하지 않음
- reduced motion 고려

## 9. 보안 확인

- secret/token/API key 하드코딩 없음
- auth/session 권한 검증 유지
- admin endpoint 보호
- rate limit 유지
- CORS/CSP 정책 약화 없음
- log에 민감정보 없음
- viewer input이 unsafe action으로 이어지지 않음

## 10. 리뷰 코멘트 기준

리뷰 코멘트는 다음 우선순위로 작성한다.

1. 보안/데이터 손상/방송 실패
2. 제품 헌법/아키텍처 위반
3. UX/accessibility regression
4. 성능/번들 regression
5. 유지보수성
6. 스타일/명명

