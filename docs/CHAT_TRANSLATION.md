# 채팅 번역 기능

Twitch 채팅 오버레이는 한국어 채팅을 일본어로, 일본어 채팅을 한국어로 번역해서 같은 말풍선 안에 표시할 수 있습니다.

## 동작 방식

- `channel.chat.message` EventSub 이벤트를 수신합니다.
- 명령어 채팅은 기존 `chat-overlay.json`의 `hideCommands` 설정에 따라 표시하지 않습니다.
- 한국어는 한글, 일본어는 히라가나/가타카나 기준으로 보수적으로 감지합니다.
- 번역 결과는 `chat.message.add` overlay message의 `translatedMessage`, `translationSourceLanguage`, `translationTargetLanguage` 필드로 전달됩니다.
- 번역 실패, timeout, rate limit 초과 시 원문 채팅은 그대로 표시하고 번역만 생략합니다.

## 환경변수

```bash
CHAT_TRANSLATION_ENABLED=false
CHAT_TRANSLATION_PROVIDER=mock
CHAT_TRANSLATION_MAX_INPUT_LENGTH=180
CHAT_TRANSLATION_MAX_PER_MINUTE=30
```

기본 설정은 외부 API key를 요구하지 않습니다. 테스트용으로 API 호출 없이 확인하려면 다음처럼 설정할 수 있습니다.

```bash
CHAT_TRANSLATION_PROVIDER=mock
```

## 보안 주의사항

- 외부 번역 API key를 사용하는 경우 서버 `.env`에만 저장합니다.
- 번역 요청에는 sanitized viewer chat text만 사용합니다.
- Twitch token, refresh token, client secret, raw EventSub payload는 overlay로 보내지 않습니다.
- 번역문은 React text로 렌더링하며 `dangerouslySetInnerHTML`을 사용하지 않습니다.
- 분당 번역 제한을 두어 채팅 폭주 시 API 비용과 지연을 줄입니다.
