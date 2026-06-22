# Streamer.bot / webhook 연동 예시

이 프로젝트는 `POST /alert` 요청이 들어오면 즉시 WAV 오디오를 반환합니다. OBS/브라우저 쪽에서 직접 재생하기 어렵다면 `POST /alert_file`을 사용해서 파일로 저장한 뒤, 저장 경로를 재생하도록 구성하세요.

## 팔로우

```json
{
  "event_type": "follow",
  "name": "%user%",
  "with_sfx": true,
  "save_file": true
}
```

## 비트 / 후원 메시지

```json
{
  "event_type": "bits",
  "name": "%user%",
  "amount": %bits%,
  "message": "%message%",
  "with_sfx": true,
  "save_file": true
}
```

## 정기구독

```json
{
  "event_type": "subscribe",
  "name": "%user%",
  "message": "%message%",
  "with_sfx": true,
  "save_file": true
}
```

변수명은 사용하는 알림 도구에 따라 다릅니다. 위의 `%user%`, `%bits%`, `%message%`는 자리표시자입니다.
