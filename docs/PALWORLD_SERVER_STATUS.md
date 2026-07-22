# Palworld 서버 상태 운영 설정

Palworld 서버 상태 기능은 Dashboard 브라우저가 전용 서버에 직접 연결하지 않도록 `apps/server`에서만 REST API를 조회합니다. OBS Bridge나 기존 서비스 secret을 사용하지 않습니다.

## 고정 경로

- 비밀이 아닌 설정: `/app/apps/server/config/palworld-server-status.json`
- 컨테이너 secret: `/run/secrets/palworld-server-credentials-encryption-key`
- 암호화 state: `/app/.streamops/palworld-server-connections.json.enc`

Docker Compose의 기존 `./apps/server/config:/app/apps/server/config:ro`, `./secrets:/run/secrets:ro`, `streamops_state:/app/.streamops` 마운트를 그대로 사용합니다. Palworld 전용 환경 변수나 Dashboard 입력으로 경로를 바꿀 수 없습니다. Compose 밖에서 실행할 때 state의 상위 디렉터리는 기존 공통 `STREAMOPS_STATE_DIR` 설정을 따르지만, 파일명은 항상 `palworld-server-connections.json.enc`로 고정됩니다.

`STREAMOPS_STATE_DIR`는 StreamOps 프로세스 전용 디렉터리여야 하며 leaf 이름도 `.streamops`, `streamops`, `streamops-*` 또는 `streamops_*` 형식이어야 합니다. filesystem root, home, 임시 디렉터리 자체, `/app` 같은 broad 경로, 다른 서비스와 공유하는 디렉터리 또는 symlink가 포함된 경로는 사용할 수 없습니다. 저장소는 이 조건을 확인한 뒤에만 디렉터리 `0700`과 파일 `0600`을 적용합니다.

## 운영자 1회 준비

1. `apps/server/config/palworld-server-status.json`의 `enabled`를 `true`로 변경합니다.
2. 공개 인터넷 서버는 신뢰할 수 있는 인증서가 적용된 HTTPS endpoint로 준비합니다. `publicHttpsSelfService: true`일 때만 HTTPS 443이 직접 등록 대상이며, 별도 포트는 exact `allowedOrigins` 승인이 필요합니다. 공개 HTTP endpoint는 허용하지 않습니다.
3. LAN·VPN 등 사설망 endpoint는 스트리머가 직접 승인할 수 없습니다. 운영자가 대상 exact origin을 `allowedOrigins`에, 해당 사설 주소 범위를 `allowedCidrs`에 함께 등록합니다. wildcard, 경로, query, fragment, URL 사용자 정보는 허용되지 않습니다.
4. 아래 절차로 전용 암호화 키 파일을 준비합니다.
5. `npm run validate:config`와 production runtime 검증을 통과시킨 뒤 서버를 재시작합니다.

운영자는 공통 저장소와 outbound 정책만 준비하며, 각 스트리머의 서버 URL이나 `AdminPassword`를 대신 입력하지 않습니다.

고정 secret을 `10001:10001`, `0400`으로 준비한 뒤에는 실제 컨테이너 UID로 읽기 권한까지 검증합니다.

```bash
npm run validate:config
docker compose -f docker-compose.yml -f docker-compose.production.yml run --rm --no-deps -e NODE_ENV=production server node apps/server/dist/scripts/validate-runtime-config.js
```

설정 schema v2는 다음 일곱 필드만 허용합니다.

```json
{
  "version": 2,
  "enabled": true,
  "publicHttpsSelfService": true,
  "allowedOrigins": [],
  "allowedCidrs": [],
  "timeoutMs": 5000,
  "pollIntervalMs": 30000
}
```

v1은 기존 exact schema 그대로 계속 읽으며 `publicHttpsSelfService: false`로 취급합니다. v2에서는 `publicHttpsSelfService`가 필수 boolean이고 unknown field는 거부됩니다. 설정 파일은 읽을 때 자동 변환하거나 재작성하지 않습니다.

`timeoutMs`는 1000~30000ms, `pollIntervalMs`는 5000~300000ms 범위입니다. 문서와 예제에는 실제 내부 Palworld origin을 기록하지 않습니다.

