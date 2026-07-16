# 릴리즈 체크리스트

## 1. Freeze와 재현성

- [ ] 배포 범위가 승인되었고 `git status --short`의 변경 파일이 설명 가능하다.
- [ ] CI workflow와 visual baseline이 Git 추적 대상이다.
- [ ] `Git SHA`, image tag, registry digest를 릴리즈 기록에 연결했다.
- [ ] 이전 정상 image digest를 rollback image로 지정했다.
- [ ] release tag와 rollback tag 명령은 승인 후에만 실행한다.

태그 명령 예시:

```bash
VERSION="0.1.0"
APPROVED_GIT_SHA="$(git rev-parse HEAD)"
PREVIOUS_GOOD_GIT_SHA="확인한-이전-Git-SHA"
git tag -a "v${VERSION}" "${APPROVED_GIT_SHA}" -m "YORO.gg v${VERSION}"
git tag -a "rollback/v${VERSION}" "${PREVIOUS_GOOD_GIT_SHA}" -m "Rollback point for v${VERSION}"
```

## 2. 자동 검증

- [ ] lint, typecheck, build, test가 통과했다.
- [ ] `npm test`가 Playwright desktop/mobile pixel diff까지 실행했다.
- [ ] CSS token/override 검사와 bundle budget이 통과했다.
- [ ] Linux CI baseline과 현재 개발 플랫폼 baseline의 무결성이 통과했다.
- [ ] Linux Playwright desktop/mobile pixel diff가 통과했다.
- [ ] safe dummy production 환경의 runtime validation이 통과했다.
- [ ] Docker production artifact에 React development 문구가 없다.
- [ ] `npm audit --audit-level=high`가 통과했다.
- [ ] backup/restore rehearsal이 통과했다.

## 3. 운영 환경

- [ ] production `.env` 또는 secret file 권한이 `0600`이다.
- [ ] HTTP redirect, HSTS, CSP, CORS와 runtime config `no-store`를 확인했다.
- [ ] origin 포트가 공용 인터페이스에 노출되지 않는다.
- [ ] liveness/readiness가 각각 정상이며 의존성 실패 시 readiness가 503을 반환한다.
- [ ] backup/monitor systemd timer가 활성 상태다.
- [ ] 성공/실패 alert webhook을 실제 수신했다.

## 4. 외부 서비스와 법적 확인

- [ ] Riot production key 승인과 quota를 확인했다.
- [ ] Twitch OAuth callback URL과 EventSub를 운영 계정으로 확인했다.
- [ ] OBS Browser Source, token, test event를 staging에서 확인했다.
- [ ] `support@yoro.gg` 송수신과 관리자 문의함 수신을 확인했다.
- [ ] 개인정보 처리방침과 이용약관의 운영자 정보, 보관 기간, 시행일을 사람이 검토했다.
- [ ] AdSense를 사용할 경우 Google 동의 관리 요건과 CMP 연동을 확인했다.

세부 수동 검증은 [운영자 체크리스트](PRODUCTION_OPERATOR_CHECKLIST.md)에 기록합니다.
