# YORO.gg Navigation Constitution v1

문서 상태: 공식 Navigation 기준  
적용 범위: Public, My YORO, Streamer Studio, Overlay Studio, Admin

## 1. Navigation의 목적

YORO.gg Navigation은 기능 목록이 아니라 사용자의 목표를 안내하는 구조이다.

Navigation은 persona별로 분리되어야 하며, 기술 구현 단위가 그대로 노출되면 안 된다.

## 2. Product Navigation 영역

YORO.gg의 최상위 navigation은 다음 영역으로 구성한다.

- Public
- My YORO
- Streamer Studio
- Overlay Studio
- Admin

## 3. Public Navigation

Public Navigation은 Guest와 신규 User를 위한 구조이다.

주요 메뉴:

- Search
- Rankings
- Streamers
- Community
- Tournaments

규칙:

- 검색은 항상 가장 빠르게 접근 가능해야 한다.
- Streamers는 전적검색과 방송 참여를 연결하는 핵심 메뉴이다.
- Community는 게시판이 아니라 Streamer Community로 표현한다.
- Tournaments는 독립 콘텐츠가 아니라 스트리머 이벤트로 연결한다.

## 4. My YORO Navigation

My YORO는 로그인 User의 개인 공간이다.

주요 메뉴:

- My Streamers
- Favorites
- Participation
- Posts / Comments
- Account

규칙:

- 즐겨찾기, 팔로우, 구독 상태는 Public nav에 흩어지지 않고 My YORO로 묶는다.
- 시참 신청 상태는 User가 가장 쉽게 다시 확인할 수 있어야 한다.

## 5. Streamer Studio Navigation

Streamer Studio는 방송 운영 공간이다.

주요 메뉴:

- Today Live
- Participation
- Community
- Followers
- Tournament Host
- Broadcast Summary

규칙:

- 첫 화면은 항상 Today Live이다.
- 설정은 첫 화면보다 아래 우선순위이다.
- 방송 중 필요한 action은 1-depth 안에 있어야 한다.

## 6. Overlay Studio Navigation

Overlay Studio는 OBS Source 설정과 방송 화면 검수 공간이다.

주요 메뉴:

- Sources
- Preview
- Alerts
- Chat
- Participation
- Solo Rank
- Subtitles
- Mission
- Triggers

규칙:

- Overlay는 URL 목록이 아니라 OBS Source preset으로 보여준다.
- 각 source는 Copy URL, Preview, Test, Status를 같은 card 안에서 제공한다.
- 실제 방송에 나가는 화면과 dashboard preview가 같은 visual language를 가져야 한다.

## 7. Admin Navigation

Admin은 운영자 전용 공간이다.

주요 메뉴:

- System Health
- Approvals
- Logs
- Safety
- Settings

규칙:

- Admin 기능은 Streamer Studio와 섞지 않는다.
- Admin nav는 장애 대응 우선순위로 정렬한다.
- 승인, 권한, 로그는 audit 가능해야 한다.

## 8. 새 메뉴 추가 조건

새 메뉴는 다음 조건을 모두 만족해야 한다.

- 기존 메뉴 안의 feature로 해결할 수 없다.
- 독립적인 user goal이 있다.
- persona가 명확하다.
- North Star Loop에 기여한다.
- 최소 3개 이상의 하위 action 또는 view가 있다.
- 6개월 이상 유지될 제품 영역이다.

## 9. 메뉴 삭제 조건

메뉴는 다음 조건 중 하나를 만족하면 삭제 또는 통합한다.

- 독립 user goal이 없다.
- 다른 메뉴와 목적이 중복된다.
- 기능 구현 단위만 나타낸다.
- 사용자가 다음 행동을 이해하지 못한다.
- 1개 card만 가진 얕은 화면이다.

## 10. Breadcrumb 규칙

Breadcrumb는 depth가 2 이상일 때 사용한다.

형식:

- Product Area / Feature / Detail

예:

- Streamer Studio / Participation / Queue Detail
- Overlay Studio / Sources / Chat
- Admin / Approvals / Riot ID Request

Breadcrumb는 모바일에서 생략 가능하지만 back action은 유지해야 한다.

