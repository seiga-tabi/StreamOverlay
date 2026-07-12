# YORO.gg Definition of Ready v1

## 1. 목적

Definition of Ready는 Codex가 작업을 시작해도 되는 상태를 정의한다.

## 2. 공통 Ready 조건

- 작업 목적이 명확하다.
- 관련 persona가 명확하다.
- 대상 Sprint가 명확하다.
- 대상 파일 목록이 있다.
- 금지 파일 목록을 확인했다.
- Product Constitution과 충돌하지 않는다.
- Architecture v2 layer rule을 확인했다.
- Design System rule을 확인했다.
- feature flag 필요 여부가 결정됐다.
- compatibility layer 필요 여부가 결정됐다.
- rollback 방식이 정의됐다.
- QA 항목이 정의됐다.
- performance budget 영향이 평가됐다.
- i18n 영향이 평가됐다.
- accessibility 영향이 평가됐다.

## 3. Sprint별 Ready

| Sprint | Ready 조건 |
|---|---|
| Sprint1 | baseline, token inventory, flag list 확정 |
| Sprint2 | shared UI spec, dashboard shell fallback 확정 |
| Sprint3 | OBS URL baseline, overlay screenshot baseline |
| Sprint4 | public search/profile baseline, API parity map |
| Sprint5 | participation/community/tournament contract map |

## 4. Ready가 아닌 상태

- "깔끔하게 정리" 같은 모호한 요청
- 대상 파일 미확정
- rollback 없음
- QA 없음
- feature flag 필요 여부 미정
- legacy compatibility 미정
- code owner/리뷰 기준 미정

