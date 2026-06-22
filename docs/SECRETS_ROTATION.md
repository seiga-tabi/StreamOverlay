# Secret 교체 가이드

`.env.example`, 로그, 채팅, 화면 공유, 이슈, 커밋 등에 실제 key나 token을 넣었다면 해당 값은 노출된 것으로 보고 교체해야 합니다.

## 즉시 교체해야 하는 값

- `TWITCH_CLIENT_SECRET`
- Twitch OAuth access token
- Twitch OAuth refresh token
- `RIOT_API_KEY`
- `BRIDGE_SHARED_SECRET`
- `DASHBOARD_AUTH_TOKEN`
- `OVERLAY_ACCESS_TOKEN`

## Twitch key 교체

1. Twitch Developer Console에서 기존 app secret을 rotate하거나 새 app을 만듭니다.
2. 서버 `.env`의 `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI`를 갱신합니다.
3. 기존 token store를 폐기합니다.
   - Docker 운영 기본 경로: `/app/.streamops/twitch-token.json`
   - Compose named volume: `streamops_state`
4. 서버를 재시작합니다.
5. Dashboard에서 Twitch 계정을 다시 연결합니다.

## Riot API key 교체

1. Riot Developer Portal에서 새 key를 발급합니다.
2. 서버 `.env`의 `RIOT_API_KEY`를 갱신합니다.
3. 서버를 재시작합니다.
4. Riot profile cache는 필요하면 유지할 수 있지만, 테스트 중 민감한 입력이 섞였으면 `.streamops/lol-profiles.json`을 별도 백업 후 삭제합니다.

## 내부 token 교체

`BRIDGE_SHARED_SECRET`, `DASHBOARD_AUTH_TOKEN`, `OVERLAY_ACCESS_TOKEN`은 긴 랜덤 문자열로 바꿉니다.

```bash
openssl rand -hex 32
```

교체 후 필요한 client 설정도 함께 갱신합니다.

- Bridge: `Authorization: Bearer ...`
- Dashboard: 로그인 후 서버 session cookie 재발급
- Overlay: `/overlay/?mode=events#token=...`

## Git 이력 주의

현재 작업트리에 placeholder로 바꾸더라도 과거 커밋이나 원격 저장소에 secret이 남아 있을 수 있습니다. 한 번이라도 Git에 올라간 값은 삭제보다 교체가 우선입니다.
