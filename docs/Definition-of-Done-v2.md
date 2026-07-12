# YORO.gg Definition of Done v2

## 1. 공통 Done 조건

- 요청 범위 내 변경만 수행했다.
- Product Constitution과 충돌하지 않는다.
- Architecture v2 layer rule을 지켰다.
- Design System token/component 규칙을 지켰다.
- legacy fallback을 유지했다.
- feature flag가 필요한 경우 적용했다.
- QA Gate를 통과했다.
- Performance Rule을 통과했다.
- Accessibility Rule을 통과했다.
- KR/JP i18n 누락이 없다.
- rollback 절차가 문서화됐다.
- 관련 문서가 업데이트됐다.

## 2. Sprint별 Done

| Sprint | Done |
|---|---|
| Sprint1 | behavior change 없이 foundation 준비 |
| Sprint2 | dashboard shell fallback과 shared UI 동작 |
| Sprint3 | overlay URL/preview/runtime compatibility 유지 |
| Sprint4 | public search/profile strangler fallback 유지 |
| Sprint5 | participation/community/tournament/API v1 parity |

## 3. Done이 아닌 상태

- visual diff 원인 불명
- test 미실행 사유 없음
- mobile 검증 없음
- i18n 누락
- accessibility 상태 없음
- rollback 경로 없음
- legacy route 삭제
- OBS URL 변경
- auth/rate limit 약화

