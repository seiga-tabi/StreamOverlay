# Riot RSO 계정 연결

## 구현 목적과 경계

YORO.gg의 Riot Sign On(RSO)은 새로운 YORO 로그인 수단이 아닙니다. 사용자는 먼저
Twitch로 YORO.gg에 로그인하고 Dashboard의 **연결 계정** 화면에서 본인 Riot
계정을 추가로 연결합니다.

```text
Twitch 로그인
  → YORO session(authenticationProvider=twitch)
  → Dashboard 연결 계정
  → Riot RSO 동의
  → /riot/account/v1/accounts/me 확인
  → PUUID + Riot ID만 YORO identity로 저장
```

- Riot 비밀번호는 YORO.gg에 전달되지 않습니다.
- OAuth `state`와 별도 HttpOnly cookie binding을 모두 검증합니다.
- 시작과 callback에서 최근 Twitch 인증과 동일 YORO user를 다시 확인합니다.
- Riot access token은 `/accounts/me` 확인에만 사용하고 저장·로그·브라우저 응답에
  포함하지 않습니다.
- 연결 해제 시 Riot identity를 revoke하고 기존 YORO session을 폐기합니다.
- Riot identity가 남아 있어도 Discord/Twitch 마지막 로그인 identity는 해제할 수
  없습니다.

Riot 공식 정책상 RSO client는 승인된 Production application에만 제공됩니다.
승인 전에는 `features.riotRso=false`를 유지해야 합니다.

## Developer Portal 입력값

첨부 화면에는 다음 production URL을 입력합니다.

| 항목 | 입력값 |
| --- | --- |
| 개인정보 보호정책 URL | `https://yoro.gg/privacy` |
| 서비스 약관 URL | `https://yoro.gg/terms` |
| 리디렉션 URI | `https://yoro.gg/api/account/oauth/riot/callback` |
| 로그아웃 후 리디렉션 URI | `https://yoro.gg/api/account/oauth/riot/logout/callback` |

Developer Portal에는 placeholder인 `auth.riotgames.com/privacy`,
`auth.riotgames.com/tos`, `auth.riotgames.com/oauth/callback`을 입력하지 않습니다.
위 URL은 모두 YORO.gg가 소유하고 HTTPS로 공개하는 URL이어야 합니다.

Riot identity 연결 해제는 YORO.gg의 로컬 연결만 revoke하며 사용자를 Riot 전체
서비스에서 강제 로그아웃시키지 않습니다. 로그아웃 후 리디렉션 URI는 Portal이 요구하는
복귀 endpoint로만 등록하고, 해당 callback은 YORO session을 로그인 수단으로 취급하거나
새 Riot identity를 만들지 않습니다.

`/privacy`와 `/terms`는 이미 구현되어 있습니다. production의
`/etc/yoro/legal.json`이 확정된 운영자 정보로 검증되는지 배포 전에 확인합니다.
현재 운영 응답에 `X-Robots-Tag: noindex, nofollow`가 있으면 법적 설정이 아직
확정되지 않은 상태이므로 Portal 검토 요청을 보내지 않습니다.

```bash
curl -fsSI https://yoro.gg/privacy
curl -fsSI https://yoro.gg/terms
```

## Runtime과 secret

`/etc/yoro/runtime.json`에는 공개 설정만 추가합니다.

```json
{
  "features": {
    "riotRso": true
  },
  "riot": {
    "accountRegion": "asia",
    "lolPlatform": "kr",
    "rsoClientId": "Riot에서 발급한 공개 client ID",
    "rsoRedirectUri": "https://yoro.gg/api/account/oauth/riot/callback",
    "rsoLogoutRedirectUri": "https://yoro.gg/api/account/oauth/riot/logout/callback"
  }
}
```

client secret 원문은 runtime JSON이나 Git에 넣지 않습니다.

```text
/etc/yoro/secrets/riot_rso_client_secret
```

파일은 regular file, `0600`, Server UID `10001` 소유여야 하며 symlink와
placeholder를 허용하지 않습니다. 운영 값을 문서·로그·shell history에 출력하지
않습니다.

## Database migration

`0020_yoro_riot_rso_identity.sql`은 `external_identities`와
`yoro_oauth_sessions`가 `riot` provider를 허용하도록 확장합니다. Riot provider는
`link_identity` 목적만 허용하며 YORO session의 `authentication_provider`에는
추가하지 않습니다.

운영 적용은 `docs/SQL_MIGRATION_APPLICATION_RUNBOOK.md`의 backup → check → plan →
apply → check 순서를 따릅니다. migration 적용 전에는 `riotRso`를 켜지 않습니다.

## 활성화 순서

1. Riot Production application과 RSO client 승인을 받습니다.
2. Portal에 위의 개인정보·약관·callback URL 네 개를 등록합니다.
3. production과 동일한 staging origin으로 callback flow를 검증합니다.
4. PostgreSQL backup을 만들고 migration `0020`을 적용합니다.
5. `riot_rso_client_secret`을 승인된 secret 원본에서 atomic하게 배치합니다.
6. `deploy/production/riot-rso.override.example.yaml`을 운영 전용 경로에 복사하고
   `config-check`와 `server`에만 secret을 read-only mount합니다.
7. runtime의 `riot` 공개 설정을 입력하고 마지막에 `features.riotRso=true`로 바꿉니다.
8. 기본 Compose와 운영 override를 함께 지정해 `config-check` 성공 후 Server를
   재기동합니다.
9. Twitch 로그인 → Dashboard 연결 계정 → Riot 연결 → 연결 해제를 확인합니다.

운영 override 예시 명령:

```bash
cd deploy/production
docker compose \
  -f compose.yaml \
  -f /etc/yoro/riot-rso.override.yaml \
  run --rm config-check
```

## 수동 검증 체크리스트

- Discord로 인증한 session에서는 Riot 연결 대신 Twitch 재인증 안내가 보입니다.
- Twitch 로그인 직후 Riot 연결을 시작할 수 있습니다.
- callback의 `state`, OAuth cookie 또는 YORO session 중 하나라도 없으면 연결되지
  않습니다.
- 다른 YORO user에 이미 연결된 PUUID는 `identity_conflict`로 차단됩니다.
- 성공 응답, log, DB의 일반 identity 조회에 OAuth access token이 없습니다.
- `0021` 이후 Riot 연결 해제는 별도 `yoro_valorant_record_consents` row를 같은 transaction에서 즉시 철회합니다.
- Riot identity 연결 자체는 발로란트 전적 공개 동의가 아닙니다. 사용자가 별도 동의 API를 실행해야 하며 상세 계약은 `docs/VALORANT_PUBLIC_API.md`를 따릅니다.
- `features.riotRso=false`이면 start/callback endpoint가 `404`를 반환합니다.

## 공식 참고 자료

- Riot Developer Portal의 VALORANT RSO 정책:
  `https://developer.riotgames.com/docs/valorant`
- Riot Developer Portal의 League of Legends RSO 구현 안내:
  `https://developer.riotgames.com/docs/lol`
- Riot Developer Relations RSO 안내:
  `https://support-developer.riotgames.com/hc/en-us/articles/22801670382739-RSO-Riot-Sign-On`
