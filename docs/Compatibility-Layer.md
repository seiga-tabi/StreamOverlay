# YORO.gg Compatibility Layer Plan

## 1. 목적

Compatibility Layer는 legacy 구조와 새 구조를 동시에 운영하기 위한 완충 계층이다. 기존 서비스는 계속 동작하고, 새 구조는 flag로 점진 적용한다.

## 2. Compatibility 범위

| Layer | Legacy | New | Compatibility 방식 |
|---|---|---|---|
| Component | `components/*`, page 내부 component | `shared/ui`, `features/*` | wrapper/export adapter |
| API | `/api/*` | `/api/v1/*` | route adapter, response mapper |
| CSS | `index.css`, `overlay.css` global | token/layer/component CSS | token alias, import order bridge |
| Store | `Store` class 직접 호출 | repository interface | `JsonRepository` adapter |
| Router | `App.tsx` page state switch | route definitions/surfaces | legacy route fallback |
| Overlay URL | existing `/overlay?mode=*` | source builder contract | URL builder adapter |
| WebSocket | raw message handling | typed contract | parser adapter |

## 3. Legacy Component Coexistence

원칙:

- 기존 component를 즉시 삭제하지 않는다.
- 새 component는 legacy props adapter를 받을 수 있어야 한다.
- page migration 전에는 legacy component export를 유지한다.

예시 전략:

| Legacy | Adapter | New |
|---|---|---|
| `StatusCard` | `LegacyStatusCardAdapter` | `MetricCard` |
| `Layout` | `LegacyLayoutShell` | `AppShell` |
| `OverlayClientStatusCard` | `LegacyOverlayStatusAdapter` | `OverlaySourceList` |
| `LoginPage` | `LegacyLoginEntryAdapter` | `AuthEntry` |
| `PublicLolPage` | `LegacyPublicPageFallback` | `PublicSearchPage` |

## 4. Legacy API Coexistence

```mermaid
flowchart LR
  "Legacy Client /api/*" --> "Legacy Route Adapter"
  "New Client /api/v1/*" --> "V1 Controller"
  "Legacy Route Adapter" --> "V1 Controller"
  "V1 Controller" --> "Domain Service"
  "Domain Service" --> "Repository Interface"
```

규칙:

1. `/api/*`는 최소 2 release 동안 유지한다.
2. `/api/v1/*`가 안정화되기 전 legacy route가 source of truth다.
3. v1 controller가 안정화되면 legacy route가 v1 controller를 호출한다.
4. response shape 차이는 adapter에서 변환한다.
5. auth/rate limit은 legacy와 v1 모두 적용한다.

## 5. Legacy CSS Coexistence

단계:

1. token alias를 global root에 추가한다.
2. 기존 class 값은 token을 참조하도록 천천히 바꾼다.
3. 새 component CSS는 token만 사용한다.
4. page migration 완료 후 legacy selector를 deprecated section으로 이동한다.
5. 100% rollout 후 unused selector를 제거한다.

금지:

- legacy selector 삭제와 component migration을 같은 PR에 넣지 않는다.
- token 값 변경과 visual redesign을 같은 PR에 넣지 않는다.
- overlay CSS와 dashboard CSS를 무리하게 통합하지 않는다.

## 6. Legacy Store Coexistence

현재는 `apps/server/src/services/store.ts`가 JSON persistence source of truth다.

Target coexistence:

```text
Domain Service
  -> Repository Interface
    -> JsonRepository(Store adapter)
    -> PrismaRepository(future)
```

단계:

1. Store method behavior를 fixture로 고정한다.
2. repository interface를 domain별로 만든다.
3. JsonRepository는 기존 Store method를 호출한다.
4. controller/module은 repository interface만 본다.
5. PrismaRepository는 future flag 뒤에서만 연결한다.

## 7. Overlay Compatibility

절대 유지:

- 기존 OBS Browser Source URL
- `mode` query
- token/hash auth
- reconnect behavior
- message validation

새 구조:

- dashboard URL builder는 shared overlay contract를 사용한다.
- legacy mode와 new source type을 mapping한다.
- subtitles/questions/mission channel은 shared contract와 dashboard UI 불일치를 먼저 해결한다.

## 8. 제거 조건

legacy layer 제거는 다음 조건을 모두 만족해야 한다.

- production 100% rollout 완료
- 최소 1 release 동안 incident 없음
- rollback flag가 불필요하다는 release manager 승인
- usage log에서 legacy path 호출이 기준 이하
- 문서와 QA checklist 업데이트 완료

