# YORO.gg QA Rules

## 1. 기본 원칙

QA는 refactor의 마지막 단계가 아니라 각 PR의 완료 조건이다. 방송 운영에 영향이 있는 변경은 더 엄격하게 검증한다.

## 2. 필수 검증

| 항목 | 기준 |
|---|---|
| build | `npm run build` |
| typecheck | workspace TypeScript build |
| config | `npm run validate:config` |
| test | `npm test` |
| lint | 현재 lint script가 없으면 미실행 사유 기록 |
| responsive | mobile/tablet/desktop |
| accessibility | keyboard, focus, contrast, aria |
| visual regression | baseline screenshot 비교 |
| i18n | Korean/Japanese copy와 layout |
| performance | Performance Budget 확인 |
| smoke test | public/dashboard/overlay 핵심 flow |
| rollback test | feature flag off 또는 legacy fallback |

## 3. Smoke Test

Public:

- 검색 입력
- profile 표시
- match history 표시
- community/tournament route 접근

Dashboard:

- admin login
- streamer login
- navigation role gate
- Twitch status
- participation 상태

Overlay:

- OBS source URL 생성
- mock preview
- WebSocket reconnect
- event/chat/participation/solo-rank render
- blank frame 없음

Server:

- `/health`
- `/health/live`
- `/health/ready`
- legacy API
- API v1 adapter가 있는 경우 parity

## 4. Responsive 기준

검증 viewport:

- 390px mobile
- 768px tablet
- 1024px desktop
- 1440px desktop
- OBS 1920x1080
- OBS 1280x720

금지:

- horizontal scroll
- text clipping
- button overflow
- card overlap
- navigation inaccessible

## 5. Accessibility 기준

- focus visible
- keyboard only 사용 가능
- modal/dropdown close 가능
- accessible name 존재
- form label 연결
- contrast WCAG AA 이상
- loading/error state 전달

## 6. Performance 기준

`docs/Performance-Budget.md`를 따른다.

특히 확인:

- JS/CSS bundle
- LCP
- CLS
- INP
- API p95
- memory
- overlay first frame

## 7. Rollback Test

High-risk PR은 다음을 확인한다.

- feature flag off 시 legacy 정상
- legacy API endpoint 정상
- 기존 OBS URL 정상
- token alias revert 가능
- Store JSON fallback 가능

## 8. QA 보고 형식

```text
검증:
- build:
- typecheck:
- test:
- responsive:
- accessibility:
- i18n:
- performance:
- smoke:
- rollback:

미실행:
- 항목:
- 사유:
```
