# YORO 운영 설정

운영 설정 우선순위는 다음과 같습니다.

```text
TypeScript 기본값
→ /etc/yoro/runtime.json
→ test 전용 override
```

`YORO_CONFIG_FILE`이 설정되면 Server와 Discord Bot은 legacy `.env` 설정을
우선순위에 섞지 않습니다. 운영 Compose는 이 값을
`/etc/yoro/runtime.json`으로 고정합니다. 설정 파일이 없을 때만 로컬 개발
호환을 위해 기존 env parser를 사용합니다.

실제 운영값은 Git에 커밋하지 않습니다. 저장소에는 다음 예제만 둡니다.

- `config/runtime.example.json`
- `config/runtime.development.json`
- `config/legal.example.json`

`runtime.json`은 strict schema입니다. 알 수 없는 필드는 거부하며 password,
API key, token, encryption key, HMAC key를 넣을 수 없습니다.

Discord 일반 사용자 prefix 명령은 다음 공개 설정으로만 제어합니다.

```json
{
  "discord": {
    "prefixCommandsEnabled": false
  }
}
```

기본값은 `false`입니다. 활성화하면 Discord Bot이 `GUILD_MESSAGES`와
privileged `MESSAGE_CONTENT` intent를 추가하고 설치 URL이 `View Channels`,
`Send Messages`, `Embed Links` 권한만 요청합니다. Server와 Discord Bot은
반드시 같은 runtime 파일을 읽어야 합니다. token이나 secret을 이 설정에
추가하지 않습니다.

runtime 파일 모드에서는 legacy 일반 환경 변수와 `*_FILE` 경로 override를
적용하지 않습니다. 컨테이너 실행에 필요한 `NODE_ENV`,
`YORO_CONFIG_FILE`, image release metadata와 내부 filesystem 경로만 배포
manifest가 고정합니다.

법적 고지와 사업자 정보는 `/etc/yoro/legal.json`에 분리합니다. production
runtime mode에서는 이 파일이 필요합니다.

## 운영 파일 배치

```text
/etc/yoro/
├── runtime.json
├── legal.json
└── secrets/
```

운영 Git checkout의 `deploy/production` 디렉터리에는 `.env` 없이 build와
기동을 함께 수행하는 독립 Compose 구성이 있습니다.

```bash
cd deploy/production
docker compose up -d --build --force-recreate --wait
```

루트 `docker-compose.yml`은 로컬 개발 호환용이므로 운영 원클릭 명령은
반드시 `deploy/production`에서 실행합니다.

일반적인 준비 순서:

1. 예제 파일을 운영 호스트의 임시 경로에 복사합니다.
2. 공개 ID, origin, feature flag를 확정합니다.
3. `runtime.json`과 `legal.json`을 원자적으로 교체합니다.
4. `npm run config:check`로 schema를 확인합니다.
5. `npm run secrets:check`로 활성 기능의 secret만 확인합니다.
6. `npm run config:explain`으로 값이 아닌 구성 상태만 확인합니다.

명령 출력에는 secret 값, 길이, 일부 마스킹 값, DB hostname이 포함되지
않습니다.

저장소의 `docker-compose.production.yml`은 예제 runtime처럼 모든 기능을
활성화한 배포 manifest입니다. 특정 기능을 끈 배포에서는 해당 secret bind
mount도 배포 override에서 제거합니다. 애플리케이션은 비활성 기능의 secret
파일을 읽거나 요구하지 않습니다.

## 배포 정보

`APP_VERSION`, `GIT_SHA`, `BUILD_TIME`은 운영 설정이 아니라 immutable image
metadata입니다. Production Compose는 이미 빌드된 digest 기반 image를
요구하며 runtime config로 이 값을 덮어쓰지 않습니다.

## 호환 기간

runtime config가 없는 로컬 개발은 기존 env 방식을 잠시 지원합니다. 이
fallback은 production Compose에서 사용하지 않으며, staging 전환과 회귀
검증이 완료된 후 별도 변경으로 제거합니다.
