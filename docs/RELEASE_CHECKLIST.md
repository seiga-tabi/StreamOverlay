# YORO.gg Production Release Checklist

이 문서는 배포 승인용 체크리스트다. 체크되지 않은 `BLOCKER` 항목이 하나라도 있으면 출시하지 않는다.

## 1. Release Freeze

- [ ] `git status --short`의 모든 변경 파일을 소유 Sprint와 기능 범위로 분류했다.
- [ ] 범위 밖 변경과 임시 산출물을 release branch에서 제외했다.
- [ ] 한 커밋에 UI, 서버 보안, 운영 문서를 섞지 않았다.
- [ ] `git rev-parse HEAD` 결과를 release 기록에 남겼다.
- [ ] release candidate의 annotated tag와 rollback tag 후보를 승인했다.
- [ ] commit/tag 생성은 Release Manager의 명시적 승인 후 수행한다.

권장 커밋 순서:

1. `fix: build production artifacts with traceable metadata`
2. `fix: enforce production runtime and network safeguards`
3. `fix: persist broadcast state and expose dependency readiness`
4. `fix: add external api timeouts and bounded caches`
5. `chore: add backup release and rollback runbooks`
6. `ci: add production readiness gates`

## 2. Runtime Configuration

- [ ] **BLOCKER** `DASHBOARD_AUTH_TOKEN`, `OVERLAY_ACCESS_TOKEN`, `BRIDGE_SHARED_SECRET`를 각각 다른 32자 이상 난수로 발급했다.
- [ ] secret은 저장소와 shell history가 아닌 운영 secret manager 또는 Docker secret file에 저장했다.
- [ ] `.env` 또는 secret 파일 권한이 소유자 전용(`0600`)이다.
- [ ] `PUBLIC_BASE_URL`, `DASHBOARD_BASE_URL`, `OVERLAY_BASE_URL`이 운영 HTTPS URL이다.
- [ ] Twitch dashboard의 두 callback URL이 코드 설정과 정확히 일치하는 HTTPS URL이다.
- [ ] `CORS_ORIGINS`가 정확한 운영 origin만 포함하며 wildcard가 없다.
- [ ] `npm run validate:runtime`가 production 환경으로 통과한다.
- [ ] validation 로그에 secret 원문이 노출되지 않는다.

## 3. Build And Artifact

- [ ] `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`가 통과한다.
- [ ] `npm audit --audit-level=high`가 통과한다.
- [ ] Docker build에 `APP_VERSION`, `GIT_SHA`, `BUILD_TIME`을 전달했다.
- [ ] Docker dashboard JS에 React 개발 빌드 문구가 없다.
- [ ] image를 `yoro-server:<version>-<short-sha>`와 immutable digest로 기록했다.
- [ ] `/health/live`의 build metadata가 배포 SHA와 일치한다.

## 4. Persistence And Recovery

- [ ] `node scripts/rehearse-backup-restore.mjs`가 CI에서 통과한다.
- [ ] `yoro-backup.timer`가 enabled/active이고 최근 backup journal이 성공이다.
- [ ] 배포 직전 `npm run backup:state`를 실행하고 manifest 무결성을 확인했다.
- [ ] 별도 테스트 경로에서 restore dry-run과 복구 리허설을 완료했다.
- [ ] 최근 30일 내 production-like staging 복구 훈련 결과가 `docs/operations/RECOVERY_REHEARSAL_LOG.md`에 기록되었다.
- [ ] 참여 대기열/운영 상태가 재시작 후 복원되는 것을 staging에서 확인했다.
- [ ] 저장 실패가 로그와 `/health/ready`에 반영되는 것을 확인했다.
- [ ] 백업 보관 위치, 암호화, 접근 권한, 보관 기간을 운영 정책에 기록했다.

## 5. Network And Proxy

- [ ] **BLOCKER** Cloudflare SSL/TLS가 `Full (strict)`이며 유효한 origin 인증서를 사용한다.
- [ ] **BLOCKER** Cloudflare 또는 origin proxy에서 HTTP를 HTTPS로 redirect한다.
- [ ] HSTS 응답을 HTTPS에서 확인했다. preload는 별도 승인 전 사용하지 않는다.
- [ ] origin app port가 public interface에 노출되지 않고 loopback 또는 내부 network에만 bind된다.
- [ ] 서버 방화벽에서 Cloudflare Tunnel 우회 경로가 차단되어 있다.
- [ ] `/dashboard/config.js` 응답이 `Cache-Control: no-store`이며 CDN cache가 우회된다.
- [ ] DB/Redis를 도입한 경우 public port가 없는지 확인했다.

## 6. External And Legal

- [ ] **BLOCKER** Riot production key와 public service 승인을 계정 소유자가 확인했다.
- [ ] **BLOCKER** Twitch application callback과 EventSub 권한/scope를 운영 계정에서 확인했다.
- [ ] **BLOCKER** 개인정보 처리방침의 운영자 정보, 처리 목적, 보관 기간, 파기 절차, 문의 주소를 법률 검토 후 확정했다.
- [ ] **BLOCKER** 모든 `LEGAL_*` production 환경변수를 승인 문안과 동일하게 설정했고 `npm run validate:runtime`가 통과했다.
- [ ] **BLOCKER** 개인정보 처리방침과 이용약관에서 개발 미리보기 경고가 사라지고 확정 시행일이 표시된다.
- [ ] **BLOCKER** 수탁자·국외 이전 공개 내용이 실제 Cloudflare/호스팅/메일/Riot/Twitch 처리 구조와 일치한다.
- [ ] **BLOCKER** KR/JP 대상 서비스의 미성년자, 준거법, 관할과 소비자 강행규정을 법률 전문가가 확인했다.
- [ ] `support@yoro.gg` MX, inbound routing, DKIM/SPF/DMARC, 관리자 수신함을 실메일로 검증했다.
- [ ] canonical domain, sitemap domain, robots 정책을 확정했다.

## 7. Deployment Gate

- [ ] `.github/workflows/ci.yml`, `edge-monitor.yml`, `staging-smoke.yml`이 release branch에 tracked 상태로 존재하고 GitHub에서 실행된다.
- [ ] staging에서 로그인, Riot 검색, Twitch 연결, EventSub, OBS overlay, 시청자 참여 smoke가 통과했다.
- [ ] staging smoke artifact와 수동 실계정 결과가 `docs/operations/STAGING_E2E_LOG.md`에 기록되었다.
- [ ] `/health/live`는 200, `/health/ready`는 200이다.
- [ ] SIGTERM 배포 종료 시 신규 요청이 차단되고 상태 flush 후 정상 종료한다.
- [ ] 오류율, latency, memory, disk, restart count, backup 실패 알림이 준비되었다.
- [ ] `node scripts/verify-production-edge.mjs --base-url=https://<production-host>`가 통과한다.
- [ ] edge/backup/disk test alert와 recovery alert를 실제 on-call 채널에서 수신했다.
- [ ] rollback 담당자와 이전 image digest를 배포 전에 확인했다.

## 8. Tag Procedure

승인 후에만 실행한다.

```bash
git switch -c codex/release-vX.Y.Z
git tag -a vX.Y.Z-rc.1 <release-sha> -m "YORO.gg vX.Y.Z release candidate 1"
git tag -a rollback/vX.Y.Z <previous-production-sha> -m "Rollback point before vX.Y.Z"
```

Production 승격 후 `vX.Y.Z` tag를 같은 검증 SHA에 생성한다. tag와 image digest를 release note에 함께 기록한다.
