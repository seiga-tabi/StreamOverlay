# Dashboard 운영 화면

Dashboard는 방송 전에 Twitch 연결, EventSub, OBS overlay 상태를 확인하기 위한 운영 콘솔입니다.

## Twitch 연결 화면

`Twitch 연결` 메뉴에서 다음 항목을 확인합니다.

- Twitch 연결 상태
- 연결된 broadcaster display name
- broadcaster ID
- token 만료 시각
- granted scopes
- missing scopes
- EventSub WebSocket 상태
- active/failed subscriptions
- 최근 채팅 발송 실패

관리자 버튼은 다음 작업만 제공합니다.

- Twitch OAuth 연결 시작
- Twitch OAuth 재연결
- OAuth token refresh
- Twitch 연결 해제
- EventSub 재연결 / 재구독

Twitch token, refresh token, client secret 값은 Dashboard에 표시하지 않습니다.

## Overlay 운영 화면

`Overlay 운영` 메뉴에서 OBS Browser Source용 URL과 연결 상태를 확인합니다.

사용 가능한 URL은 다음 mode를 지원합니다.

- `events`
- `subtitles`
- `questions`
- `mission`
- `participation`
- `all`

OBS Browser Source 권장 설정:

- 필요한 mode URL을 Source URL로 사용합니다.
- 권장 해상도는 `1920 x 1080`입니다.
- overlay는 투명 배경으로 렌더링됩니다.

## Overlay 테스트

Overlay 테스트 패널은 고정된 안전 payload만 전송합니다.

- 배너
- 자막
- 질문
- 시참 대기열
- 미션

임의 action type 입력칸은 제공하지 않습니다. viewer input으로 임의 overlay action을 만들 수 없습니다.

## Reward 매핑

Reward Mapping 패널은 `reward-actions.json`을 read-only로 보여줍니다.

- config key
- `reward_id` 또는 title fallback 여부
- overlay action 포함 여부
- action type 목록
- `cooldownMs`
- `maxPerStream`

title fallback warning이 표시되면 가능한 한 Twitch reward ID 기반 key로 바꾸는 것을 권장합니다.

## 보안 주의사항

- Twitch token 값을 Dashboard에 표시하지 마세요.
- `TWITCH_CLIENT_SECRET`은 서버 환경변수로만 관리하세요.
- overlay 테스트는 고정 payload만 사용하세요.
- 위험 action type 입력 UI를 추가하지 마세요.
- OBS 제어는 기존 allowlist action 경로만 사용하세요.
