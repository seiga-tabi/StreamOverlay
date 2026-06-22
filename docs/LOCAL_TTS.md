# 로컬 일본어 TTS

StreamOps는 `apps/tts-engine`의 Seoya TTS 엔진을 Docker Compose로 함께 실행할 수 있습니다.

## 구조

```text
apps/server
  -> http://tts-engine:8787/speak
  -> /tts/*.wav 캐시 생성
  -> OBS overlay로 speechAudioUrl 전달

tts-engine
  -> http://voicevox:50021
  -> VOICEVOX Engine으로 일본어 WAV 합성
```

`tts-engine`은 첨부된 Seoya Broadcast Japanese TTS Engine을 프로젝트 안으로 이식한 FastAPI 서비스입니다. 직접 음성 모델을 포함하지 않고, 실제 음성 합성은 `voicevox` 컨테이너가 담당합니다.

## Docker Compose 실행

루트 `.env.example`을 복사한 뒤 필요한 Twitch/Riot 값과 함께 TTS 값을 확인합니다.

```env
LOCAL_TTS_ENABLED=true
LOCAL_TTS_PROVIDER=seoya
LOCAL_TTS_BASE_URL=http://tts-engine:8787
LOCAL_TTS_SPEAKER=3
LOCAL_TTS_BROADCAST_WAIT_MS=15000
LOCAL_TTS_TIMEOUT_MS=15000
LOCAL_TTS_MAX_TEXT_LENGTH=300
LOCAL_TTS_CACHE_DIR=/app/.streamops/tts-cache
LOCAL_TTS_PUBLIC_PATH=/tts

SE0YA_TTS_BIND=127.0.0.1
SE0YA_TTS_HOST_PORT=8787
SEOYA_DEFAULT_SPEAKER_ID=3
VOICEVOX_BASE_URL=http://voicevox:50021
VOICEVOX_IMAGE=voicevox/voicevox_engine:cpu-ubuntu20.04-latest
```

실행:

```bash
docker compose up -d --build
```

`tts-engine`의 host 포트는 기본적으로 `127.0.0.1:8787`에만 열립니다. 외부 공개 서버에서 이 포트를 인터넷에 직접 공개하지 마세요.

## 동작 확인

TTS 엔진 health:

```bash
curl http://127.0.0.1:8787/health
```

문장 합성:

```bash
curl -o /tmp/seoya-tts-test.wav \
  -X POST http://127.0.0.1:8787/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは。これは、せやTTSの動作確認です。","speaker_id":3,"with_sfx":false,"save_file":false}'
```

StreamOps 서버 경유 확인:

```bash
curl -X POST http://127.0.0.1:3000/api/actions/test \
  -H "Content-Type: application/json" \
  -d '{"action":{"type":"overlay.banner","message":"せやTTSエンジンの連携確認です。","source":"manual.tts.test","speechEnabled":true,"speechLanguage":"ja-JP","speechText":"せやTTSエンジンの連携確認です。"}}'
```

성공하면 `logs/events.jsonl`에 `local_tts.generated`가 기록되고, `fileName` 값으로 `/tts/{fileName}`을 열 수 있습니다.

`LOCAL_TTS_BROADCAST_WAIT_MS`는 overlay 배너를 보내기 전에 서버가 로컬 TTS WAV 생성을 기다리는 시간입니다. 닉네임, 비트 수, 댓글이 포함된 일본어/한국어 혼합 문장은 VOICEVOX 생성 시간이 길어질 수 있어 Docker 기본값은 15초입니다. 이 시간 안에 생성되면 overlay는 `/tts/...wav`를 재생합니다. 시간이 초과되면 배너는 지연 없이 전송되고, `speechEnabled`를 유지해 OBS Browser Source의 Web Speech fallback이 읽을 수 있게 합니다.

## 설정 파일

- `apps/tts-engine/config.json`: VOICEVOX speaker, 음량, 효과음, 필터링 규칙
- `apps/tts-engine/templates.json`: follow, bits, subscribe, donation 알림 문구 템플릿
- `apps/tts-engine/sfx`: 알림 효과음 WAV

StreamOps의 overlay 알림은 기존처럼 `soundUrl` 효과음을 따로 재생하고, TTS는 `speechAudioUrl`로 별도 재생합니다. 따라서 현재 서버 연동은 `tts-engine /speak`를 `with_sfx=false`로 호출합니다. `tts-engine /alert`는 독립 테스트와 향후 단일 WAV 합성 모드에 사용할 수 있습니다.

## 보안 주의

- TTS 엔진은 인증이 없으므로 host 포트를 외부에 공개하지 마세요.
- viewer input은 StreamOps action schema와 길이 제한을 통과한 뒤 읽어줍니다.
- token, client secret, Riot API key는 TTS payload에 포함하지 않습니다.
- 생성된 WAV는 `/app/.streamops/tts-cache`에 캐시되고 `/tts/...`로만 공개됩니다.
