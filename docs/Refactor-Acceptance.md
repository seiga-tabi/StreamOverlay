# YORO.gg Refactor Acceptance Checklist

## 1. 공통 Acceptance

모든 refactor PR은 다음을 만족해야 한다.

- 코드 변경 범위가 한 목적에 집중되어 있다.
- 기존 route/API/overlay URL 호환이 유지된다.
- feature flag 또는 adapter rollback 경로가 있다.
- Product Constitution과 충돌하지 않는다.
- Architecture v2 layer rule을 지킨다.
- Design System token/component 규칙을 지킨다.
- KR/JP i18n 구조를 깨지 않는다.
- build/type/test 또는 미실행 사유가 기록되어 있다.
- QA Checkpoint 해당 항목을 통과한다.
- Performance Budget을 초과하지 않는다.

## 2. Component Acceptance

- shared component는 product-specific API를 호출하지 않는다.
- feature component는 다른 feature를 직접 import하지 않는다.
- props는 명확하고 최소화되어 있다.
- loading/error/empty/disabled/focus state가 있다.
- click target이 충분하다.
- mobile에서 text overflow가 없다.
- token 외 raw color/radius/shadow 추가가 없다.

## 3. Page Acceptance

- page는 composition 역할만 수행한다.
- API call과 복잡한 state machine은 feature/hook으로 이동한다.
- route fallback이 있다.
- primary CTA 위치가 유지되거나 문서화된 이유가 있다.
- 3초 내 핵심 action이 보인다.
- Guest/User/Streamer/Admin 대상이 명확하다.

## 4. API Acceptance

- endpoint namespace가 명확하다.
- request validation이 있다.
- response contract가 shared 또는 문서에 있다.
- auth/rate limit/CSRF 적용 여부가 명시되어 있다.
- error code가 일관적이다.
- legacy endpoint compatibility가 유지된다.
- sensitive data가 response/log에 노출되지 않는다.

## 5. CSS Acceptance

- token alias 또는 token value를 사용한다.
- CSS layer order를 지킨다.
- global selector 추가가 제한된다.
- `!important` 신규 추가는 exception note가 있다.
- overlay CSS는 OBS-safe 기준을 따른다.
- visual regression 허용 범위를 넘지 않는다.

## 6. Overlay Acceptance

- OBS Browser Source URL이 유지된다.
- `mode`와 `channel` contract가 shared 기준과 일치한다.
- token/hash auth가 유지된다.
- mock, preview, live 상태를 검증했다.
- first frame이 blank가 아니다.
- reconnect behavior가 유지된다.
- storage 접근 실패 시에도 안전하게 동작한다.

## 7. Store/Repository Acceptance

- 기존 Store behavior가 fixture와 일치한다.
- repository interface는 domain language를 사용한다.
- JSON Store adapter가 fallback으로 유지된다.
- Prisma 또는 DB 변경은 포함하지 않는다. 별도 단계에서만 진행한다.
- data migration이 필요한 경우 rollback plan이 있다.

## 8. Release Acceptance

- Dev 검증 완료
- Stage smoke 완료
- rollout 비율과 대상 정의
- kill switch 확인
- monitoring 지표 정의
- release note 작성
- rollback owner 지정

