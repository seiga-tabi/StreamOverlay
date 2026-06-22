# Twitch OAuth 연동

## Twitch Developer Console 설정

1. Twitch Developer Console에서 새 Application을 생성합니다.
2. OAuth Redirect URL에 서버 callback URL을 등록합니다.
   - 개발 기본값: `http://localhost:3000/api/twitch/auth/callback`
3. Client ID와 Client Secret을 서버 `.env`에만 저장합니다.

## `.env` 설정

```text
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/api/twitch/auth/callback
TWITCH_EXTRA_SCOPES=
TWITCH_ENABLE_EVENTSUB=true
TWITCH_EVENTSUB_SUBSCRIPTIONS=stream.online stream.offline channel.chat.message channel.channel_points_custom_reward_redemption.add
TWITCH_TOKEN_STORE_PATH=
DASHBOARD_BASE_URL=http://localhost:5173
```

`TWITCH_TOKEN_STORE_PATH`를 비워두면 기본값은 프로젝트 루트의 `.streamops/twitch-token.json`입니다. 이 경로는 Git에 포함되지 않도록 `.gitignore`에 등록되어 있습니다.

## 기본 scopes

최소 권한 원칙에 따라 기본 OAuth 요청은 MVP scope만 포함합니다.

- `user:read:chat`
- `user:write:chat`
- `channel:read:redemptions`

## 선택 scopes

추가 기능이 필요할 때만 `TWITCH_EXTRA_SCOPES`에 공백 또는 쉼표로 추가합니다.

- `channel:manage:redemptions`: reward 상태 변경 또는 reward 관리가 필요할 때
- `channel:read:subscriptions`: 구독 이벤트를 받을 때
- `bits:read`: Bits/Cheer 이벤트를 받을 때
- `channel:manage:broadcast`: stream marker 또는 방송 정보 변경이 필요할 때

## EventSub WebSocket 설정

EventSub WebSocket subscription은 OAuth로 저장된 user access token을 사용합니다. `.env`의 `TWITCH_USER_ACCESS_TOKEN`은 점진적 호환용이며, WebSocket subscription 생성 경로에서는 OAuth token을 우선 사용합니다.

채팅 명령어(`!질문`, `!클립` 등)는 Twitch 채팅을 직접 폴링하지 않고 `channel.chat.message` EventSub notification으로 수신합니다. OAuth 연결이 성공했더라도 `TWITCH_ENABLE_EVENTSUB=true`가 아니면 명령어가 실행되지 않습니다.

기본 subscription은 MVP 기능에 필요한 4개입니다.

- `stream.online`
- `stream.offline`
- `channel.chat.message`
- `channel.channel_points_custom_reward_redemption.add`

구독, Cheer, Raid 이벤트가 필요하면 `TWITCH_EVENTSUB_SUBSCRIPTIONS`에 subscription type을 추가합니다. scope가 필요한 subscription은 OAuth 재연결 전에 `TWITCH_EXTRA_SCOPES`에도 필요한 scope를 추가해야 합니다.

- `channel.subscribe`: `channel:read:subscriptions`
- `channel.subscription.message`: `channel:read:subscriptions`
- `channel.cheer`: `bits:read`
- `channel.raid`: 추가 scope 없음

## 방송자 계정과 bot 계정 분리 전략

현재 MVP OAuth 연결은 연결한 Twitch 사용자를 방송자이자 채팅 발신자로 사용합니다. 장기적으로 방송자 계정과 bot 계정을 분리하려면 token store를 계정 역할별로 확장해야 합니다.

- broadcaster token: EventSub 구독, 채널 포인트, 방송자 정보 조회
- bot token: 채팅 발송

이 경우 `sender_id`와 token 소유자가 일치하는지 검증하고, dashboard에서 두 연결 상태를 따로 표시해야 합니다.

## token 보안 주의사항

- Client Secret, access token, refresh token은 프론트 코드로 보내지 않습니다.
- token 값을 `console.log`나 JSONL 로그에 출력하지 않습니다.
- Local JSON token store는 개발 편의를 위한 기본 구현입니다.
- 운영 전에는 DB 또는 OS secret store와 encryption 기반 저장소로 교체하세요.
- OAuth `state`는 일회성으로 생성하고 callback에서 반드시 검증합니다.
- callback 실패 화면에는 token, code, raw error를 노출하지 않습니다.
