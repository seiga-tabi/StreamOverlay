# YORO.gg Dashboard Philosophy v1

문서 상태: 공식 Dashboard 제품 철학  
적용 범위: Streamer Studio, Admin dashboard, Today Live UX

## 1. Dashboard 정의

YORO.gg Dashboard는 관리 화면이 아니다.

Dashboard는 오늘 방송을 성공시키는 화면이다.

스트리머가 Dashboard를 열었을 때 가장 먼저 알아야 하는 것은 설정 목록이 아니라 다음이다.

- 오늘 방송 가능한가?
- 무엇이 연결되어 있지 않은가?
- 지금 열어야 하는 기능은 무엇인가?
- 시청자가 참여할 준비가 되었는가?
- Overlay가 OBS에서 정상적으로 보이는가?

## 2. Today Live 중심 구조

Dashboard 첫 화면은 Today Live여야 한다.

Today Live 구성:

- Broadcast Readiness
- Critical Actions
- Participation State
- Overlay State
- Twitch / OBS State
- Viewer Activity
- Broadcast Summary

## 3. Broadcast Readiness

Broadcast Readiness는 여러 status card를 하나의 판단으로 압축한다.

상태:

- Ready: 방송 준비 완료
- Needs Attention: 일부 기능 확인 필요
- Blocked: 방송 운영 핵심 기능 사용 불가

Readiness는 다음 항목을 포함한다.

- Twitch OAuth
- EventSub
- OBS Bridge
- Overlay Client
- Riot ID
- Participation Queue

## 4. Critical Actions

방송 중 action은 가장 빠르게 접근 가능해야 한다.

필수 action:

- 시참 열기
- 시참 닫기
- 대기열 표시
- 다음 참여자 초대
- Overlay test
- Alert test
- Replay buffer 저장

위험 action은 색상, 문구, 확인 절차로 구분한다.

## 5. Dashboard가 하지 말아야 할 것

- 기술 status를 첫 화면에 같은 무게로 나열하지 않는다.
- 설정과 방송 중 조작을 같은 card에 넣지 않는다.
- 숫자 0만 보여주는 metric card를 반복하지 않는다.
- 긴 설명문으로 첫 화면을 채우지 않는다.
- Admin 기능을 Streamer dashboard에 섞지 않는다.

## 6. Streamer Dashboard 성공 기준

- 스트리머가 1분 안에 방송 가능 상태를 판단한다.
- 핵심 방송 action이 1-depth 안에 있다.
- 위험 action과 일반 action이 명확히 구분된다.
- 모바일에서도 본문이 첫 화면에 나타난다.
- 방송 중 실수를 줄이는 layout을 가진다.

## 7. Dashboard Information Order

권장 정보 순서:

1. 오늘 방송 준비 상태
2. 지금 필요한 action
3. 시청자 참여 상태
4. Overlay 상태
5. Twitch / OBS 연결
6. 최근 이벤트
7. 방송 후 요약
8. 세부 설정

