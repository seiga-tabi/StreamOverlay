# YORO.gg Overlay Philosophy v1

문서 상태: 공식 Overlay 제품 철학  
적용 범위: Overlay Studio, OBS Browser Source, overlay preview, test flow

## 1. Overlay 정의

Overlay는 설정 화면이 아니다.

Overlay는 방송 화면이다.

스트리머가 Overlay Studio를 사용할 때의 목표는 CSS나 URL을 이해하는 것이 아니라 OBS에서 올바른 Source를 만들고 방송 화면에 안전하게 표시하는 것이다.

## 2. OBS 기준 설계

Overlay Studio는 OBS 사용 흐름을 기준으로 설계한다.

기본 흐름:

1. Source 선택
2. Preview 확인
3. URL 복사
4. OBS Browser Source에 붙여넣기
5. Test event 실행
6. Live status 확인
7. 문제 발생 시 해결 안내

## 3. Overlay Source Presets

Overlay는 channel URL이 아니라 Source Preset으로 제공한다.

필수 source:

- Alerts
- Chat
- Participation Queue
- Solo Rank
- Subtitles
- Questions
- Mission

각 source card는 다음을 포함한다.

- Source name
- 사용 목적
- Preview
- Copy URL
- Open
- Test
- Connected status
- Recommended OBS size

## 4. Overlay Visual Rule

Overlay는 YORO.gg 제품 언어와 연결되어야 한다.

허용:

- 방송 친화적 대비
- 읽기 쉬운 큰 글자
- 게임 화면을 침범하지 않는 layout
- KR / JP bilingual display
- animation entrance / exit

금지:

- Dashboard와 완전히 다른 브랜드처럼 보이는 theme
- 과도한 장식 border
- 게임 화면 대부분을 덮는 기본 layout
- source 간 서로 다른 디자인 언어
- preview와 실제 OBS 출력의 불일치

## 5. Overlay Safety

Overlay는 방송 중 실패해도 화면을 망치지 않아야 한다.

필수 안전 기준:

- reconnect 상태는 사용자가 이해 가능한 언어로 표시한다.
- mock preview와 live mode를 명확히 구분한다.
- source별 safe area를 정의한다.
- text overflow를 방지한다.
- emergency overlay는 가장 높은 우선순위를 갖는다.

## 6. Overlay Studio 성공 기준

- OBS 설정이 3클릭 안에 가능하다.
- 스트리머가 어떤 URL을 어디에 넣어야 하는지 즉시 이해한다.
- 각 source가 실제 방송에서 어떻게 보이는지 확인 가능하다.
- Test event가 source별로 제공된다.
- Overlay와 Dashboard가 같은 제품처럼 보인다.

