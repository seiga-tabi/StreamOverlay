# Rollback 절차

## 사전 조건

릴리즈마다 현재 `Git SHA`, 배포 image digest, 이전 정상 image digest, config version을 기록합니다. database migration이나 비가역 데이터 변경이 포함된 릴리즈는 이 절차만으로 되돌리지 말고 사람 승인을 받습니다.

## 실행

1. 장애 시각, 증상, 현재 Git SHA와 image digest를 기록합니다.
2. 트래픽 전환 또는 배포를 중지합니다.
3. 운영 secret 저장소의 `YORO_SERVER_IMAGE`를 이전 정상 image digest로 지정합니다.
4. volume과 상태 디렉터리를 삭제하지 않고 컨테이너만 교체합니다.
5. liveness, readiness, 핵심 공개 화면과 OAuth callback을 확인합니다.

```bash
IMAGE_REPOSITORY="registry.example.invalid/yoro-server"
PREVIOUS_GOOD_DIGEST="sha256:확인한-이전-이미지-digest"
docker image inspect "${IMAGE_REPOSITORY}@${PREVIOUS_GOOD_DIGEST}"
YORO_SERVER_IMAGE="${IMAGE_REPOSITORY}@${PREVIOUS_GOOD_DIGEST}" docker compose up -d --no-build server
docker compose ps
docker compose logs --tail=200 server
curl -fsS https://yoro.gg/health/live
curl -fsS https://yoro.gg/health/ready
```

## Config rollback

- 환경변수 변경은 secret 저장소의 이전 version으로 복구합니다.
- secret 자체를 이전 값으로 되돌려야 하는 경우 노출 여부를 먼저 판단합니다. 노출된 secret은 재사용하지 않고 rotation합니다.
- Twitch OAuth token 암호화 migration이 완료된 뒤 암호화 형식을 지원하지 않는 image로 되돌리려면, 컨테이너 교체 전에 배포 전 token state backup과 당시 key version의 호환성을 확인합니다.
- 이전 image는 암호화된 token 파일을 읽지 못하므로 이전 immutable image와 배포 직전 평문 state snapshot을 반드시 함께 복원합니다.
- snapshot은 application state directory 외부의 storage-level encryption이 적용된 저장소에서 가져오고 directory `0700`, file `0600`을 다시 확인합니다.
- token state를 복원하기 전 현재 암호문을 별도 격리 보존하고 방송이 중지된 승인된 유지보수 시간에만 atomic restore를 수행합니다.
- encryption key를 분실한 경우 암호문은 복구할 수 없으며, backup이 없으면 Twitch OAuth 재승인이 필요합니다.
- 분기별 복구 훈련에서 격리 환경에 snapshot을 복원하고 이전 image의 health, tenant별 token metadata, 두 번째 재시작까지 확인합니다.
- Nginx/Cloudflare 변경은 승인된 이전 설정으로 되돌린 뒤 HTTP redirect, HSTS와 CSP를 다시 확인합니다.

## 금지

- `docker compose down -v`
- production volume 삭제
- 검증되지 않은 database downgrade
- `git reset --hard`, force push
- 백업 확인 없는 상태 파일 덮어쓰기
