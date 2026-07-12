# YORO.gg Architecture Governance

## 1. 목적

Architecture Governance는 migration 이후 구조가 다시 무너지지 않도록 새 component, CSS, API, hook, context, store, dependency 추가를 통제하는 규칙이다.

## 2. 새 Component 추가 규칙

새 component는 다음 질문을 통과해야 한다.

1. 기존 component로 해결할 수 없는가?
2. 이 component의 layer는 `shared`, `entities`, `features`, `widgets`, `pages` 중 어디인가?
3. props가 product domain을 과하게 노출하지 않는가?
4. loading/error/empty/disabled/focus state가 정의되어 있는가?
5. KR/JP copy가 component 내부에 hardcode되어 있지 않은가?
6. Design Token만 사용하는가?

금지:

- page 내부에 재사용 가능한 card/button/table을 새로 hardcode
- feature component에서 다른 feature component 직접 import
- shared component에 product-specific API 호출 추가

## 3. Component 수정 규칙

- shared component 수정은 영향 범위를 확인한다.
- visual token 변경은 screenshot diff를 확인한다.
- breaking props 변경은 deprecated period를 둔다.
- streamer broadcast-critical component는 별도 검증한다.

## 4. Component 삭제 규칙

삭제 전 조건:

- 사용처 `rg` 확인
- 대체 component 문서화
- deprecated marker 최소 1 Sprint 유지
- CSS selector 제거 범위 확인

## 5. CSS 추가 규칙

허용:

- token file
- base layer
- component scoped CSS
- feature scoped CSS
- overlay OBS-safe CSS

금지:

- 무제한 global selector
- page마다 다른 button/card/radius 값
- token 없이 color/radius/shadow 직접 추가
- 의미 없는 `!important`
- component nesting을 깨는 deep descendant selector

CSS layer order:

```text
tokens
reset
base
layout
primitives
components
features
pages
utilities
```

## 6. API 추가 규칙

새 API는 다음을 반드시 가진다.

- namespace: public/me/streamer/admin/auth 중 하나
- permission matrix
- request validator
- response contract
- error code
- rate limit 여부
- CSRF 여부
- legacy adapter 필요 여부
- telemetry event 여부

금지:

- controller에서 JSON file 직접 조작
- auth 없는 mutating public endpoint
- response shape 임의 변경
- shared contract 없이 frontend type만 추가

## 7. Hook 추가 규칙

허용 hook:

- feature state hook
- query/mutation adapter hook
- UI interaction hook
- provider context hook

금지:

- hook에서 여러 feature API를 무분별하게 조합
- shared hook이 product domain에 의존
- hook 내부에서 권한 정책을 숨김
- hook 이름이 실제 side effect를 숨김

## 8. Context/Store 추가 규칙

Context는 다음 경우에만 허용한다.

- auth/session
- locale/theme
- surface/role
- websocket connection
- overlay runtime state

금지:

- page local state를 global context로 승격
- server cache를 context에 직접 저장
- role permission을 UI context만으로 판단

## 9. Backend Module 추가 규칙

새 module은 다음을 만족해야 한다.

- trigger event가 명확하다.
- output action이 allowlist에 있다.
- validation이 shared schema를 통과한다.
- broadcast 중 실패해도 안전하게 degrade된다.
- log와 telemetry가 있다.
- viewer input이 unsafe action으로 이어지지 않는다.

## 10. Repository 추가 규칙

- domain별 interface를 먼저 정의한다.
- JSON implementation과 future Prisma implementation을 분리한다.
- repository는 HTTP status를 알지 않는다.
- repository method는 domain language를 사용한다.
- migration 전 fixture와 behavior test를 작성한다.

## 11. Dependency 추가 규칙

새 dependency는 다음을 통과해야 한다.

- 대체 가능한 표준 API가 없는가?
- bundle size 또는 server runtime 비용이 합리적인가?
- maintenance 상태가 안전한가?
- license가 사용 가능한다.
- broadcast-critical path에 runtime risk를 만들지 않는가?

Frontend dependency는 bundle impact를 기록한다.

Backend dependency는 security/update risk를 기록한다.

## 12. Deprecated 정책

Deprecated 항목은 다음 정보를 가진다.

- 대체 대상
- 제거 예정 Sprint 또는 release
- migration owner
- 사용처 목록
- rollback 영향

Deprecated 상태는 무기한 유지하지 않는다.

## 13. Architecture Review 체크리스트

- 이 변경은 Product Constitution과 일치하는가?
- 이 변경은 North Star Loop를 강화하는가?
- 이 변경은 기존 feature로 해결할 수 없는가?
- 이 변경은 Architecture v2 layer rule을 지키는가?
- 이 변경은 Design System token/component를 재사용하는가?
- 이 변경은 streamer 방송 안정성을 해치지 않는가?
- 이 변경은 rollback 가능한가?

