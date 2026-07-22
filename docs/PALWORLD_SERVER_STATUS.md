# Palworld 서버 상태 운영 설정

Palworld 서버 상태 기능은 Dashboard 브라우저가 전용 서버에 직접 연결하지 않도록 `apps/server`에서만 REST API를 조회합니다. OBS Bridge나 기존 서비스 secret을 사용하지 않습니다.

## 고정 경로

- 비밀이 아닌 설정: `/app/apps/server/config/palworld-server-status.json`
- 컨테이너 secret: `/run/secrets/palworld-server-credentials-encryption-key`
- 암호화 state: `/app/.streamops/palworld-server-connections.json.enc`

Docker Compose의 기존 `./apps/server/config:/app/apps/server/config:ro`, `./secrets:/run/secrets:ro`, `streamops_state:/app/.streamops` 마운트를 그대로 사용합니다. Palworld 전용 환경 변수나 Dashboard 입력으로 경로를 바꿀 수 없습니다. Compose 밖에서 실행할 때 state의 상위 디렉터리는 기존 공통 `STREAMOPS_STATE_DIR` 설정을 따르지만, 파일명은 항상 `palworld-server-connections.json.enc`로 고정됩니다.

`STREAMOPS_STATE_DIR`는 StreamOps 프로세스 전용 디렉터리여야 하며 leaf 이름도 `.streamops`, `streamops`, `streamops-*` 또는 `streamops_*` 형식이어야 합니다. filesystem root, home, 임시 디렉터리 자체, `/app` 같은 broad 경로, 다른 서비스와 공유하는 디렉터리 또는 symlink가 포함된 경로는 사용할 수 없습니다. 저장소는 이 조건을 확인한 뒤에만 디렉터리 `0700`과 파일 `0600`을 적용합니다.

## 기능 활성화

1. `apps/server/config/palworld-server-status.json`의 `enabled`를 `true`로 변경합니다.
2. `allowedOrigins`에 운영자가 승인한 exact origin을 등록합니다. wildcard, 경로, query, fragment, URL 사용자 정보는 허용되지 않습니다.
3. LAN 또는 VPN의 `http:` origin을 사용하는 경우 해당 주소를 포함하는 사설 `allowedCidrs`도 함께 등록합니다. 공개 주소는 HTTPS reverse proxy와 방화벽/IP allowlist로 보호합니다.
4. 아래 절차로 전용 암호화 키 파일을 준비합니다.
5. `npm run validate:config`와 production runtime 검증을 통과시킨 뒤 서버를 재시작합니다.

고정 secret을 `10001:10001`, `0400`으로 준비한 뒤에는 실제 컨테이너 UID로 읽기 권한까지 검증합니다.

```bash
npm run validate:config
docker compose -f docker-compose.yml -f docker-compose.production.yml run --rm --no-deps -e NODE_ENV=production server node apps/server/dist/scripts/validate-runtime-config.js
```

설정 schema는 다음 여섯 필드만 허용합니다.

```json
{
  "version": 1,
  "enabled": false,
  "allowedOrigins": [],
  "allowedCidrs": [],
  "timeoutMs": 5000,
  "pollIntervalMs": 30000
}
```

`timeoutMs`는 1000~30000ms, `pollIntervalMs`는 5000~300000ms 범위입니다. 실제 Palworld 서버 주소는 저장소에 추가하지 않습니다.

`allowedOrigins`와 `allowedCidrs`는 비밀값이 아닌 outbound 정책이지만 내부 네트워크 구조를 드러낼 수 있습니다. 저장소의 기본 파일은 비활성·빈 정책 상태로 유지하고, 실제 값은 운영 배포 환경의 read-only config 마운트에서 관리하며 Git commit에 포함하지 않습니다. config 파일은 symlink가 아닌 regular file이어야 하고 group/other writable 권한을 허용하지 않습니다.

## 암호화 키 생성과 권한

키는 정확히 32바이트인 base64 또는 64자리 hex 형식이어야 하며 Dashboard, Overlay, Bridge, Twitch, Riot, 지원 메일함, Cloudflare 등 다른 서비스 secret과 재사용하지 않습니다. 실제 키를 명령 출력, 로그, 문서, Git 또는 채팅에 남기지 않습니다.

운영 호스트에서 다음과 같이 생성합니다.

