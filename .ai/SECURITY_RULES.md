# YORO.gg Security Rules

## 1. 기본 원칙

YORO.gg는 방송 중 실행될 수 있다. 보안과 예측 가능성은 편의성보다 우선한다.

## 2. Secret 하드코딩 금지

금지:

- Twitch token 하드코딩
- Riot API key 하드코딩
- overlay token 하드코딩
- admin token 하드코딩
- session secret 하드코딩
- webhook URL 하드코딩

모든 secret은 environment/config/secret store를 사용한다.

## 3. Env 사용 규칙

- env 이름은 명확해야 한다.
- required env는 config validation에 포함한다.
- production env와 dev default를 구분한다.
- secret 값을 log에 출력하지 않는다.
- `.env` 파일을 commit하지 않는다.

## 4. Auth/Session/Token 규칙

- admin과 streamer 권한을 명확히 분리한다.
- server-side permission check를 반드시 둔다.
- client-side navigation gate만으로 보호하지 않는다.
- CSRF 보호를 임의로 제거하지 않는다.
- session 만료와 logout flow를 유지한다.

## 5. Riot/Twitch API Key 보호

- Riot API key는 서버에서만 사용한다.
- Twitch access/refresh token은 client에 노출하지 않는다.
- token refresh 실패는 안전하게 처리한다.
- external API error를 민감정보 없이 전달한다.

## 6. Overlay Token 보호

- overlay token은 URL fragment/hash 정책을 유지한다.
- dashboard UI에서 token을 불필요하게 크게 노출하지 않는다.
- log에 overlay token을 남기지 않는다.
- OBS URL compatibility를 유지하되 공유 위험을 안내한다.

## 7. Admin 권한 검증

Admin-only:

- action test
- reward mapping
- alert asset 관리
- Riot API key 설정
- streamer request 승인
- EventSub reconnect
- token refresh/disconnect

Streamer surface에 admin-only 기능이 노출되면 안 된다.

## 8. Rate Limit

Rate limit 필수:

- auth/login
- OAuth callback
- public LoL search
- public community write
- participation join/cancel
- dashboard mutating API
- WebSocket upgrade

## 9. CORS/CSP

- CORS allowlist를 임의로 넓히지 않는다.
- `*` 허용 금지.
- CSP를 약화하지 않는다.
- static asset path와 API path를 구분한다.

## 10. Logging 금지 항목

절대 log 금지:

- access token
- refresh token
- API key
- session secret
- overlay key
- admin token
- cookie header
- authorization header
- raw user PII

## 11. Viewer Input Safety

Viewer-triggered input은 절대 다음으로 이어지면 안 된다.

- shell command execution
- arbitrary file write/delete
- arbitrary URL open
- OBS stream key 변경
- remote stream start/stop
- arbitrary OBS command
- unsafe Twitch moderation
- Discord `@everyone`/`@here`

OBS/Twitch/Overlay action은 allowlist와 validation을 통과해야 한다.

