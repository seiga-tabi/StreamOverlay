# YORO.gg Rollout Strategy

## 1. 목적

새 구조를 한 번에 전체 사용자에게 적용하지 않고, 10%, 30%, 50%, 100% 순서로 안전하게 확장한다.

## 2. Rollout 단계

| 단계 | 비율 | 대상 | 조건 |
|---|---:|---|---|
| Internal | 0% public | 개발자/admin | dev/stage 검증 |
| Canary | 10% | 일부 guest/streamer | error/performance baseline 이하 |
| Limited | 30% | 일반 사용자 일부 | UX KPI 하락 없음 |
| Majority | 50% | 절반 사용자 | support issue 증가 없음 |
| Full | 100% | 전체 사용자 | 1 release 안정 |
| Cleanup | 100% + 1 release | legacy 제거 | deprecated usage 기준 이하 |

## 3. 기능별 Rollout 순서

| 기능 | 10% | 30% | 50% | 100% |
|---|---|---|---|---|
| Shared UI | internal users | streamer studio | dashboard all | public all |
| Dashboard Shell | admin | streamers 일부 | streamers majority | all dashboard |
| Overlay Studio | admin only | selected streamer | stage/pro streamer | all streamer |
| Overlay Runtime | mock only | selected OBS source | rehearsal stream | all |
| Public Search | internal route | 10% guest | 50% guest | all guest |
| Participation | selected streamer | streamer cohort | all active streamer | all |
| Community | selected streamer | 30% public | 50% public | all |
| API v1 | internal client | dual read compare | majority client | all client |
| Repository Layer | dev only | stage dual | production shadow | production read |

## 4. Rollout Monitoring

공통 지표:

- error rate
- API latency p95
- LCP/CLS/INP
- bundle load error
- JS runtime error
- auth/session failure
- feature conversion

기능별 지표:

| 기능 | 핵심 지표 |
|---|---|
| Public Search | search success, profile loaded |
| Dashboard | page load, navigation click |
| Overlay | first frame, reconnect, blank frame |
| Participation | join/cancel/manual success |
| Community | post/comment success |
| Tournament | list/detail loaded |
| API v1 | contract mismatch, fallback count |
| Repository | checksum mismatch, write error |

## 5. Rollout 중단 기준

즉시 중단:

- overlay blank frame 1건 이상 확인
- auth failure rate baseline + 1%p
- participation mutation failure
- API 5xx baseline + 0.5%p
- LCP budget 20% 이상 초과
- memory leak 의심

중단 후 조치:

1. feature flag off
2. legacy fallback 확인
3. incident note 작성
4. root cause 분석
5. stage 재검증 후 rollout 재개

## 6. 100% 이후 Cleanup

100% rollout 직후 삭제 금지.

Cleanup 조건:

- production 1 release 안정
- legacy fallback 호출량 기준 이하
- rollback이 더 이상 필요 없다는 승인
- docs 업데이트 완료
- QA baseline 갱신 완료

