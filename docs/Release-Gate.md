# YORO.gg Release Gate

## 1. Production 배포 조건

Production 배포 전 다음을 모두 통과해야 한다.

- build/type/test/config
- QA Gate
- Performance Rule
- Accessibility Rule
- Visual Regression Rule
- Security review
- i18n verification
- Stage smoke
- rollback owner 지정
- feature flag default 확인
- monitoring metric 확인

## 2. 배포 방식

권장:

- frontend static artifact: Blue/Green
- server API: API migration 기간에는 Blue/Green 우선
- overlay runtime: Blue/Green 고정
- bridge: 자동 rolling 금지
- DB: Sprint5까지 production DB migration 없음

## 3. Rolling 허용

허용:

- docs only
- low-risk token alias
- non-critical dashboard UI

금지:

- overlay runtime
- auth/session
- participation queue mutation
- ActionDispatcher
- bridge/OBS command
- Store persistence

## 4. Release 중단 기준

- overlay blank frame
- auth/session failure
- API 5xx 증가
- participation failure
- secret/token 노출
- performance budget 20% 이상 초과
- visual regression critical

## 5. Release Report 형식

```text
Release:
- version/branch:
- changed area:
- flags:
- QA result:
- performance:
- accessibility:
- visual regression:
- security:
- rollback owner:
- monitoring:
```

