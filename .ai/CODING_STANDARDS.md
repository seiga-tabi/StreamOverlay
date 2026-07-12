# YORO.gg Coding Standards

## 1. TypeScript 규칙

- `any` 사용을 피한다.
- shared contract type을 우선 사용한다.
- API response type은 client와 server에 중복 정의하지 않는다.
- nullable/optional 의미를 명확히 한다.
- unsafe cast는 이유를 남긴다.
- domain type은 `packages/shared`에 둔다.

## 2. React Component 규칙

- page는 composition만 담당한다.
- API 호출과 복잡한 state는 feature hook/API module로 분리한다.
- component는 props를 명확히 받는다.
- UI text는 i18n 구조를 사용한다.
- loading/error/empty state를 포함한다.
- accessibility attribute를 고려한다.

## 3. Hook 규칙

허용:

- feature state hook
- query/mutation adapter hook
- UI interaction hook
- provider context hook

금지:

- 여러 feature API를 한 hook에 섞기
- shared hook에서 product domain 직접 의존
- hook 내부에 권한 정책 숨기기
- side effect가 이름에 드러나지 않는 hook

## 4. API Client 규칙

- `apiGet`, `apiPost`, `apiDelete`, `apiPostForm` 같은 공통 client를 우선 사용한다.
- public page direct `fetch`는 feature API module로 점진 이전한다.
- `/api/v1/*` 도입 시 legacy `/api/*` adapter를 유지한다.
- error response는 일관된 message/code로 처리한다.
- CSRF와 credential 정책을 임의로 제거하지 않는다.

## 5. State Management 규칙

- page local state를 무분별하게 global context로 승격하지 않는다.
- auth, locale, surface, socket, overlay runtime 정도만 context 후보로 둔다.
- remote data cache는 feature boundary 안에서 관리한다.
- localStorage/sessionStorage 사용 시 실패 fallback을 둔다.
- OBS Browser Source 환경의 storage 제한을 고려한다.

## 6. Error Handling 규칙

- 사용자에게 보여줄 error message는 i18n 구조를 따른다.
- log에는 민감정보를 남기지 않는다.
- API error는 status와 domain code를 구분한다.
- overlay runtime error는 blank frame으로 이어지지 않도록 degrade한다.
- catch 후 무시하는 경우 안전한 이유가 있어야 한다.

## 7. File Naming 규칙

- React component: `PascalCase.tsx`
- hook: `useSomething.ts`
- API module: `featureApi.ts` 또는 `api.ts`
- type/contract: 명확한 domain name
- test: 기존 test pattern을 따른다.

## 8. Import/Export 규칙

- layer 방향을 지킨다.
- barrel export는 순환 의존을 만들지 않는다.
- `shared`가 `features`를 import하지 않는다.
- feature 간 직접 import 금지.
- server domain service는 HTTP 객체에 의존하지 않는다.

## 9. 주석 규칙

- 자명한 주석은 쓰지 않는다.
- 복잡한 domain decision 또는 security decision에만 짧게 작성한다.
- 한국어로 작성한다.
- 코드 문법/identifier는 영어 원문을 유지한다.