`allowedOrigins`와 `allowedCidrs`는 비밀값이 아닌 outbound 정책이지만 내부 네트워크 구조를 드러낼 수 있습니다. 배포별 정책은 read-only config 마운트에서 관리하며 private origin을 문서나 로그에 복사하지 않습니다. config 파일은 symlink가 아닌 regular file이어야 하고 group/other writable 권한을 허용하지 않습니다. 공개 HTTP 주소를 allowlist로 우회해 허용하지 않습니다.

공개 HTTPS self-service는 기본 443 포트의 정상 hostname, root path, query·fragment·userinfo 없음 조건을 모두 만족해야 합니다. IP literal과 encoded path 우회는 거부하고, 매 probe마다 DNS를 다시 조회해 모든 결과가 globally routable public IP인지 확인한 뒤 실제 연결 주소를 pinning합니다. redirect는 따라가지 않으며 TLS 인증서와 hostname 검증을 유지합니다.

Dashboard 응답은 다음 exact `registrationPolicy` metadata만 스트리머 UI에 제공합니다. 내부 allowlist나 네트워크 구조는 제공하지 않습니다.

```json
{
  "publicHttpsSelfService": true,
  "publicHttpsPort": 443,
  "privateNetworkRequiresOperatorApproval": true
}
```

기능이 비활성화되었거나 운영 준비 오류가 발생하면 `publicHttpsSelfService`는 안전 기본값인 `false`로 내려갑니다. Dashboard에는 allowlist를 편집하거나 사설망을 승인하는 owner UI를 두지 않습니다.

## 스트리머별 연결 등록

운영자의 1회 준비가 완료된 뒤 각 스트리머가 자신의 Dashboard에서 다음 절차를 수행합니다.

1. `publicHttpsSelfService: true`인 배포에서는 `https://`와 443 포트를 사용하는 공개 hostname을 직접 입력할 수 있습니다. 별도 포트의 공개 HTTPS 주소는 운영자의 exact `allowedOrigins` 승인 후 본인 Dashboard에서 등록합니다.
2. v1 또는 `publicHttpsSelfService: false`인 배포에서는 HTTPS 443을 포함한 모든 공개 주소가 운영자의 exact `allowedOrigins` 승인 대상입니다. 승인된 공개 HTTPS 별도 포트도 본인 Dashboard에서 등록할 수 있습니다.
3. LAN·VPN·사설 IP 또는 사설 DNS endpoint는 먼저 서버 운영자에게 exact origin과 CIDR 승인을 요청합니다. Dashboard 화면에서 스트리머가 직접 승인 범위를 넓힐 수 없습니다. 공개 `http://` 주소는 등록할 수 없습니다.
4. Palworld 전용 서버 설정의 `AdminPassword`를 입력해 연결 테스트를 실행합니다. 게임 참가 비밀번호와 Dashboard 로그인 비밀번호는 입력하지 않습니다.
5. `/v1/api/info`와 `/v1/api/metrics` 검증이 모두 성공한 경우에만 연결 정보를 저장합니다. 입력한 `AdminPassword`는 성공·실패 후 브라우저 입력 상태에서 비워지며 다시 표시되지 않습니다.

`AdminPassword`, Dashboard 로그인 비밀번호, Dashboard 자격 증명 암호화용 AES key는 서로 다른 값입니다. 스트리머는 `AdminPassword`만 연결 입력란에 넣습니다. AES key는 운영자가 서버에 한 번 준비하며 Dashboard UI에 입력하거나 표시하지 않습니다.

## 암호화 키 생성과 권한

키는 Dashboard에 저장되는 Palworld `AdminPassword`를 보호하기 위한 전용 AES key입니다. Dashboard 로그인 비밀번호나 Palworld `AdminPassword` 자체가 아닙니다. 정확히 32바이트인 base64 또는 64자리 hex 형식이어야 하며 Dashboard, Overlay, Bridge, Twitch, Riot, 지원 메일함, Cloudflare 등 다른 서비스 secret과 재사용하지 않습니다. 실제 키를 명령 출력, 로그, 문서, Git 또는 채팅에 남기지 않습니다.

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

Palworld의 평문 HTTP 서버까지 완전한 자가 등록이 필요해지더라도 중앙 서버의 public HTTP 또는 사설망 정책을 완화하지 않습니다. 그 요구는 스트리머 네트워크 안에서 outbound 연결을 만드는 로컬 agent 또는 인증된 relay 방식의 별도 설계 대상으로 다룹니다.
