# YORO.gg Sprint1 Task Breakdown

## 공통 절대 수정 금지 파일

모든 Task에 적용한다.

- `package.json`
- lock 파일
- `tsconfig*.json`
- `apps/*/vite.config.ts`
- `Dockerfile`
- `docker-compose*.yml`
- `.env*`
- DB/Prisma 관련 파일
- `apps/bridge/src/*`
- `apps/server/src/core/action-dispatcher.ts`
- `packages/shared/src/actions.ts`, 단 S1-011에서 export 확인만 허용

## Issue 단위 원칙

- Issue 하나는 Task 하나와 1:1로 연결한다.
- Issue ID는 `ISSUE-S1-XXX` 형식을 사용한다.
- Issue 본문에는 수정할 파일, 절대 수정 금지 파일, QA, rollback을 반드시 포함한다.
- Issue가 4시간을 넘을 것으로 보이면 시작 전에 더 작은 Issue로 나눈다.

## S1-001 Baseline and No-Touch Verification

| 항목 | 내용 |
|---|---|
| Priority | P0 |
| Estimate | 2h |
| Dependency | 없음 |
| Owner | QA Lead |
| Risk | Low |

수정할 파일:

- 없음. 명령 실행과 PR 체크 기록만 수행.

SubTasks:

- 현재 `git status` 확인
- Sprint1 금지 파일 확인
- baseline command 목록 준비
- dashboard/public/overlay baseline 대상 route 확인

Acceptance Criteria:

- 현재 worktree 상태가 기록됨
- no-touch file 목록이 PR description에 포함됨
- Sprint1 구현 task가 시작 가능한 상태임

Definition of Done:

- 코드 변경 없음
- baseline command 실행 또는 미실행 사유 기록
- 다음 Task S1-002 시작 가능

QA Checklist:

- `git status --short`
- `git diff --name-only`
- no tracked code modified

Rollback:

- 변경 파일이 없어 rollback 불필요
- 실수로 파일 수정 시 해당 Task 중단 후 사용자 승인 없이 revert하지 않고 보고

## S1-002 Feature Flag Runtime Foundation

| 항목 | 내용 |
|---|---|
| Priority | P0 |
| Estimate | 3h |
| Dependency | S1-001 |
| Owner | Principal Frontend Architect |
| Risk | Medium |

수정할 파일:

- `apps/dashboard/src/runtime-config.ts`
- `apps/overlay/src/runtime-config.ts`

절대 수정 금지:

- 공통 금지 파일 전체
- `apps/dashboard/src/App.tsx`
- `apps/overlay/src/App.tsx`
- server config files

SubTasks:

- feature flag key type 정의
- runtime config read helper 추가
- default off 정책 유지
- missing flag fallback 정의
- dashboard/overlay 양쪽에서 동일한 naming 사용

Acceptance Criteria:

- 새 flag helper가 existing config behavior를 바꾸지 않음
- production default가 off 또는 undefined-safe
- `YORO_*_V2_ENABLED` naming 사용 가능

Definition of Done:

- 기존 `runtimeConfig()` consumer 회귀 없음
- no route/API/UI behavior change
- TypeScript build 통과

QA Checklist:

- dashboard build
- overlay build
- flag 미설정 상태 확인
- 기존 env 동작 확인

Rollback:

- helper 추가 commit revert
- 기존 `runtimeConfig()` shape 복구

## S1-003 Dashboard API Client Compatibility Adapter

| 항목 | 내용 |
|---|---|
| Priority | P0 |
| Estimate | 3h |
| Dependency | S1-002 |
| Owner | Lead Frontend Engineer |
| Risk | Medium |

수정할 파일:

- `apps/dashboard/src/api/client.ts`

절대 수정 금지:

- 공통 금지 파일 전체
- `apps/server/src/routes/http-api.ts`
- 모든 page component

SubTasks:

- legacy `/api/*` path 유지
- future `/api/v1/*` adapter hook point 추가
- error parser behavior 유지
- CSRF/header behavior 유지
- `apiGet`, `apiPost`, `apiDelete`, `apiPostForm` public API 유지

Acceptance Criteria:

- 기존 caller import 변경 없음
- legacy endpoint 그대로 호출
- v1 migration hook point만 존재

Definition of Done:

- API response shape 변경 없음
- auth surface header 유지
- CSRF header 유지

QA Checklist:

- TypeScript build
- auth status fetch smoke
- dashboard API caller compile

Rollback:

- `api/client.ts` revert
- S1-002 flag helper는 유지 가능하나 adapter path disabled

## S1-004 Dashboard and Overlay Socket Adapter Boundary

| 항목 | 내용 |
|---|---|
| Priority | P1 |
| Estimate | 3h |
| Dependency | S1-002 |
| Owner | Lead Frontend Engineer |
| Risk | Medium |

수정할 파일:

- `apps/dashboard/src/api/socket.ts`
- `apps/overlay/src/socket.ts`

