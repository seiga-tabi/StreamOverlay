# Twitch Chat Sender

## 목적

StreamOps의 `twitch.chat` action은 `TwitchChatService`를 통해서만 Twitch Send Chat Message API를 호출합니다. 이 서비스는 token provider, `broadcaster_id`, `sender_id`, message sanitization, queue/throttle, cooldown, 실패 기록을 한 곳에서 관리합니다.

## 필요한 scope

MVP 모드는 OAuth로 연결된 broadcaster user access token을 사용합니다.

- 채팅 발송: `user:write:chat`
- 채팅 읽기 및 명령 수신: `user:read:chat`

`sender_id`는 user access token의 user id와 일치해야 합니다.
채팅 명령어 수신은 `channel.chat.message` EventSub notification을 사용하므로 `.env`에서 `TWITCH_ENABLE_EVENTSUB=true`여야 합니다.

## `.env` 설정

```text
TWITCH_CHAT_MODE=broadcaster
TWITCH_CHAT_THROTTLE_MS=1500
TWITCH_CHAT_COOLDOWN_MS=10000
TWITCH_CHAT_MAX_QUEUE=20
TWITCH_CHAT_MAX_LENGTH=500
TWITCH_CHAT_TEMPLATE_VALUE_MAX_LENGTH=120
```

## broadcaster token MVP 모드

`TWITCH_CHAT_MODE=broadcaster`가 기본값입니다. 이 모드에서는 연결된 broadcaster OAuth token을 사용하고, `sender_id`도 `broadcaster_id`로 고정합니다.

장점:

- token store가 단순합니다.
- 방송자 본인 채팅 발송이 바로 동작합니다.
- `user:write:chat`만 있으면 MVP를 구성할 수 있습니다.

주의:

- 채팅에는 방송자 계정 이름으로 메시지가 표시됩니다.
- 방송자 token 권한을 너무 넓히지 않도록 `TWITCH_EXTRA_SCOPES`는 최소로 유지합니다.

## bot account 모드

`TWITCH_CHAT_MODE=bot`은 별도 bot 계정 token provider를 붙이기 위한 구조입니다. 현재 기본 token store는 broadcaster OAuth token 1개만 저장하므로, 운영 bot 계정을 분리하려면 token store를 역할별로 확장해야 합니다.

권장 구조:

- broadcaster token: EventSub, 채널 포인트, 방송자 정보 조회
- bot token: 채팅 발송
- bot sender id: bot token의 user id

Twitch의 app access token 기반 chatbot 구조를 사용할 경우 별도 권한 모델이 필요합니다.

- sender 계정: `user:write:chat`, `user:bot`
- broadcaster 채널: `channel:bot`, 단 sender가 moderator면 예외 가능

## 안전 처리

- 채팅 메시지는 최대 500자로 제한합니다.
- template placeholder 값은 별도 길이 제한을 적용합니다.
- 제어문자와 줄바꿈은 공백으로 정리합니다.
- token, secret, `Bearer ...`, `oauth:...` 형태 문자열은 redaction 후 발송합니다.
- 같은 메시지는 cooldown 동안 반복 발송하지 않습니다.
- queue가 가득 차면 발송하지 않고 실패로 기록합니다.
- 모든 실패는 `errors.jsonl`에 기록하지만 access token, refresh token, client secret은 기록하지 않습니다.

## Dashboard 상태

`/api/twitch/status` 응답의 `chat` 필드에서 다음 정보를 확인할 수 있습니다.

- mode
- queueSize
- throttleMs
- cooldownMs
- maxMessageLength
- lastSentAt
- lastFailureAt
- recentFailures

Dashboard의 Twitch 연결 카드에서도 최근 채팅 발송 실패를 확인할 수 있습니다.
