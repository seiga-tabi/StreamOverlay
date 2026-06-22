# Overlay

## OBS Browser Source 추가

1. OBS에서 Sources에 `Browser`를 추가합니다.
2. URL에 필요한 overlay mode URL을 입력합니다.
3. 대부분의 overlay는 Width `1920`, Height `1080`을 사용합니다. 채팅 overlay는 Width `470`, Height `590`을 사용합니다.
4. `Shutdown source when not visible`과 `Refresh browser when scene becomes active`는 방송 구성에 맞게 선택합니다.
5. 배경은 투명으로 렌더링됩니다.

## Overlay URL 목록

개발 기본 URL은 `http://localhost:5174`입니다. Docker 운영 배포에서는 server가 `/overlay/`를 직접 서빙하므로 `https://bot.example.com/overlay/?mode=events` 형식을 사용합니다.

- 이벤트 배너: `http://localhost:5174/?mode=events`
- 채팅: `http://localhost:5174/?mode=chat`
- 한일 자막: `http://localhost:5174/?mode=subtitles`
- 질문: `http://localhost:5174/?mode=questions`
- 미션: `http://localhost:5174/?mode=mission`
- 롤 시참: `http://localhost:5174/?mode=participation`
- 전체 확인: `http://localhost:5174/?mode=all`

서버 WebSocket은 같은 mode를 channel로 사용합니다.

- `ws://localhost:3000/ws/overlay?channel=events`
- `ws://localhost:3000/ws/overlay?channel=chat`
- `ws://localhost:3000/ws/overlay?channel=subtitles`
- `ws://localhost:3000/ws/overlay?channel=questions`
- `ws://localhost:3000/ws/overlay?channel=mission`
- `ws://localhost:3000/ws/overlay?channel=participation`
- `ws://localhost:3000/ws/overlay?channel=all`

## 각 overlay mode

### events

방송 이벤트 배너를 표시합니다.

- 팔로우
- 채널 포인트 사용
- 구독
- Bits/Cheer
- Raid
- stream.online/offline
- 내부 dashboard 테스트
- emergency 안내

이벤트 배너는 `https://link.seigatabi.com/`의 파스텔 스카이블루, 반투명 paper card, 얇은 내부 라인, 상단 색띠 느낌을 참고한 밝은 알림 디자인을 사용합니다.

## 알림 GIF/효과음 등록

알림에 GIF 이미지와 효과음을 붙이려면 asset 파일을 `apps/overlay/public/alerts`에 넣고 `apps/server/config/alert-overlays.json`에서 참조합니다. Docker 빌드 후에는 `/overlay/alerts/...`가 아니라 overlay 앱 기준 `/alerts/...` 경로로 접근됩니다.

예시:

```json
{
  "follow": {
    "enabled": true,
    "mediaUrl": "/alerts/follow.gif",
    "soundUrl": "/alerts/follow.mp3",
    "soundVolume": 0.65,
    "speechEnabled": true,
    "speechLanguage": "ja-JP"
  },
  "cheer": {
    "mediaUrl": "/alerts/cheer.gif",
    "soundUrl": "/alerts/cheer.wav"
  },
  "subscription": {
    "mediaUrl": "https://example.com/subscription.gif",
    "soundUrl": "https://example.com/subscription.mp3"
  }
}
```

`mediaUrl`, `soundUrl`, `speechAudioUrl`은 `https://` URL, `/alerts/...` 또는 서버가 생성한 `/tts/...` 경로만 허용합니다. 파일이 없거나 재생이 실패해도 알림 카드 자체는 표시되고 기본 마크로 대체됩니다.

## 알림 읽어주기

`overlay.banner`는 `speechEnabled: true`일 때 알림을 읽습니다. 기본 언어는 `ja-JP`이며, `speechText`가 없으면 화면에 표시되는 일본어 `title`과 `message`를 읽습니다.

서버에서 `LOCAL_TTS_ENABLED=true`를 설정하면 일본어 알림은 로컬 TTS 엔진으로 WAV를 생성해 `/tts/...wav`로 overlay에 전달합니다. Docker Compose 기본 구성은 Seoya TTS 엔진이 VOICEVOX를 호출하는 방식입니다. 로컬 TTS가 꺼져 있거나 생성에 실패하면 기존 Web Speech API 방식으로 fallback합니다.

TTS가 있는 알림은 `durationMs`를 최소 표시 시간으로 사용하고, 음성 재생이 끝난 뒤 알림을 닫습니다. 음성 재생이 실패하거나 브라우저 TTS를 사용할 수 없으면 기존 표시 시간 이후 안전하게 닫힙니다.

사용 가능한 TTS 설정:

