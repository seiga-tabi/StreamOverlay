# YORO.gg Master Risk Register

## 1. 위험 등급

| 등급 | 의미 |
|---|---|
| P0 | 즉시 중단/rollback 필요 |
| P1 | Sprint 내 해결 필요 |
| P2 | 다음 Sprint 전 해결 |
| P3 | 추적 가능한 debt |

## 2. Risk Register

| ID | 위험 | 우선순위 | 발생 지점 | 대응 전략 | Rollback |
|---|---|---|---|---|---|
| R-001 | Overlay blank frame | P0 | Sprint3 | OBS screenshot, first frame check | overlay runtime flag off |
| R-002 | OBS URL 변경 | P0 | Sprint3 | URL builder parity | legacy URL builder |
| R-003 | Token/hash auth 실패 | P0 | Sprint3 | auth smoke | legacy overlay socket |
| R-004 | Participation queue corruption | P0 | Sprint5 | fixture/event replay | JSON snapshot restore |
| R-005 | unsafe action path 생성 | P0 | Any backend | shared action validation | revert PR |
| R-006 | Admin 기능 streamer 노출 | P0 | Sprint2/5 | role matrix QA | shell flag off |
| R-007 | Public search 실패율 증가 | P1 | Sprint4 | search parity, API p95 | public search flag off |
| R-008 | API 5xx 증가 | P0 | Sprint4/5 | stage load/smoke | API v1 off |
| R-009 | CSS cascade collapse | P1 | Sprint1/2 | visual baseline | token alias revert |
| R-010 | mobile navigation 사용 불가 | P1 | Sprint2 | responsive gate | shell flag off |
| R-011 | i18n 누락 | P1 | Any UI | key audit | block merge |
| R-012 | text clipping KR/JP | P1 | Any UI | visual regression | component rollback |
| R-013 | LCP budget 초과 | P1 | Sprint4 | bundle split | feature flag off |
| R-014 | overlay memory leak | P0 | Sprint3 | long-run OBS test | runtime flag off |
| R-015 | Store write regression | P0 | Sprint5 | behavior fixture | repository flag off |
| R-016 | CORS/CSRF 약화 | P0 | API work | security review | revert |
| R-017 | secret logging | P0 | server work | log redaction review | hotfix |
| R-018 | direct fetch duplication 지속 | P2 | Sprint4 | API module migration | tracked debt |
| R-019 | shared component over-abstraction | P2 | Sprint2 | review governance | component revert |
| R-020 | route history regression | P1 | Sprint4 | route smoke | legacy public fallback |
| R-021 | tournament slug mismatch | P2 | Sprint5 | slug contract test | legacy endpoint |
| R-022 | community permission 오류 | P1 | Sprint5 | auth matrix | community flag off |
| R-023 | dashboard socket message mismatch | P1 | Sprint2 | typed parser | legacy socket |
| R-024 | dependency 추가로 bundle 증가 | P2 | Any | dependency review | remove dependency |
| R-025 | Sprint scope creep | P1 | Any | MRS gate | split PR |

## 3. P0 중단 기준

- overlay blank frame
- auth/session production failure
- unsafe OBS/Twitch action path
- data corruption 가능성
- public API 5xx 급증
- secret/token 노출

## 4. 위험 대응 원칙

1. P0는 즉시 rollout 중단.
2. P1은 Sprint 종료 전 해결.
3. P2는 다음 Sprint Ready 조건으로 이동.
4. P3는 debt register에 기록.

