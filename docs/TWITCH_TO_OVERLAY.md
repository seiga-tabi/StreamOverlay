# Twitch 이벤트에서 Overlay까지

이 문서는 Twitch EventSub 이벤트가 OBS Browser Source overlay로 표시되는 경로를 설명합니다.

## 처리 흐름

1. `TwitchEventSubClient`가 Twitch WebSocket notification을 수신합니다.
2. raw payload는 `events.jsonl`에만 저장하고, overlay에는 보내지 않습니다.
3. 서버는 payload를 `twitch.rewardRedemption`, `twitch.chatMessage`, `twitch.streamOnline` 같은 내부 이벤트로 정규화합니다.
4. 각 module이 내부 이벤트를 allowlist action으로 변환합니다.
5. `ActionDispatcher`가 action schema를 검증하고 `overlay.*` action만 `OverlayHub`로 전달합니다.
6. `OverlayHub`가 shared overlay schema를 다시 검증한 뒤 channel별 WebSocket client에 전송합니다.

## 연결된 이벤트

- `channel.channel_points_custom_reward_redemption.add`
  - `reward-actions.json`에서 `reward_id`를 우선 매핑합니다.
  - title fallback을 사용하면 `events.jsonl`에 warning을 남깁니다.
  - `defaultOverlayBanner`를 켜면 기본 `overlay.banner`를 action router로 실행합니다.

- `channel.chat.message`
  - `chat-commands.json`에 등록된 명령만 처리합니다.
  - `!질문`, `!question`, `!質問`은 `queue.question` 후 `overlay.question`으로 현재 질문을 표시할 수 있습니다.
  - `!클립`, `!clip`, `!クリップ`은 `log.highlight` 후 선택적으로 `overlay.banner`를 표시합니다.
  - 일반 채팅은 overlay로 전송하지 않습니다.

- `stream.online`
  - dashboard `status.stream`을 `online`으로 갱신합니다.
  - `stream-events.json`의 `stream.online` action을 실행합니다.

- `stream.offline`
  - dashboard `status.stream`을 `offline`으로 갱신합니다.
  - `postStreamReportReady` flag만 켭니다.

- `channel.follow`, `channel.raid`, `channel.cheer`, `channel.subscribe`, `channel.subscription.message`
  - `twitchOverlay` module이 안전한 `overlay.banner`로 표시합니다.
  - 해당 EventSub subscription은 scopes와 config가 준비된 경우에만 활성화하세요.
  - 팔로우 알림은 `channel.follow` EventSub v2를 사용하며 `moderator:read:followers` scope가 필요합니다.

## 안전 처리

- overlay message는 `packages/shared`의 overlay schema를 통과해야 합니다.
- viewer display name과 input은 서버에서 길이 제한, 제어문자 제거, `<`/`>` 제거를 거칩니다.
- Twitch token, refresh token, client secret, Riot ID는 overlay message schema에 포함하지 않습니다.
- raw Twitch payload 전체는 public overlay로 보내지 않습니다.
- overlay action은 OBS command로 변환되지 않습니다. OBS 제어는 기존 `obs.*` allowlist action 경로만 사용합니다.
- 동일 overlay message는 짧은 cooldown으로 중복 표시를 줄입니다.

## Config 예시

팔로우/비트/구독/레이드 알림을 받으려면 환경변수에서 필요한 EventSub subscription을 켭니다. 예:

```bash
TWITCH_EVENTSUB_SUBSCRIPTIONS="stream.online stream.offline channel.chat.message channel.channel_points_custom_reward_redemption.add channel.follow channel.cheer channel.subscribe channel.subscription.message channel.raid"
TWITCH_EXTRA_SCOPES="moderator:read:followers bits:read channel:read:subscriptions"
```

구독과 Bits/Cheer 후원 알림을 실제로 받으려면 위 subscription과 scope를 모두 설정한 뒤 Twitch OAuth를 다시 승인해야 합니다. `TWITCH_EXTRA_SCOPES`를 바꿔도 기존 token 권한은 자동으로 늘어나지 않습니다.

`apps/server/config/reward-actions.json`

```json
{
  "reward-id-or-title": {
    "name": "화면 흔들기",
    "cooldownMs": 5000,
    "defaultOverlayBanner": {
      "title": "화면 흔들기!",
      "subtitle": "画面揺らし / 화면 흔들기",
      "message": "{user}님이 화면 흔들기를 발동했습니다.",
      "variant": "success",
      "durationMs": 4000,
      "mediaUrl": "/alerts/reward.gif",
      "soundUrl": "/alerts/reward.mp3",
      "soundVolume": 0.65,
      "speechEnabled": true,
      "speechLanguage": "ja-JP"
    },
    "actions": []
  }
}
```

`apps/server/config/chat-commands.json`

```json
{
  "!질문": [
    { "type": "queue.question", "question": "{input}", "userName": "{user}" },
    { "type": "overlay.question", "userName": "{user}", "question": "{input}", "durationMs": 12000 }
  ]
}
```

`apps/server/config/stream-events.json`

```json
{
  "stream.online": [
    { "type": "overlay.banner", "title": "Stream Online", "message": "방송이 시작되었습니다!", "variant": "success" }
  ],
  "stream.offline": [
    { "type": "overlay.banner", "title": "Stream Offline", "message": "방송 종료 처리 중입니다.", "variant": "info" }
  ]
}
```

## 검증

설정을 바꾼 뒤 아래 명령을 실행하세요.

```bash
npm run build
npm run validate:config
npm test
```
