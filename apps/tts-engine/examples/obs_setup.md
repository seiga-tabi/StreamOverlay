# OBS에서 쓰는 방법

1. VOICEVOX 앱 또는 VOICEVOX Engine을 먼저 실행합니다.
2. 이 프로젝트 서버를 실행합니다.
3. 브라우저에서 `http://127.0.0.1:8787/dashboard`를 열고 테스트합니다.
4. 방송 알림 도구에서 `/alert` 또는 `/alert_file` 엔드포인트를 호출하게 만듭니다.
5. 알림 도구가 오디오 URL 재생을 지원하면 `/alert` 응답 오디오를 바로 재생합니다.
6. 파일 재생 방식만 지원하면 `/alert_file`로 파일 저장 후 `output/`의 최신 WAV를 재생하게 구성합니다.

OBS 자체가 웹훅으로 오디오 응답을 직접 재생하는 구조는 아니므로, 실제 연결은 Streamer.bot, SAMMI, Mix It Up, StreamElements 커스텀 위젯 등 사용 중인 알림 시스템에 맞춰 조정해야 합니다.
