# YORO.gg Sprint1 Specification

## 1. Sprint 목표

Sprint1은 Foundation Sprint다. 실제 UX나 behavior를 변경하지 않고 이후 리팩토링이 가능한 기반을 만든다.

허용:

- feature flag contract
- API client adapter
- socket adapter
- token alias
- shared component specification
- QA baseline

금지:

- page redesign
- route 변경
- OBS URL 변경
- API behavior 변경
- package/Docker/DB 변경

## 2. 작업 순서

```text
Baseline
  -> Feature Flag Contract
  -> Runtime Config Adapter
  -> API Client Adapter
  -> Socket Adapter
  -> i18n Audit
  -> Design Token Alias
  -> Shared UI Skeleton
  -> QA Baseline
```

## 3. 파일 단위 작업 순서

| 순서 | 파일 | 작업 | 허용 변경 |
|---:|---|---|---|
| 1 | `packages/shared/src/index.ts` | contract export 점검 | export only |
| 2 | `packages/shared/src/overlay.ts` | overlay channel contract 확인 | breaking change 금지 |
| 3 | `packages/shared/src/participation.ts` | participation type 확인 | behavior 없음 |
| 4 | `apps/dashboard/src/runtime-config.ts` | flag/config read 위치 설계 | default 변경 금지 |
| 5 | `apps/dashboard/src/api/client.ts` | API adapter boundary 설계 | legacy endpoint 유지 |
| 6 | `apps/dashboard/src/api/socket.ts` | typed socket adapter 준비 | message shape 변경 금지 |
| 7 | `apps/dashboard/src/i18n.ts` | key 구조 점검 | text 변경 금지 |
| 8 | `apps/dashboard/src/styles/index.css` | token alias 추가 순서 설계 | visual diff 금지 |
| 9 | `apps/overlay/src/styles/overlay.css` | OBS-safe token alias 설계 | visual diff 금지 |

## 4. Component 단위 순서

1. `Button` specification
2. `IconButton` specification
3. `Card` specification
4. `MetricCard` specification
5. `PageHeader` specification
6. `EmptyState` specification
7. `LoadingState` specification
8. `ErrorState` specification

Sprint1에서는 실제 page에 대량 적용하지 않는다.

## 5. Page 단위 순서

Page migration 없음.

Baseline만 기록:

- Dashboard
- OverlayOps
- Public Search
- Public Profile
- Participation
- Community
- Tournament
- Settings

## 6. Feature Flag 적용 위치

Sprint1에서 정의만 하고 production default는 off.

- `YORO_FEATURE_FLAGS_ENABLED`
- `YORO_DESIGN_TOKENS_V2_ENABLED`
- `YORO_SHARED_UI_V2_ENABLED`
- `YORO_DASHBOARD_SHELL_V2_ENABLED`
- `YORO_PUBLIC_SEARCH_V2_ENABLED`
- `YORO_OVERLAY_STUDIO_V2_ENABLED`

## 7. Legacy 유지

- 모든 legacy component 유지
- 모든 legacy route 유지
- 모든 legacy CSS selector 유지
- 모든 legacy API 유지

## 8. Definition of Ready

- 기준 문서 확인 완료
- 대상 파일 확정
- visual baseline 존재
- performance baseline 존재
- rollback 방법 문서화

## 9. Definition of Done

- behavior change 없음
- flag default 확인
- token alias visual diff 허용 범위 내
- build/type/test/config 검증 또는 미실행 사유 기록
- Sprint2 시작 가능한 shared UI 기준 문서화

## 10. QA Gate

- `npm run build`
- `npm run validate:config`
- `npm test`
- dashboard/public/overlay screenshot baseline
- bundle size baseline
- no code path behavior change 확인

## 11. 절대 수정 금지

- `Dockerfile`
- `docker-compose*.yml`
- `package.json`
- `tsconfig*.json`
- `apps/server/src/core/action-dispatcher.ts`
- `apps/bridge/src/*`
- DB/Prisma 관련 파일

