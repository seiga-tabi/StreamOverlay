# Rollback 절차

## 사전 조건

릴리즈마다 현재 `Git SHA`, 배포 image digest, 이전 정상 image digest, config version을 기록합니다. database migration이나 비가역 데이터 변경이 포함된 릴리즈는 이 절차만으로 되돌리지 말고 사람 승인을 받습니다.

## 실행

1. 장애 시각, 증상, 현재 Git SHA와 image digest를 기록합니다.
2. 트래픽 전환 또는 배포를 중지합니다.
3. 운영 secret 저장소의 `YORO_SERVER_IMAGE`를 이전 정상 image digest로 지정합니다.
4. volume과 상태 디렉터리를 삭제하지 않고 컨테이너만 교체합니다.
5. liveness, readiness, 핵심 공개 화면, OAuth callback과 OBS overlay를 확인합니다.

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
- Nginx/Cloudflare 변경은 승인된 이전 설정으로 되돌린 뒤 HTTP redirect, HSTS, CSP, WebSocket을 다시 확인합니다.

## 금지

- `docker compose down -v`
- production volume 삭제
- 검증되지 않은 database downgrade
- `git reset --hard`, force push
- 백업 확인 없는 상태 파일 덮어쓰기