- `speechEnabled`: 읽어주기 사용 여부
- `speechText`: 화면 문구와 별도로 읽을 일본어 문장
- `speechAudioUrl`: 서버가 생성한 로컬 TTS WAV 경로입니다. 일반 설정에서는 직접 넣지 않고 서버가 자동으로 채웁니다.
- `speechLanguage`: `ja-JP` 또는 `ko-KR`
- `speechRate`, `speechPitch`: `0.5`에서 `1.5`
- `speechVolume`: `0`에서 `1`

로컬 일본어 TTS 설정 예시:

```env
LOCAL_TTS_ENABLED=true
LOCAL_TTS_PROVIDER=seoya
LOCAL_TTS_BASE_URL=http://tts-engine:8787
LOCAL_TTS_SPEAKER=3
LOCAL_TTS_BROADCAST_WAIT_MS=15000
LOCAL_TTS_TIMEOUT_MS=15000
LOCAL_TTS_MAX_TEXT_LENGTH=300
LOCAL_TTS_CACHE_DIR=/app/.streamops/tts-cache
```

자세한 설정과 테스트 방법은 [LOCAL_TTS.md](./LOCAL_TTS.md)를 참고합니다.

OBS Browser Source의 음소거, 시스템 음성 엔진, 브라우저 autoplay 정책에 따라 음성이 재생되지 않을 수 있습니다. 이 경우에도 화면 알림과 효과음 처리는 계속 동작합니다.

### chat

LINE 채팅창 느낌의 Twitch 채팅 overlay를 표시합니다.

- OBS Browser Source 권장 크기: `470 x 590`
- URL: `http://localhost:5174/?mode=chat`
- Docker 운영 URL 예: `https://bot.example.com/overlay/?mode=chat`
- 일반 채팅만 표시하고, 기본 설정에서는 `!질문`, `!시참` 같은 명령어 메시지는 숨깁니다.
- 표시되는 데이터는 display name, 정리된 message, 생성 시간, broadcaster 여부, Twitch 프로필사진, Twitch emote, 선택적 한일 번역문입니다.
- 채팅 번역 설정은 [CHAT_TRANSLATION.md](./CHAT_TRANSLATION.md)를 참고합니다.

### subtitles

한국어 원문과 일본어 번역을 표시합니다.

- partial/final 구분
- 자동번역 오류 가능성 안내
- subtitle boost badge

### questions

현재 선택된 질문 1개를 표시합니다.

- Twitch display name
- 원문 질문
- 번역 질문
- duration 이후 자동 fade out

### mission

오늘 방송 목표를 표시합니다.

- dashboard 테스트 action
- 채널 포인트 또는 운영 action에서 갱신 가능

### participation

롤 시참 상태를 표시합니다.

- 모집 상태
- Riot Spectator API 기반 `ゲーム中`, `試合終了` 상태
- 대기열 최대 4명과 생략 인원
- 자동 선정된 참가자의 대기열 상태
- 팀 A/B

Riot ID는 기본 overlay message schema에 포함하지 않습니다. public overlay에는 Twitch display name만 표시합니다.

### all

개발 확인용 전체 overlay입니다. 실제 방송에서는 scene별로 필요한 mode만 Browser Source로 분리하는 구성을 권장합니다.

## 테스트 방법

Dashboard의 `안전한 액션 테스트`에서 다음 테스트 메시지를 보낼 수 있습니다.

- 테스트 배너
- 테스트 팔로우 알림
- 테스트 비트 알림
- 테스트 구독 알림
- 테스트 자막
- 테스트 질문
- 테스트 시참 대기열
- 테스트 미션

서버 없이 UI만 확인하려면 mock mode를 사용합니다.

```text
http://localhost:5174/?mode=all&mock=1
http://localhost:5174/?mode=chat&mock=1
```

## 보안 주의사항

- Twitch token, refresh token, client secret을 overlay message에 넣지 않습니다.
- Twitch raw EventSub payload 전체를 overlay로 보내지 않습니다.
- overlay message는 `packages/shared`의 schema validation을 통과해야 전송됩니다.
- chat overlay는 Twitch raw chat payload를 표시하지 않고 정리된 텍스트만 표시합니다.
- viewer input은 React text rendering으로 표시하며 `dangerouslySetInnerHTML`을 사용하지 않습니다.
- 임의 URL iframe/embed 기능을 추가하지 않습니다.
- overlay는 OBS를 직접 제어하지 않습니다.
- participation overlay에는 Riot ID를 넣지 않습니다.

## 복구 동작

Overlay WebSocket client가 reconnect하면 서버가 마지막 안전 상태를 다시 전송합니다. Mission, participation queue/status, teams 같은 상태성 메시지는 유지되고, banner/question/subtitle처럼 duration이 있는 메시지는 만료 전까지만 복구됩니다.
