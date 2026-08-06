# Palworld 서버 상태 운영 설정

Palworld 서버 상태 기능은 Dashboard 브라우저가 전용 서버에 직접 연결하지 않도록 `apps/server`에서만 REST API를 조회합니다. 다른 서비스 secret을 사용하지 않습니다.

## 고정 경로

- 비밀이 아닌 설정: `/app/apps/server/config/palworld-server-status.json`
- 컨테이너 secret: `/run/palworld-credentials/palworld-server-credentials-encryption-key`
- 암호화 state: `/app/.streamops/palworld-server-connections.json.enc`

운영 Compose는 `palworld_credentials`와 `streamops_state` named volume을
사용합니다. `palworld-credentials-init` 서비스가 server보다 먼저 실행되어
key를 최초 1회만 생성하고 디렉터리·파일 권한을 보정합니다. 이후 배포에서는
기존 key bytes를 그대로 검증해 재사용하며 새 key로 교체하지 않습니다.
Palworld 전용 환경 변수나 Dashboard 입력으로 경로를 바꿀 수 없습니다.
Compose 밖에서 실행할 때 state의 상위 디렉터리는 기존 공통
`STREAMOPS_STATE_DIR` 설정을 따르지만, 파일명은 항상
`palworld-server-connections.json.enc`로 고정됩니다.

`STREAMOPS_STATE_DIR`는 StreamOps 프로세스 전용 디렉터리여야 하며 leaf 이름도 `.streamops`, `streamops`, `streamops-*` 또는 `streamops_*` 형식이어야 합니다. filesystem root, home, 임시 디렉터리 자체, `/app` 같은 broad 경로, 다른 서비스와 공유하는 디렉터리 또는 symlink가 포함된 경로는 사용할 수 없습니다. 저장소는 이 조건을 확인한 뒤에만 디렉터리 `0700`과 파일 `0600`을 적용합니다.

## 운영자 1회 준비

1. `apps/server/config/palworld-server-status.json`의 `enabled`를 `true`로 변경합니다.
2. 공개 인터넷 서버는 신뢰할 수 있는 인증서가 적용된 HTTPS endpoint로 준비합니다. `publicHttpsSelfService: true`일 때만 HTTPS 443이 직접 등록 대상이며, 별도 포트는 exact `allowedOrigins` 승인이 필요합니다. 공개 HTTP endpoint는 허용하지 않습니다.
3. LAN·VPN 등 사설망 endpoint는 스트리머가 직접 승인할 수 없습니다. 운영자가 대상 exact origin을 `allowedOrigins`에, 해당 사설 주소 범위를 `allowedCidrs`에 함께 등록합니다. wildcard, 경로, query, fragment, URL 사용자 정보는 허용되지 않습니다.
4. 운영 checkout의 `deploy/production`에서 아래 원클릭 배포 명령을
   실행합니다. 전용 암호화 key 생성과 권한 보정은 Compose가 처리합니다.

   ```bash
   docker compose up -d --build --force-recreate --wait
   ```

5. `palworld-credentials-init`, `config-check`, `server` 순서가 성공했는지
   `docker compose ps`로 확인합니다.

운영자는 공통 저장소와 outbound 정책만 준비하며, 각 스트리머의 서버 URL이나 `AdminPassword`를 대신 입력하지 않습니다.

초기화 서비스는 network를 사용하지 않고 root filesystem을 read-only로
유지합니다. key volume과 state volume에만 쓰며, 생성한 key는 UID/GID
`10001:10001`, mode `0400`, state 디렉터리는 `0700`으로 제한합니다.

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

`/v1/api/metrics`는 확인된 Palworld 필드만 허용합니다. Palworld 1.0.2 응답에 추가된
`serverfpsaverage`는 optional 유한 숫자로 검증하며, 임의의 unknown field는 계속
차단합니다. 또한 Palworld REST 구현체가 base camp가 없는 응답에서 `basecampnum`을
생략하는 호환 사례는 `0`으로 정규화합니다. `/info`만 성공하고
`/metrics`가 실패하면 전체 연결 실패로 숨기지 않고 `degraded` 상태와 안전한 원인
코드(시간 초과, HTTP 상태, 응답 형식)를 Dashboard에 표시합니다. 원문 REST 응답과
`AdminPassword`는 표시하거나 로그에 기록하지 않습니다.

`AdminPassword`, Dashboard 로그인 비밀번호, Dashboard 자격 증명 암호화용 AES key는 서로 다른 값입니다. 스트리머는 `AdminPassword`만 연결 입력란에 넣습니다. AES key는 운영자가 서버에 한 번 준비하며 Dashboard UI에 입력하거나 표시하지 않습니다.

## 암호화 키 자동 초기화와 보존