```bash
umask 077
install -d -m 0700 secrets
openssl rand -base64 32 > secrets/palworld-server-credentials-encryption-key
chmod 0400 secrets/palworld-server-credentials-encryption-key
sudo chown 10001:10001 secrets secrets/palworld-server-credentials-encryption-key
sudo chmod 0700 secrets
sudo chmod 0400 secrets/palworld-server-credentials-encryption-key
```

`secrets` 디렉터리까지 UID `10001` 소유 `0700`이어야 bind mount 안의 파일을 탐색할 수 있습니다. 키 파일은 UID `10001` 소유 `0400`인 regular file이어야 하며 symlink와 group/other 권한은 허용되지 않습니다. 동일 디렉터리의 다른 secret도 서버 컨테이너 UID가 읽는 구조이므로, 운영자는 secret 변경 시 `sudo` 또는 동등한 secret 배포 도구를 사용합니다. production 서버는 누락되거나 손상된 키를 자동 생성하지 않습니다.

## 기존 암호문 마이그레이션

기존 기본 state 경로, AES-256-GCM envelope와 AAD는 유지되므로 기존 암호화 파일은 재암호화할 필요가 없습니다.

1. 서버를 중지하고 persistent volume의 암호화 파일을 backup합니다.
2. 기존 Palworld AES 키와 정확히 같은 값을 운영 secret 관리 절차로 고정 secret 파일에 기록합니다. 값을 stdout이나 shell history에 출력하지 않습니다.
3. 기본 state 경로를 사용했다면 암호화 파일을 그대로 둡니다.
4. 과거 custom state 경로를 사용했다면 서버가 중지된 동안 backup을 확인하고 암호화 파일 자체를 기본 state 경로로 복사합니다. online migration은 지원하지 않습니다. 복사할 때 파일 내용을 변환하거나 새 키로 재암호화하지 않습니다.
5. named volume 안의 state 디렉터리는 UID `10001` 소유 `0700`, 암호화 파일은 UID `10001` 소유 `0600`으로 맞춥니다. custom 경로에서 복사할 때는 다음처럼 root로 실행되는 일회성 offline helper에 backup 디렉터리를 read-only mount합니다. `/absolute/backup/directory`는 실제 backup 디렉터리의 절대 경로로 바꿉니다.

   ```bash
   docker compose run --rm --no-deps --user 0 \
     --cap-add CHOWN --cap-add FOWNER --cap-add DAC_OVERRIDE \
     -v /absolute/backup/directory:/migration:ro \
     server sh -c 'install -d -o 10001 -g 10001 -m 0700 /app/.streamops && install -o 10001 -g 10001 -m 0600 /migration/palworld-server-connections.json.enc /app/.streamops/palworld-server-connections.json.enc'
   ```

   기본 state 경로를 그대로 쓰던 설치도 배포 전에 다음 명령으로 owner와 mode를 보정합니다.

   ```bash
   docker compose run --rm --no-deps --user 0 \
     --cap-add CHOWN --cap-add FOWNER --cap-add DAC_OVERRIDE \
     server sh -c 'chown 10001:10001 /app/.streamops /app/.streamops/palworld-server-connections.json.enc && chmod 0700 /app/.streamops && chmod 0600 /app/.streamops/palworld-server-connections.json.enc'
   ```

   이 capability는 서버가 완전히 중지된 일회성 migration helper에만 추가하며 상시 `server` 서비스에는 추가하지 않습니다.

6. secret과 state 권한을 확인하고 production compose overlay를 적용한 runtime 검증을 실행합니다.
7. 복호화 검증이 끝난 뒤 서버를 시작합니다.

다른 키를 사용하면 subsystem은 fail-closed하며 기존 ciphertext를 초기화하거나 덮어쓰지 않습니다. 키를 분실한 경우 기존 연결 설정은 복구할 수 없으므로 암호문 backup과 키 backup을 서로 분리해 관리합니다.

## 장애 범위

설정 파일 누락·schema 오류, allowlist 정책 누락, secret 누락·손상 또는 원격 Palworld 서버 장애는 Palworld subsystem에만 반영됩니다. LoL, Overlay, Followers, OBS Bridge와 `/health/ready`는 해당 오류 때문에 실패하지 않습니다. Dashboard에는 내부 경로나 원시 오류 대신 안전한 한국어·일본어 운영 안내만 표시됩니다.
