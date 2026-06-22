# Frontend

## Dashboard

```bash
npm run dev:dashboard
```

Default dev URL:

```text
http://localhost:5173
```

Dashboard 기능:

- 서버/Twitch/Bridge/OBS 상태 카드
- 최근 이벤트 로그
- 질문 큐
- 안전한 action test 버튼
- OBS overlay URL 안내

## Overlay

```bash
npm run dev:overlay
```

Default dev URL:

```text
http://localhost:5174
```

OBS Browser Source에 위 URL을 추가하세요.

권장 크기:

```text
Width: 1920
Height: 1080
```

Overlay 기능:

- 이벤트 배너
- 한일 자막
- 질문 카드
- 미션 보드
- 롤 시참 대기열

## WebSocket

- Dashboard WS: `ws://localhost:3000/ws/dashboard`
- Overlay WS: `ws://localhost:3000/ws/overlay`

프론트 앱은 서버 연결 실패 시 mock 데이터로 UI를 표시합니다.
