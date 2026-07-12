# YORO.gg Migration Rollback Plan

## 1. Rollback 원칙

1. 모든 migration PR은 되돌릴 수 있어야 한다.
2. legacy route, legacy component, legacy CSS entry를 즉시 삭제하지 않는다.
3. DB migration은 dual write 이전까지 read path를 바꾸지 않는다.
4. OBS overlay URL은 migration 중에도 기존 형태를 유지한다.
5. rollback은 코드 revert만이 아니라 config, data, cache, route priority를 포함한다.

## 2. Layer별 Rollback

| Layer | Rollback 방식 |
|---|---|
| Folder migration | 이동 전 export path 유지, PR revert |
| Component migration | legacy component wrapper로 fallback |
| CSS token | token alias file revert |
| CSS split | 기존 global CSS import order 복구 |
| Dashboard router | legacy page switch fallback |
| Navigation | 이전 pages array/role allowlist 복구 |
| API v1 | v1 route disable, legacy `/api/*` 유지 |
| WebSocket | 기존 message parser와 channel handler 유지 |
| Store repository | direct Store method path 복구 |
| Prisma | JSON read fallback, DB read flag off |
| Docker | 이전 image tag와 compose env 복구 |

## 3. Feature Flag 전략

필수 flag:

- `DASHBOARD_V2_ENABLED`
- `PUBLIC_SEARCH_V2_ENABLED`
- `OVERLAY_STUDIO_V2_ENABLED`
- `API_V1_ENABLED`
- `REPOSITORY_LAYER_ENABLED`
- `PRISMA_READ_ENABLED`
- `PRISMA_DUAL_WRITE_ENABLED`

Flag default:

- local/dev: 선택적으로 on
- staging: Sprint 검증 시 on
- production: 기능별 검증 전 off

## 4. API Rollback

API v1 도입 중 rollback 기준:

1. client는 v1 호출 실패 시 legacy endpoint fallback을 가질 수 있다.
2. server는 legacy endpoint를 v1 controller adapter로 연결하되, 초기에는 legacy handler를 남긴다.
3. v1 response envelope이 문제가 되면 client adapter에서 legacy shape로 변환한다.
4. auth/rate limit middleware가 의심되면 route priority를 legacy로 되돌린다.

## 5. DB Rollback

현재 Prisma가 없으므로 DB rollback은 미래 도입 기준이다.

| 단계 | Rollback |
|---|---|
| Prisma schema draft | 문서/스키마 PR revert |
| Migration file 생성 | production 적용 전 삭제 가능 |
| DB table 생성 | 사용 전이면 drop 가능, 사용 후 보존 |
| Dual write | flag off, JSON만 write |
| DB read cutover | `PRISMA_READ_ENABLED=false` |
| JSON deprecation | 최소 2 release 후에만 진행 |

DB migration 전 필수 backup:

- JSON state directory archive
- generated Prisma migration files
- seed/export/import output
- checksum report

## 6. Overlay Rollback

Overlay rollback은 가장 보수적으로 처리한다.

Rollback 조건:

- OBS Browser Source가 blank로 렌더링됨
- reconnect가 반복됨
- token auth 실패
- participation queue가 화면에 표시되지 않음
- event banner가 표시되지 않음

Rollback 방법:

1. 기존 overlay build artifact로 되돌린다.
2. 기존 `/overlay` static serving path를 우선한다.
3. dashboard overlay URL generator를 legacy version으로 되돌린다.
4. shared `OVERLAY_CHANNELS` contract 변경이 원인이면 이전 contract를 복구한다.
5. OBS scene/source 설정은 변경하지 않는다.

## 7. Dashboard Rollback

Rollback 조건:

- admin이 설정/테스트 화면에 접근하지 못함
- streamer가 필요한 방송 운영 화면에 접근하지 못함
- login/session이 반복 만료됨
- navigation이 mobile에서 사용 불가

Rollback 방법:

1. legacy `App.tsx` page switch를 다시 사용한다.
2. role allowlist를 이전 값으로 되돌린다.
3. CSS import order를 이전 global order로 되돌린다.
4. dashboard socket contract 변경을 되돌린다.

## 8. Public Product Rollback

Rollback 조건:

- 검색 실패율 증가
- profile match history 표시 실패
- participation join/cancel 실패
- community post/comment 실패
- tournament detail route 실패

Rollback 방법:

1. `PublicLolPage` legacy route를 우선 렌더링한다.
2. feature-level client API를 legacy direct fetch로 fallback한다.
3. localStorage key 변경이 있으면 migration adapter를 비활성화한다.
4. public route rewrite를 이전 형태로 복구한다.

## 9. Rollback 의사결정

| 영향 | 조치 |
|---|---|
| visual minor regression | hotfix 또는 다음 PR 수정 |
| single non-critical feature regression | feature flag off |
| auth/overlay/participation regression | 즉시 rollback |
| data corruption 가능성 | write 중지, backup restore 검토 |
| production boot failure | 이전 image redeploy |

