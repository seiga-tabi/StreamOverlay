# YORO.gg UI Rules

## 1. YORO.gg UI 원칙

YORO.gg는 일반 관리자 페이지가 아니다. UI는 `전적검색`, `스트리머 플랫폼`, `방송 관리`, `시청자 참여`, `커뮤니티`를 하나의 product experience로 연결해야 한다.

핵심 원칙:

- Liquid Glass
- Pastel Color
- Premium
- Apple 수준의 여백
- Discord 수준의 사용성
- Twitch 수준의 방송 친화성
- KR/JP 서비스 기준

## 2. Persona별 화면 구분

| Persona | 주요 목적 | UI 우선순위 |
|---|---|---|
| Guest | 검색, 스트리머 발견, 커뮤니티 탐색 | 빠른 검색과 명확한 CTA |
| User | 즐겨찾기, 참여 신청, 커뮤니티 활동 | 흐름이 끊기지 않는 참여 경험 |
| Streamer | 오늘 방송 준비와 운영 | 오늘 해야 할 일, OBS, 시참, 알림 |
| Admin | 운영/설정/검증 | 안전하고 명확한 권한 분리 |

Streamer 화면과 Admin 화면을 섞지 않는다.

## 3. Dashboard 원칙

Dashboard는 관리 화면이 아니다. `오늘 방송 운영`을 성공시키는 화면이다.

Dashboard에 우선 배치할 정보:

1. Twitch 연결 상태
2. OBS/Overlay 연결 상태
3. 오늘 시참/queue 상태
4. 오늘 방송에서 필요한 action
5. 최근 문제/경고

금지:

- 단순 통계 카드 나열
- 관리자 설정을 Streamer 첫 화면에 배치
- 오늘 방송과 무관한 정보 과다 노출

## 4. Overlay 원칙

Overlay는 설정 화면이 아니다. OBS Browser Source로 방송 화면에 노출되는 제품이다.

Overlay UI는 다음 흐름을 따른다.

1. Source 선택
2. URL 확인
3. Token 보호
4. Preview
5. Test
6. OBS 적용
7. Live 상태 확인

기존 OBS URL 호환성을 깨지 않는다.

## 5. Community 원칙

Community는 게시판이 아니다. Streamer Community Experience다.

Community는 다음과 연결되어야 한다.

- 스트리머
- 방송 일정
- 참여 모집
- 대회
- 클립/SNS 공유
- 팬 관계

단순 게시글 목록만 만드는 것은 금지한다.

## 6. 새 페이지 추가 조건

새 페이지는 다음 조건을 모두 통과해야 한다.

- 기존 페이지/flow로 해결할 수 없다.
- 어떤 persona를 위한 페이지인지 명확하다.
- North Star Loop에 기여한다.
- Navigation Constitution과 충돌하지 않는다.
- Design System component로 만들 수 있다.
- mobile/tablet/desktop UX가 정의되어 있다.
- legacy route와 rollout 전략이 있다.

## 7. 삭제/통합 우선 원칙

새 화면을 만들기 전에 다음을 먼저 검토한다.

1. 기존 화면 개선
2. 기존 card/section 통합
3. navigation item 축소
4. 중복 CTA 삭제
5. flow 단축

페이지 추가는 마지막 선택지다.

## 8. UI 상태 필수 규칙

모든 interactive UI는 다음 상태를 가져야 한다.

- default
- hover
- focus
- active
- disabled
- loading
- error
- empty
- success

상태가 없는 component는 production UI로 인정하지 않는다.