키는 Dashboard에 저장되는 Palworld `AdminPassword`를 보호하기 위한 전용 AES key입니다. Dashboard 로그인 비밀번호나 Palworld `AdminPassword` 자체가 아닙니다. 정확히 32바이트인 base64 또는 64자리 hex 형식이어야 하며 Dashboard, Twitch, Riot, 지원 메일함, Cloudflare 등 다른 서비스 secret과 재사용하지 않습니다. 실제 키를 명령 출력, 로그, 문서, Git 또는 채팅에 남기지 않습니다.

최초 배포에서 암호화 state가 없을 때만 `palworld-credentials-init`가
`crypto.randomBytes(32)`로 key를 생성합니다. 반복 실행, image 재빌드,
`--force-recreate`, 일반 `docker compose down` 이후에는 named volume의 기존
key를 그대로 재사용합니다.

다음 상황에서는 자동 복구하거나 새 key를 만들지 않고 fail-closed합니다.

- 기존 암호문이 있는데 key가 없음
- 기존 key 형식이 손상됨
- key 또는 state가 symlink·비정규 파일임
- 기존 암호문을 key로 인증할 수 없음
- volume 권한을 안전하게 보정할 수 없음

`docker compose down -v`, `docker volume rm
yoro-production_palworld_credentials`, `docker system prune --volumes`는 key를
삭제할 수 있으므로 사용하지 않습니다. key와 ciphertext backup은 서로
분리된 암호화 backup에 보관합니다.

## 기존 암호문 마이그레이션

기존 기본 state 경로, AES-256-GCM envelope와 AAD는 유지되므로 기존 암호화 파일은 재암호화할 필요가 없습니다.

1. 서버를 중지하고 persistent volume의 암호화 파일과 기존 Palworld AES
   key를 서로 분리된 암호화 저장소에 backup합니다.
2. 기본 `streamops_state` volume을 계속 사용하고 암호문이 아직 없다면 별도
   migration 없이 원클릭 배포를 실행합니다.
3. 기존 암호문이 있다면 신규 key를 생성하지 않습니다. 기존 암호문을 만들
   때 사용한 key를 `palworld_credentials` volume에 먼저 복원해야 합니다.
   `/absolute/key-backup`은 key backup 파일이 있는 디렉터리로 바꿉니다.

   ```bash
   docker compose run --rm --no-deps --user 0 \
     -v /absolute/key-backup:/restore:ro \
     palworld-credentials-init sh -c \
     'install -o 10001 -g 10001 -m 0400 /restore/palworld-server-credentials-encryption-key /run/palworld-credentials/palworld-server-credentials-encryption-key'
   ```

   이 명령은 key 값을 stdout이나 shell history에 출력하지 않습니다.
4. 과거 custom state 경로를 사용했다면 서버가 중지된 동안 backup을 확인하고
   암호화 파일 자체를 기본 state volume으로 복사합니다. online migration은
   지원하지 않으며 파일 내용을 변환하거나 새 key로 재암호화하지 않습니다.
5. custom state 복사에는 root로 실행되는 일회성 offline helper를 사용합니다.
   `/absolute/backup/directory`는 실제 backup 디렉터리의 절대 경로로
   바꿉니다.

   ```bash
   docker compose run --rm --no-deps --user 0 \
     --cap-add CHOWN --cap-add FOWNER --cap-add DAC_OVERRIDE \
     -v /absolute/backup/directory:/migration:ro \
     server sh -c 'install -d -o 10001 -g 10001 -m 0700 /app/.streamops && install -o 10001 -g 10001 -m 0600 /migration/palworld-server-connections.json.enc /app/.streamops/palworld-server-connections.json.enc'
   ```

   기본 state volume의 UID와 mode 보정은 `palworld-credentials-init`가
   자동으로 수행합니다. 이 capability는 network가 차단된 일회성 초기화
   서비스에만 있으며 상시 `server` 서비스에는 추가하지 않습니다.

6. 원클릭 배포 명령을 실행합니다. 초기화 서비스가 기존 key로 암호문 인증까지
   통과해야 server가 시작됩니다.

다른 키를 사용하면 subsystem은 fail-closed하며 기존 ciphertext를 초기화하거나 덮어쓰지 않습니다. 키를 분실한 경우 기존 연결 설정은 복구할 수 없으므로 암호문 backup과 키 backup을 서로 분리해 관리합니다.

## 장애 범위

설정 파일 누락·schema 오류, allowlist 정책 누락, secret 누락·손상 또는 원격 Palworld 서버 장애는 Palworld subsystem에만 반영됩니다. LoL, Followers와 `/health/ready`는 해당 오류 때문에 실패하지 않습니다. Dashboard에는 내부 경로나 원시 오류 대신 안전한 한국어·일본어 운영 안내만 표시됩니다.

Palworld의 평문 HTTP 서버까지 완전한 자가 등록이 필요해지더라도 중앙 서버의 public HTTP 또는 사설망 정책을 완화하지 않습니다. 해당 서버는 운영자가 승인한 exact origin과 CIDR 정책을 통해서만 연결합니다.