절대 수정 금지:

- 공통 금지 파일 전체
- `apps/server/src/index.ts`
- `apps/server/src/services/overlay-hub.ts`
- `apps/server/src/services/dashboard-hub.ts`

SubTasks:

- current WebSocket URL 유지
- parser boundary 함수 분리
- malformed message handling 유지
- reconnect delay 변경 금지
- overlay token/hash auth 변경 금지

Acceptance Criteria:

- `/ws/dashboard` URL 유지
- `/ws/overlay` URL 유지
- overlay auth message 유지
- reconnect behavior 유지

Definition of Done:

- socket API external signature 유지
- no server change
- no protocol change

QA Checklist:

- dashboard socket compile
- overlay socket compile
- mock malformed message path 검토

Rollback:

- 두 socket file revert
- server 변경이 없으므로 deploy rollback 최소화

## S1-005 Dashboard i18n Adapter Audit

| 항목 | 내용 |
|---|---|
| Priority | P1 |
| Estimate | 2h |
| Dependency | S1-002 |
| Owner | Frontend Engineer |
| Risk | Low |

수정할 파일:

- `apps/dashboard/src/i18n.ts`

절대 수정 금지:

- 공통 금지 파일 전체
- page/component copy 대량 변경

SubTasks:

- existing locale helper 확인
- missing fallback behavior 확인
- future shared UI key namespace 예약
- 기존 copy 변경 금지

Acceptance Criteria:

- KR/JP 구조 유지
- existing key 변경 없음
- shared UI key 추가 시 fallback 가능

Definition of Done:

- i18n compile 통과
- text behavior 변경 없음

QA Checklist:

- locale switch smoke
- no hardcoded new English UI text
- TypeScript build

Rollback:

- `i18n.ts` revert

## S1-006 Dashboard Design Token Alias

| 항목 | 내용 |
|---|---|
| Priority | P0 |
| Estimate | 4h |
| Dependency | S1-002 |
| Owner | Design System Engineer |
| Risk | Medium |

수정할 파일:

- `apps/dashboard/src/styles/index.css`

절대 수정 금지:

- 공통 금지 파일 전체
- 모든 `.tsx` file
- `apps/overlay/src/styles/overlay.css`

SubTasks:

- token alias section 추가
- existing value와 동일한 alias만 정의
- color/spacing/radius/shadow/type token grouping
- 기존 selector 값 변경 최소화
- visual redesign 금지

Acceptance Criteria:

- 기존 dashboard visual diff <= 0.3%
- no selector deletion
- no `!important` 신규 추가
- token alias naming이 Design System Rule과 일치

Definition of Done:

- dashboard build 통과
- visual screenshot 비교 기록
- CSS syntax valid

QA Checklist:

- dashboard desktop/mobile screenshot
- settings/dashboard/login visual spot check
- no horizontal scroll

Rollback:

- token alias section revert
- legacy CSS values remain source of truth

## S1-007 Overlay Design Token Alias

| 항목 | 내용 |
|---|---|
| Priority | P1 |
| Estimate | 3h |
| Dependency | S1-002 |
| Owner | Overlay Engineer |
| Risk | Medium |

수정할 파일:

- `apps/overlay/src/styles/overlay.css`

절대 수정 금지:

- 공통 금지 파일 전체
- `apps/overlay/src/App.tsx`
- `apps/overlay/src/socket.ts`, S1-004 외 변경 금지
- dashboard CSS

SubTasks:

- OBS-safe token alias section 추가
- existing overlay visual values 보존
- heavy shadow/filter 추가 금지
- no selector deletion

Acceptance Criteria:

- OBS overlay visual diff <= 0.1%
- blank frame 0
- no animation behavior change

Definition of Done:

- overlay build 통과
- mock overlay screenshot 비교
- existing mode class 유지

QA Checklist:

- event overlay screenshot
- participation overlay screenshot
- solo-rank overlay screenshot
- reconnect chip visual unchanged

Rollback:

- overlay token alias section revert

## S1-008 Shared Button and IconButton Foundation

| 항목 | 내용 |
|---|---|
| Priority | P0 |
| Estimate | 4h |
| Dependency | S1-006 |
| Owner | Design System Engineer |
| Risk | Low |

수정할 파일:

- `apps/dashboard/src/shared/ui/Button.tsx`
- `apps/dashboard/src/shared/ui/IconButton.tsx`
- `apps/dashboard/src/shared/ui/index.ts`
- `apps/dashboard/src/shared/ui/ui.css` 또는 existing shared style entry if selected

절대 수정 금지:

- 공통 금지 파일 전체
- existing page components
- existing `components/*.tsx` consumers

SubTasks:

- Button props 최소 정의
- IconButton accessible label 필수화
- 44px min target
- disabled/loading/focus state 지원
- no page adoption in this task

Acceptance Criteria:

- component compiles
- no existing UI behavior change
- token 사용
- aria label rule 반영

