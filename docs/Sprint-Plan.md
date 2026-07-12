# YORO.gg Migration Sprint Plan

## 1. Sprint 운영 원칙

- 각 Sprint는 production behavior를 유지하는 것을 기본 완료 조건으로 둔다.
- PR은 가능한 한 feature boundary 하나 또는 layer 하나만 다룬다.
- UI 변경 Sprint도 기존 방송 운영 flow를 깨지 않는 preview/feature flag를 둔다.
- DB 관련 Sprint는 destructive migration을 금지한다.

## Sprint 1: Foundation Inventory and Boundary

목표: 현행 구조를 고정하고 migration이 가능한 최소 architecture boundary를 만든다.

작업:

- page, component, CSS, API, WebSocket, store inventory 작성
- dashboard/overlay/server target folder skeleton 설계
- API route map과 role matrix 작성
- Design Token naming 확정
- shared API/WS contract 후보 목록 작성
- build/test baseline 기록

완료 조건:

- 기존 코드 동작 변경 없음
- 현행 endpoint와 target endpoint mapping 완료
- CSS token inventory 완료
- folder migration PR 기준 확정

위험도: 낮음

## Sprint 2: Dashboard App Shell Migration

목표: Dashboard를 `오늘 방송 운영` 중심 shell로 이전할 수 있는 구조를 만든다.

작업:

- `Public`, `My YORO`, `Streamer Studio`, `Admin` surface 구분
- auth/session provider boundary 설계
- navigation item과 role gate를 data-driven 구조로 이전
- `DashboardPage`를 `TodayBroadcast` widget 기준으로 재구성할 준비
- dashboard socket message contract 초안 도입

완료 조건:

- admin/streamer login flow 유지
- 기존 dashboard pages 접근 가능
- streamer에게 admin-only menu가 노출되지 않음
- navigation 추가/삭제 규칙 적용 가능

위험도: 중간

## Sprint 3: Public Search and Profile Strangler Migration

목표: `PublicLolPage`를 feature 단위로 분리하기 시작한다.

작업:

- Search API client 분리
- recent search/favorite/localStorage adapter 분리
- Search input, suggestion, result loading state 추출
- Profile summary, match history, expanded match view 추출
- public route state와 feature state 분리

완료 조건:

- `/`, `/lol`, profile search flow 유지
- 검색, 더보기, 매치 확장, 룬/빌드 로딩 회귀 없음
- KR/JP locale 유지
- bundle split 기준 측정 가능

위험도: 높음

## Sprint 4: Overlay Studio and OBS Flow Migration

목표: Overlay를 OBS 사용 흐름 기준으로 재편한다.

작업:

- overlay source URL 생성 규칙을 shared contract로 고정
- dashboard overlay status/test/rewards/alerts를 `Overlay Studio` feature로 통합
- overlay app socket/cache/reducer 분리
- channel list를 `OVERLAY_CHANNELS` contract 기준으로 일치
- OBS preview, copy URL, test action, connection status flow 정리

완료 조건:

- 기존 OBS Browser Source URL 유지
- overlay token auth 유지
- reconnect/reload behavior 유지
- event/chat/participation/solo-rank preview 정상
- subtitles/questions/mission channel 정책 명확화

위험도: 높음

## Sprint 5: Community, Participation, Tournament, API v1, Repository Prep

목표: 제품 핵심 loop를 feature boundary로 정리하고 backend migration 기반을 만든다.

작업:

- Community를 streamer community feature로 분리
- Participation queue, join, manual control domain service 분리
- Tournament public/detail/streamer manage API 분리
- `/api/v1/public`, `/api/v1/me`, `/api/v1/streamer`, `/api/v1/admin` adapter 도입
- JSON Store repository interface 설계
- Prisma model draft 작성

완료 조건:

- 기존 public community/participation/tournament flow 유지
- API v1과 legacy endpoint가 동일 contract로 응답
- Store 직접 접근 제거 계획이 issue/PR로 분해됨
- Prisma 도입 전 rollback plan 승인

위험도: 높음

## Sprint별 Definition of Done 요약

| Sprint | DoD 핵심 |
|---|---|
| 1 | inventory와 migration map 승인 |
| 2 | Dashboard shell/role/navigation boundary 검증 |
| 3 | Search/Profile feature 분리 후 회귀 없음 |
| 4 | OBS overlay flow와 channel contract 정합성 확보 |
| 5 | API v1 adapter와 repository migration 준비 완료 |

## 권장 Sprint 기간

| Sprint | 권장 기간 |
|---|---|
| Sprint 1 | 1주 |
| Sprint 2 | 1~2주 |
| Sprint 3 | 2주 |
| Sprint 4 | 2주 |
| Sprint 5 | 2~3주 |

