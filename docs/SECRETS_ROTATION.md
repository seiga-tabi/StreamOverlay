# Secret rotation

## 대상

- Twitch client secret, OAuth token, EventSub 관련 secret
- Riot API key
- `OVERLAY_ACCESS_TOKEN`
- `BRIDGE_SHARED_SECRET`
- session/CSRF secret
- support mailbox webhook/encryption key
- Palworld 서버 연결 정보 암호화 key
- operations alert webhook secret

실제 값은 저장소, CI 로그, 문서, 채팅에 기록하지 않습니다.

## 절차

1. 노출 범위와 사용처를 확인하고 기존 secret을 revoke합니다.
2. 각 서비스의 공식 관리 화면 또는 운영 secret manager에서 새 값을 발급합니다.
3. staging에 주입하고 `validate:runtime`, OAuth, EventSub, Riot 조회, overlay 연결을 검증합니다.
4. production secret version을 갱신하고 rolling restart합니다.
5. readiness, 오류 로그와 webhook 알림을 확인합니다.
6. 이전 secret이 더 이상 동작하지 않는지 확인하고 rotation 증적을 남깁니다.

지원되는 경우 환경변수 대신 `_FILE` 방식과 권한 `0600`의 secret file을 사용합니다. rotation 중 실제 값은 출력하지 않고 변수명, 변경 version, 검증 결과만 기록합니다.

Palworld 연결 정보 암호화 key는 환경 변수가 아니라 `/run/secrets/palworld-server-credentials-encryption-key` 고정 파일만 사용합니다. 기존 ciphertext가 있으면 일반 rotation으로 키만 바꾸지 말고 [Palworld 서버 상태 운영 설정](PALWORLD_SERVER_STATUS.md)의 오프라인 마이그레이션 절차를 따릅니다.
