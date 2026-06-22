# Seoya Broadcast Japanese TTS Engine

방송 알림용 일본어 TTS 서버입니다. 팔로우, 비트/후원, 정기구독 이벤트를 받아 일본어 음성 WAV를 생성하고, 선택적으로 효과음을 앞에 붙입니다.

## 구성

- `POST /speak`: 입력한 문장을 그대로 일본어 TTS WAV로 반환
- `POST /alert`: 이벤트 타입, 닉네임, 금액, 메시지를 템플릿에 넣어 TTS WAV로 반환
- `POST /alert_file`: WAV를 `output/`에 저장하고 경로를 JSON으로 반환
- `GET /dashboard`: 브라우저 테스트 페이지
- `GET /speakers`: 사용 가능한 VOICEVOX 화자 목록 확인
- `GET /health`: VOICEVOX 연결 확인

## 준비물

1. Python 3.10 이상
2. VOICEVOX 앱 또는 VOICEVOX Engine
3. Windows라면 `start_windows.bat`, macOS/Linux라면 `./start_mac_linux.sh`

VOICEVOX가 기본 포트 `50021`에서 실행 중이어야 합니다. 다른 포트를 쓰면 `.env` 파일을 만들고 `VOICEVOX_BASE_URL`을 바꾸세요.

## 빠른 시작

### StreamOps Docker Compose

StreamOps 루트에서 실행합니다.

```bash
docker compose up -d --build voicevox tts-engine server
```

기본 구조:

- `server`는 `LOCAL_TTS_PROVIDER=seoya`로 `http://tts-engine:8787/speak`를 호출합니다.
- `tts-engine`은 `VOICEVOX_BASE_URL=http://voicevox:50021`로 VOICEVOX Engine을 호출합니다.
- host 테스트용 TTS 포트는 기본 `127.0.0.1:8787`입니다.

상세 내용은 `docs/LOCAL_TTS.md`를 참고하세요.

### Windows

```bat
start_windows.bat
```

### macOS / Linux

```bash
chmod +x start_mac_linux.sh
./start_mac_linux.sh
```

서버가 켜지면 브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:8787/dashboard
```

## API 예시

### 후원 / 비트 메시지 읽기

```bash
curl -X POST http://127.0.0.1:8787/alert   -H "Content-Type: application/json"   --output bits_alert.wav   -d '{
    "event_type": "bits",
    "name": "SeoyaFan",
    "amount": 500,
    "message": "今日も配信ありがとう！無理しないでね。",
    "with_sfx": true,
    "save_file": true
  }'
```

### 문장만 바로 읽기

```bash
curl -X POST http://127.0.0.1:8787/speak   -H "Content-Type: application/json"   --output speak.wav   -d '{"text":"こんにちは。これはテスト音声です。"}'
```

## 설정 파일

### `config.json`

- `default_speaker_id`: 기본 화자 ID
- `voice`: 속도, 피치, 억양, 볼륨 설정
- `limits`: 닉네임/메시지 최대 길이
- `blocked_words`: 읽지 않을 단어
- `pronunciation_overrides`: `www`, `草`, `8888` 같은 표현의 읽기 치환
- `sfx`: 이벤트별 효과음 파일

### `templates.json`

팔로우/비트/구독/후원 문장 템플릿입니다.

```json
"bits": [
  "{name}さん、{amount}ビッツありがとう！{message_part}"
]
```

사용 가능한 변수는 다음과 같습니다.

- `{name}`: 닉네임
- `{amount}`: 비트/후원 수량
- `{message}`: 정리된 원문 메시지
- `{message_part}`: 메시지가 있을 때만 붙는 읽기 문장

## 주의

- VOICEVOX 음성 라이브러리/캐릭터별 이용약관을 확인하세요.
- 유명인, 성우, 지인의 목소리를 무단 복제하는 용도로 쓰지 마세요.
- 후원 메시지는 URL, 일부 이모지, 제어문자, 과도한 반복 문자를 자동 정리합니다.
- 실제 방송 연동은 Streamer.bot, SAMMI, Mix It Up, StreamElements, Twitch EventSub 등 사용하는 도구에 맞춰 웹훅 형식을 조정해야 합니다.
