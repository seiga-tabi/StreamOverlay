# YORO secret 운영

운영 secret은 `.env`나 `runtime.json`에 저장하지 않습니다. 각 컨테이너의
`/run/secrets`에 읽기 전용 regular file로 제공합니다.

Server가 사용하는 고정 파일:

```text
database_url
twitch_client_secret
twitch_token_encryption_key
riot_api_key
discord_client_secret
discord_oauth_encryption_key
bridge_shared_secret
dashboard_auth_token
overlay_access_token
```

Discord Bot 전용:

```text
discord_bot_token
```

Discord Bot과 Server가 공유하는 내부 HMAC key는 일반 secret bind mount로
관리하지 않습니다. 운영 원클릭 Compose의 `discord-internal-auth-init`가
named volume 안에 동일 값의 UID별 파일을 생성합니다.

```text
/run/discord-internal-auth/server_key  # Server UID 10001
/run/discord-internal-auth/bot_key     # Discord Bot UID 10002
```

각 서비스는 자신의 파일만 읽을 수 있으며 초기화 단계에서 두 파일의 값이
다르면 fail-closed로 기동을 중단합니다. `docker compose up -d --build
--force-recreate --wait`만으로 최초 생성과 이후 재사용 검증이 수행됩니다.

Cloudflare 전용:

```text
cloudflare_tunnel_token
```

## 파일 규칙

- symlink를 사용하지 않습니다.
- secret 파일은 `0600` 이하, 디렉터리는 `0700`으로 제한합니다.
- 파일은 비어 있거나 placeholder여서는 안 됩니다.
- 최대 크기는 4KiB입니다.
- 마지막 줄바꿈 하나만 제거합니다.
- 기능이 비활성화된 경우 관련 secret을 읽거나 검증하지 않습니다.
- secret 원문, 길이, prefix, fingerprint를 로그에 남기지 않습니다.
- 서로 다른 목적의 암호화·HMAC key를 재사용하지 않습니다.

Production bind mount를 사용할 때 파일 소유자는 컨테이너 실행 UID와
일치해야 합니다. Server는 UID `10001`, Discord Bot은 UID `10002`를
사용합니다. 호스트에서 권한을 검증한 뒤 컨테이너를 시작합니다.

## 회전

Bot token, Riot API key, OAuth client secret은 공급자에서 새 값을 발급한 뒤
동일 디렉터리에 임시 파일을 `0600`으로 쓰고 atomic rename으로 교체합니다.
그 후 해당 secret을 사용하는 서비스만 재시작합니다.

persisted credential 암호화 key는 즉시 덮어쓰지 않습니다.

```text
현재 key version
이전 key version
→ 새 데이터는 현재 key로 암호화
→ 기존 데이터는 이전 key로 복호화
→ 점진적 재암호화
→ 검증 완료 후 이전 key 폐기
```

Twitch token encryption key와 Discord OAuth encryption key는 외부의
암호화된 백업에 보관해야 합니다. key 유실 시 저장된 credential을 복호화할
수 없습니다.

## 사고 대응

secret 노출이 의심되면 값을 로그로 확인하지 않습니다. 해당 공급자에서
폐기·재발급하고 파일을 원자적으로 교체한 뒤 영향받는 서비스만
재시작합니다. 이전 파일이나 전체 secret 디렉터리를 image, backup log,
지원 요청에 첨부하지 않습니다.
