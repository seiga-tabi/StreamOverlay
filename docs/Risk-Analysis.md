# YORO.gg Migration Risk Analysis

## 1. Risk Level 기준

| 등급 | 의미 |
|---|---|
| 낮음 | 문서/구조/이동 중심이며 runtime 영향이 거의 없음 |
| 중간 | UI/API behavior에 영향 가능성이 있으나 rollback이 단순함 |
| 높음 | 방송 운영, OBS, 인증, 데이터 정합성, public conversion에 직접 영향 |

## 2. 주요 Risk Matrix

| 작업 | 위험도 | 위험 | 완화 | Rollback |
|---|---|---|---|---|
| Folder skeleton 추가 | 낮음 | import 혼란 | legacy export 유지 | 폴더 추가 PR revert |
| Dashboard shell 분리 | 중간 | role별 page 접근 오류 | role matrix test | 기존 `App.tsx` switch 유지 |
| Navigation 재편 | 중간 | streamer/admin menu 오노출 | server auth와 client gate 중복 | 기존 pages array 복구 |
| `PublicLolPage` 분해 | 높음 | 검색/참여/커뮤니티 회귀 | strangler wrapper, route parity test | legacy page fallback |
| CSS token 도입 | 중간 | visual regression | token alias, screenshot diff | token file revert |
| CSS 파일 분리 | 중간 | cascade order 변화 | layer order 고정 | 기존 `index.css` import 복구 |
| Overlay app state 분리 | 높음 | OBS 화면 미표시 | mock/preview/live 3단 검증 | 기존 `App.tsx` fallback |
| Overlay channel 정합성 | 높음 | source URL 불일치 | shared `OVERLAY_CHANNELS` 사용 | 기존 hardcoded list 유지 |
| API v1 도입 | 중간 | client endpoint mismatch | legacy adapter와 contract test | v1 route disable |
| `http-api.ts` controller 분리 | 높음 | auth/rate limit 누락 | middleware parity checklist | monolith route 우선 매칭 |
| Store repository 추상화 | 높음 | state persistence 오류 | behavior tests, fixture compare | direct Store path 복구 |
| Prisma 도입 | 높음 | data loss, relation mismatch | dual write, backup, checksum | JSON read fallback |
| Twitch auth 분리 | 높음 | streamer login 실패 | auth callback integration test | legacy auth route 유지 |
| Participation flow 변경 | 높음 | 방송 중 시참 queue 손상 | manual control test, event replay | queue snapshot restore |
| Community 재편 | 중간 | post/comment 권한 오류 | public write policy 명확화 | legacy endpoint 유지 |
| Tournament 재편 | 중간 | slug/detail route 오류 | slug contract test | legacy tournament routes |
| Docker/deploy 변경 | 높음 | production boot 실패 | staging compose 검증 | 이전 image tag redeploy |
| Dependency 추가 | 중간 | bundle/runtime 증가 | Architecture Governance 승인 | dependency removal PR |

## 3. Broadcasting Critical Risk

다음 작업은 방송 중 또는 방송 직전 배포하지 않는다.

- overlay app socket/cache/reducer 변경
- bridge auth/OBS command 변경
- ActionDispatcher 변경
- participation queue mutation 변경
- Twitch EventSub lifecycle 변경
- Docker production env 변경

배포 가능 시간:

- 방송 없는 날
- 충분한 OBS preview 검증 후
- rollback image와 env backup이 준비된 상태

## 4. Data Risk

현재 JSON Store 기반 데이터는 다음 위험을 갖는다.

- domain별 transaction boundary가 약하다.
- schema evolution이 파일 구조에 암묵적으로 묶여 있다.
- 동시 write와 partial write에 취약할 수 있다.
- query/index 최적화가 어렵다.

완화 원칙:

1. JSON 파일별 owner를 정한다.
2. repository interface 전 behavior test를 만든다.
3. migration 전 export/import script를 만든다.
4. Prisma 도입 시 dual write와 checksum 기간을 둔다.
5. destructive migration은 production JSON backup 검증 전 금지한다.

## 5. UX Risk

| 영역 | 위험 | 완화 |
|---|---|---|
| Guest search | 첫 검색 성공률 하락 | 검색 input과 result 위치 고정 |
| Streamer dashboard | 오늘 해야 할 일이 숨겨짐 | `Today Broadcast` widget 우선 |
| Overlay Studio | OBS URL 복사 실수 | URL, token, mode를 한 flow에 배치 |
| Community | 게시판처럼 보임 | streamer context, participation, clips, schedule 연결 |
| Admin | streamer flow와 섞임 | Admin surface 분리 |

## 6. Technical Debt Risk

방치 시 유지보수가 어려운 부분:

- page가 API/state/UI를 모두 소유하는 구조
- global CSS selector 누적
- API response type이 client/server에 분산됨
- dashboard와 overlay channel list 불일치
- Store class에 domain이 계속 추가되는 구조
- role별 navigation이 product IA와 함께 관리되지 않는 구조

해결 우선순위:

1. API/WS contract shared화
2. CSS token/layer 분리
3. feature folder boundary
4. repository interface
5. app shell/provider 분리