Definition of Done:

- TypeScript build 통과
- component export 준비
- no consumer migration

QA Checklist:

- compile
- keyboard/focus review
- token usage review

Rollback:

- new shared UI files delete/revert
- no consumer affected

## S1-009 Shared Card, Panel, MetricCard Foundation

| 항목 | 내용 |
|---|---|
| Priority | P0 |
| Estimate | 4h |
| Dependency | S1-006, S1-008 |
| Owner | Design System Engineer |
| Risk | Low |

수정할 파일:

- `apps/dashboard/src/shared/ui/Card.tsx`
- `apps/dashboard/src/shared/ui/Panel.tsx`
- `apps/dashboard/src/shared/ui/MetricCard.tsx`
- `apps/dashboard/src/shared/ui/index.ts`
- `apps/dashboard/src/shared/ui/ui.css`

절대 수정 금지:

- 공통 금지 파일 전체
- `apps/dashboard/src/components/StatusCard.tsx`
- existing pages

SubTasks:

- Card/Panel semantic wrapper 정의
- MetricCard label/value/status 구조 정의
- nested card 방지 guideline prop 미추가
- token-only style

Acceptance Criteria:

- no existing consumer change
- card radius/shadow token 사용
- MetricCard accessibility label 고려

Definition of Done:

- build 통과
- shared export 포함
- no visual behavior change

QA Checklist:

- compile
- token usage review
- accessibility review

Rollback:

- new files revert
- no runtime consumer affected

## S1-010 Shared PageHeader and State Components Foundation

| 항목 | 내용 |
|---|---|
| Priority | P1 |
| Estimate | 4h |
| Dependency | S1-008, S1-009 |
| Owner | Frontend Engineer |
| Risk | Low |

수정할 파일:

- `apps/dashboard/src/shared/ui/PageHeader.tsx`
- `apps/dashboard/src/shared/ui/EmptyState.tsx`
- `apps/dashboard/src/shared/ui/LoadingState.tsx`
- `apps/dashboard/src/shared/ui/ErrorState.tsx`
- `apps/dashboard/src/shared/ui/index.ts`
- `apps/dashboard/src/shared/ui/ui.css`

절대 수정 금지:

- 공통 금지 파일 전체
- existing page components
- API client

SubTasks:

- PageHeader title/description/action slots
- EmptyState accessible copy structure
- LoadingState role/status 고려
- ErrorState retry action slot
- no page adoption

Acceptance Criteria:

- shared component compiles
- i18n text는 caller가 주입
- no hardcoded user-facing copy except generic aria if required with ko/ja structure

Definition of Done:

- build 통과
- no existing UI behavior change
- export ready

QA Checklist:

- compile
- keyboard/focus review
- i18n hardcoding check

Rollback:

- new files revert

## S1-011 Shared UI Exports and Import Boundary Check

| 항목 | 내용 |
|---|---|
| Priority | P1 |
| Estimate | 2h |
| Dependency | S1-008, S1-009, S1-010 |
| Owner | Principal Frontend Architect |
| Risk | Low |

수정할 파일:

- `apps/dashboard/src/shared/ui/index.ts`
- `packages/shared/src/index.ts`, only if shared contract export is needed and non-breaking

절대 수정 금지:

- 공통 금지 파일 전체
- existing page consumers
- `packages/shared/src/actions.ts` behavior

SubTasks:

- shared UI barrel export 확인
- circular import 없음 확인
- `packages/shared` export 변경 필요 여부 점검
- layer direction 위반 없음 확인

Acceptance Criteria:

- imports are stable
- no circular dependency
- no existing import break

Definition of Done:

- build 통과
- no consumer migration

QA Checklist:

- TypeScript build
- `rg`로 forbidden import pattern 확인

Rollback:

- barrel export revert
- new components remain unused if needed

## S1-012 Sprint1 Final QA and Release Readiness

| 항목 | 내용 |
|---|---|
| Priority | P0 |
| Estimate | 3h |
| Dependency | S1-001~S1-011 |
| Owner | QA Lead / Release Manager |
| Risk | Medium |

수정할 파일:

- 없음. 검증과 PR/release readiness 기록만 수행.

절대 수정 금지:

- 모든 코드 파일
- 모든 설정 파일

SubTasks:

- full build
- config validation
- test
- dashboard visual smoke
- overlay visual smoke
- public visual smoke
- feature flag default review
- PR list review

Acceptance Criteria:

- Sprint1 종료 조건 모두 충족
- 미실행 QA 항목은 사유와 risk 기록
- Sprint2 시작 가능 판단

Definition of Done:

- code behavior change 없음 확인
- no tracked unexpected files
- release readiness note 작성

QA Checklist:

- `npm run build`
- `npm run validate:config`
- `npm test`
- visual smoke
- git status review

Rollback:

- QA task 자체 rollback 없음
- 실패한 선행 PR을 flag off 또는 revert
