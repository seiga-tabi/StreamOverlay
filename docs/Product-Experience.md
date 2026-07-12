# YORO.gg Product Experience v1

문서 상태: 공식 Product Experience 기준  
적용 범위: Guest, User, Streamer, Admin journey와 emotion journey

## 1. Product Experience 정의

YORO.gg Product Experience는 사용자가 전적을 확인하는 순간부터 스트리머와 관계를 만들고, 방송에 참여하고, 커뮤니티로 돌아오는 전체 경험이다.

YORO.gg는 기능 단위로 경험을 설계하지 않는다. 사용자가 어떤 감정으로 들어와 어떤 행동을 하고 어떤 관계로 남는지를 기준으로 설계한다.

## 2. Guest Journey

목표: 빠르게 전적을 검색하고, 흥미로운 스트리머 또는 커뮤니티를 발견한다.

Journey:

1. YORO.gg 접속
2. Riot ID 검색
3. 전적 요약 확인
4. 최근 경기와 챔피언 성향 확인
5. 해당 플레이어가 스트리머인지 확인
6. 방송 중이면 Twitch 또는 Streamer Profile로 이동
7. 즐겨찾기 저장 또는 Twitch 로그인

불필요한 방해 요소:

- 첫 화면에서 너무 많은 상위 메뉴
- 검색 전 커뮤니티/대회/팔로우 메뉴 노출 과다
- 빈 즐겨찾기 화면의 약한 행동 유도

성공 기준:

- 3초 안에 검색 가능함을 이해한다.
- 30초 안에 전적과 스트리머 연결 가능성을 이해한다.

## 3. User Journey

목표: 좋아하는 스트리머를 따라가고 방송에 참여한다.

Journey:

1. Twitch 로그인
2. My YORO 진입
3. 팔로우 중인 스트리머 확인
4. 라이브 또는 참여 가능 방송 확인
5. Riot ID로 시참 신청
6. 대기열 상태 확인
7. 방송에서 초대받고 참여
8. 방송 후 커뮤니티 또는 다음 참여로 이어짐

불필요한 방해 요소:

- 팔로우, 구독, 즐겨찾기, 시참이 서로 다른 메뉴에 흩어지는 구조
- 참여 상태를 다시 확인하기 어려운 navigation
- 커뮤니티가 스트리머 맥락 없이 게시판처럼 보이는 구조

성공 기준:

- User가 자신의 참여 상태를 한 번에 확인한다.
- 팔로우 스트리머와 시참 가능 여부가 같은 흐름에 있다.

## 4. Streamer Journey

목표: 오늘 방송을 안전하게 준비하고 시청자 참여를 운영한다.

Journey:

1. Twitch 로그인
2. Riot ID 등록 및 승인
3. Streamer Studio 진입
4. Today Live에서 방송 준비 상태 확인
5. OBS overlay source 확인
6. 시참 열기
7. 대기열과 체크인 관리
8. 다음 참여자 초대
9. 방송 중 overlay 상태 확인
10. 방송 후 summary 확인

불필요한 방해 요소:

- 기술 상태 card가 너무 많아 방송 준비 판단이 늦어짐
- Overlay 연결, 테스트, GIF, Reward가 분리되어 OBS 준비 flow가 끊김
- 방송 중 action과 설정 action이 같은 시각 위계로 노출됨

성공 기준:

- 방송 준비 판단이 1분 안에 끝난다.
- OBS source 설정이 3클릭 안에 끝난다.
- 방송 중 핵심 action이 1-depth 안에 있다.

## 5. Admin Journey

목표: 서비스 안정성, 승인, 위험 action을 관리한다.

Journey:

1. Admin 로그인
2. System Health 확인
3. Twitch / EventSub / Overlay 상태 확인
4. 승인 대기 Riot ID 처리
5. 오류 로그 확인
6. 안전 설정과 API 상태 점검
7. 장애 발생 시 원인과 영향 범위 확인

불필요한 방해 요소:

- Streamer용 운영 화면과 Admin용 시스템 화면 혼재
- Twitch 연결 정보가 여러 화면에 중복 노출
- 이벤트 로그와 action 실패 로그가 분산됨

성공 기준:

- Admin은 장애 여부를 30초 안에 판단한다.
- 승인과 로그는 audit 가능해야 한다.

## 6. Emotion Journey

YORO.gg의 이상적인 감정 흐름은 다음이다.

궁금함  
↓  
검색  
↓  
이해  
↓  
흥미  
↓  
스트리머 발견  
↓  
팔로우  
↓  
참여 신청  
↓  
기대감  
↓  
방송 참여  
↓  
친밀감  
↓  
팬  
↓  
커뮤니티 멤버  
↓  
스트리머 성장  
↓  
다시 검색과 참여

## 7. Experience Anti-Patterns

YORO.gg에서 피해야 하는 경험:

- 사용자가 기능 이름을 이해해야만 목표를 달성하는 경험
- 스트리머가 방송 전 설정 화면을 여러 개 돌아다니는 경험
- User가 자신의 참여 상태를 찾기 위해 메뉴를 헤매는 경험
- Admin 기능이 일반 사용자 flow에 드러나는 경험
- Community가 관계 없이 글 목록으로만 작동하는 경험

## 8. Product Experience 성공 기준

- Guest는 검색에서 발견으로 이동한다.
- User는 팔로우에서 참여로 이동한다.
- Streamer는 설정에서 오늘 방송 운영으로 이동한다.
- Admin은 화면 탐색보다 상태 판단에 집중한다.
- 모든 journey는 North Star Loop로 다시 연결된다.

