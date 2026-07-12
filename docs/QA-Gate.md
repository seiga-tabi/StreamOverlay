# YORO.gg QA Gate

## 1. 공통 QA Gate

각 Sprint 종료 시 다음을 통과해야 한다.

- `npm run build`
- `npm run validate:config`
- `npm test`
- TypeScript build
- responsive 검증
- accessibility 검증
- visual regression 검증
- i18n 검증
- performance budget 검증
- smoke test
- rollback test

미실행 항목은 사유와 위험을 기록한다.

## 2. Sprint Gate

| Sprint | 필수 Gate |
|---|---|
| Sprint1 | baseline, token alias, flag default |
| Sprint2 | admin/streamer login, navigation role gate |
| Sprint3 | OBS overlay, reconnect, preview, first frame |
| Sprint4 | search, profile, match history, locale |
| Sprint5 | participation, community, tournament, API parity |

## 3. Smoke Test Matrix

| Surface | Smoke |
|---|---|
| Public | search, profile, community, tournament |
| User | Twitch login, participation join/cancel |
| Streamer | dashboard, overlay, participation control |
| Admin | settings, action test, EventSub, Riot key |
| Overlay | URL, token, WS, render, reconnect |

## 4. Rollback Gate

- flag off 정상
- legacy route 정상
- legacy API 정상
- OBS URL 정상
- JSON Store fallback 정상

