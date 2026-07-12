# YORO.gg Feature Flag Plan

## 1. 목적

Feature Flag는 새 구조와 기존 구조를 동시에 운영하기 위한 필수 장치다. 모든 high-risk refactor는 flag 또는 adapter를 통해 즉시 rollback 가능해야 한다.

## 2. Flag 명명 규칙

```text
YORO_<SURFACE>_<FEATURE>_V2_ENABLED
```

예:

- `YORO_DASHBOARD_SHELL_V2_ENABLED`
- `YORO_PUBLIC_SEARCH_V2_ENABLED`
- `YORO_OVERLAY_STUDIO_V2_ENABLED`

## 3. 핵심 Feature Flags

| Flag | 범위 | Default Dev | Default Stage | Default Prod | Rollback |
|---|---|---:|---:|---:|---|
| `YORO_FEATURE_FLAGS_ENABLED` | 전체 flag 시스템 | on | on | on | off 시 legacy only |
| `YORO_DASHBOARD_SHELL_V2_ENABLED` | dashboard app shell | on | on | off | legacy `App.tsx` flow |
| `YORO_SHARED_UI_V2_ENABLED` | Button/Card/PageHeader | on | on | off | legacy class/component |
| `YORO_DESIGN_TOKENS_V2_ENABLED` | token alias/new CSS layer | on | on | off | legacy CSS value |
| `YORO_OVERLAY_STUDIO_V2_ENABLED` | dashboard overlay studio | on | on | off | legacy `OverlayOpsPage` |
| `YORO_OVERLAY_RUNTIME_V2_ENABLED` | OBS overlay runtime | on | off | off | legacy overlay `App.tsx` |
| `YORO_PUBLIC_SEARCH_V2_ENABLED` | public search extraction | on | on | off | legacy `PublicLolPage` |
| `YORO_PUBLIC_PROFILE_V2_ENABLED` | profile/match history extraction | on | off | off | legacy profile section |
| `YORO_PARTICIPATION_V2_ENABLED` | participation dashboard/public | on | off | off | legacy participation flow |
| `YORO_COMMUNITY_V2_ENABLED` | streamer community | on | off | off | legacy public community |
| `YORO_TOURNAMENT_V2_ENABLED` | tournament flow | on | off | off | legacy tournament section |
| `YORO_API_V1_ENABLED` | `/api/v1/*` routes | on | on | off | legacy `/api/*` |
| `YORO_REPOSITORY_LAYER_ENABLED` | repository abstraction | on | off | off | direct Store |
| `YORO_PRISMA_READ_ENABLED` | future DB read | off | off | off | JSON Store |

## 4. Flag 적용 원칙

1. flag는 server-side와 client-side 양쪽에서 해석 가능해야 한다.
2. production default는 low-risk 기능만 on으로 시작한다.
3. broadcast-critical path는 stage에서 100% 검증 전 production on 금지.
4. flag 제거는 100% rollout 후 최소 1 release 이후 별도 PR로 한다.
5. flag가 auth/security 정책을 약화하면 안 된다.

## 5. Flag Evaluation 계층

```text
runtime config
  -> environment default
  -> server-provided config
  -> role/surface override
  -> percentage rollout
  -> emergency kill switch
```

## 6. Percentage Rollout 기준

| 단계 | 적용 비율 | 조건 |
|---|---:|---|
| Internal | 0% public, internal only | dev/stage 검증 |
| Canary | 10% | error rate baseline 이하 |
| Limited | 30% | UX KPI 하락 없음 |
| Majority | 50% | performance budget 통과 |
| Full | 100% | rollback 이슈 없음 |
| Cleanup | 100% + 1 release | legacy 제거 가능 |

## 7. Kill Switch 조건

즉시 off:

- overlay blank frame 발생
- login/session 실패율 증가
- participation join/cancel 실패
- search API error rate 증가
- admin action permission regression
- bundle 또는 memory budget 초과로 사용자 영향 발생

## 8. Flag별 관측 지표

| Flag | 관측 지표 |
|---|---|
| Dashboard Shell | page load, navigation click, auth failure |
| Overlay Studio | URL copy, preview render, test action success |
| Overlay Runtime | first frame, reconnect count, WS validation error |
| Public Search | search submit, result success, LCP, API latency |
| Participation | join/cancel/manual control success |
| Community | post/comment create success |
| API v1 | status code, latency, contract mismatch |
| Repository | read/write checksum, persistence error |

