# YORO.gg Definition of Done

## 1. Global DoD

모든 작업은 다음 조건을 만족해야 완료로 인정한다.

- Product Constitution과 충돌하지 않는다.
- Architecture v2 layer rule을 지킨다.
- Design System Constitution token/component rule을 지킨다.
- KR/JP copy 구조를 유지한다.
- Guest/User/Streamer/Admin 중 대상 persona가 명확하다.
- 기존 방송 운영 안정성을 해치지 않는다.
- rollback 방법이 PR에 작성되어 있다.
- 필요한 테스트 또는 수동 검증 기록이 있다.

## 2. Sprint DoD

| Sprint | 완료 조건 |
|---|---|
| Sprint 1 | inventory, route map, CSS token map, migration issue breakdown 완료 |
| Sprint 2 | Dashboard surface, auth, navigation boundary가 role별로 검증됨 |
| Sprint 3 | Public search/profile feature 분리 후 legacy flow와 결과가 동일함 |
| Sprint 4 | Overlay Studio/OBS flow가 기존 URL과 auth를 유지함 |
| Sprint 5 | API v1 adapter와 repository interface 설계가 승인됨 |

## 3. Frontend DoD

- page는 composition만 담당한다.
- feature는 자체 API/state/UI boundary를 가진다.
- shared UI primitive를 우선 사용한다.
- 새 global CSS selector를 추가하지 않는다.
- loading, error, empty, disabled, focus, hover state를 가진다.
- mobile/tablet/desktop 검증을 기록한다.
- keyboard focus가 사라지지 않는다.
- text overflow가 button/card/container를 깨지 않는다.
- route-level lazy loading 정책을 지킨다.

## 4. Backend DoD

- endpoint owner가 명확하다.
- auth, csrf, rate limit 적용 여부가 명시되어 있다.
- request validation과 response contract가 있다.
- error code와 message가 일관적이다.
- 민감정보가 log에 남지 않는다.
- domain service가 HTTP 객체에 의존하지 않는다.
- repository interface를 우선한다.
- unsafe action type을 추가하지 않는다.

## 5. API DoD

- `/api/v1/*` target namespace가 명확하다.
- legacy `/api/*` compatibility가 유지된다.
- success/error envelope가 정의되어 있다.
- permission matrix가 작성되어 있다.
- pagination/filter/sort contract가 문서화되어 있다.
- client adapter가 type-safe하게 호출한다.
- breaking change는 최소 2 release 전에 deprecated 처리한다.

## 6. CSS/Design System DoD

- token을 사용한다.
- spacing은 8px grid를 따른다.
- radius, shadow, typography scale이 token에 맞다.
- component CSS와 page CSS가 섞이지 않는다.
- overlay CSS는 OBS-safe subset을 따른다.
- `!important`는 exception note가 있다.
- dark/light 또는 locale에 따라 layout이 깨지지 않는다.
- accessibility contrast 기준을 확인한다.

## 7. Overlay DoD

- OBS Browser Source URL이 유지된다.
- `mode`와 `channel` contract가 shared 기준과 일치한다.
- token/hash auth가 유지된다.
- mock, preview, live 상태를 검증한다.
- reconnect 중 blank 화면을 최소화한다.
- storage 접근 실패 시에도 동작한다.
- animation은 transform/opacity 중심이다.
- overlay message validation을 통과한다.

## 8. DB/Repository DoD

- 현재 JSON behavior가 fixture로 검증된다.
- repository method 이름이 domain action을 표현한다.
- read/write 책임이 명확하다.
- Prisma 도입 전 export/import와 rollback 계획이 있다.
- relation/index가 KPI query를 지원한다.
- destructive migration은 승인 전 금지한다.

## 9. Documentation DoD

- 변경된 architecture, navigation, API, component rule이 문서에 반영된다.
- deprecated 항목은 제거 일정과 대체 경로가 있다.
- 새 feature는 Acceptance Rules를 통과한다.
- 운영자가 알아야 하는 env/config 변경이 명시된다.

