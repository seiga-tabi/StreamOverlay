# 운영자 수동 확인 체크리스트

아래 항목은 로컬 코드 검사만으로 GO 판정을 내릴 수 없습니다. 운영자가 실제 환경에서 확인하고 날짜와 담당자를 기록해야 합니다.

## Runtime 설정

- [ ] `/etc/yoro/runtime.json`에 공개 origin, 공개 client/application ID와 feature flag를 확정했다.
- [ ] `/etc/yoro/legal.json`에 실제 법적 운영정보를 확정했다.
- [ ] `/etc/yoro/secrets`는 `0700`, 활성 기능의 secret file은 `0600`이며 symlink가 아니다.
- [ ] 실제 Riot/Twitch/Discord 자격 증명을 목적별 secret file로 분리했다.
- [ ] Server, Discord Bot, Agent에 필요한 secret만 각각 mount했다.
- [ ] image의 `APP_VERSION`, `GIT_SHA`, `BUILD_TIME`이 실제 release와 일치한다.
- [ ] 다른 secret과 재사용하지 않은 Twitch·Discord encryption key를 별도 secret file에 입력했다.
- [ ] Twitch OAuth token state의 배포 전 backup과 암호화 migration rollback 절차를 확인했다.
- [ ] backup이 application state directory 외부의 암호화 저장소에 있고 `0700`/`0600` 권한을 사용한다.
- [ ] staging에서 명시적 token migration 후 첫 번째·두 번째 재시작과 backup 복원 훈련을 통과했다.
- [ ] production 호스트와 Compose에 운영 `.env`가 남아 있지 않다.
- [ ] `npm run config:check`가 통과했다.
- [ ] `npm run secrets:check`가 활성 기능의 필수 secret만 검증하고 통과했다.
- [ ] `npm run config:explain`이 값 없이 기능별 구성 상태만 출력했다.
- [ ] `npm run validate:runtime`이 통과했다.
- [ ] 검증 로그에 secret 값이 노출되지 않았음을 확인했다.

## Edge와 DNS

- [ ] `http://yoro.gg`가 HTTPS로 redirect된다.
- [ ] HTTPS에 HSTS가 있고 인증서 자동 갱신이 정상이다.
- [ ] `/dashboard/config.js`가 `no-store`이며 Cloudflare cache에 남지 않는다.
- [ ] origin application port는 인터넷에 직접 노출되지 않는다.
- [ ] WebSocket upgrade가 정상이다.

## Alert와 timer

- [ ] `OPS_ALERT_WEBHOOK_URL`과 secret을 운영 secret 저장소에 설정했다.
- [ ] `npm run ops:test-alert:success` 알림을 실제 수신했다.
- [ ] `npm run ops:test-alert:failure` 알림을 실제 수신했다.
- [ ] `yoro-edge-monitor.timer`와 `yoro-backup.timer`가 active다.
- [ ] disk, restart, readiness, backup 지연·실패 알림을 실제 수신했다.

## 외부 서비스 E2E

- [ ] Riot production key 승인, 허용 도메인과 quota를 확인했다.
- [ ] 운영 Twitch 계정의 로그인, 갱신, callback HTTPS와 EventSub 재연결을 확인했다.
- [ ] OBS Browser Source URL, token, preview, test event를 실제 OBS에서 확인했다.
- [ ] Twitch live/offline 상태가 실제 방송 상태와 일치한다.
- [ ] rate limit/timeout 상황에서 사용자 오류 화면과 운영 로그를 확인했다.

## 문의·법적·광고

- [ ] `support@yoro.gg` MX 및 수신 경로를 확인했다.
- [ ] 외부 메일 발송부터 관리자 문의함 표시와 답변까지 확인했다.
- [ ] 개인정보 처리방침과 이용약관을 관할 법률 전문가 또는 책임자가 검토했다.
- [ ] 운영자 정보, 보관 기간, 국외 이전, 처리 위탁, 시행일을 실제 값으로 확정했다.
- [ ] `https://yoro.gg/ads.txt`의 publisher ID와 판매자 관계가 AdSense 콘솔의 제공 행과 정확히 일치한다.
- [ ] Search Console의 `yoro.gg` 도메인 속성 소유권을 확인하고 `https://yoro.gg/sitemap.xml`을 제출했다.
- [ ] sitemap URL의 title, canonical과 실제 최종 URL이 일치한다.
- [ ] `www.yoro.gg`와 HTTP 변형이 `https://yoro.gg`로 영구 redirect된다.
- [ ] AdSense는 동의 전 요청이 없고 동의 후에만 로드된다.
- [ ] 필요한 지역에서는 Google 인증 CMP를 연결하고 동의 철회를 제공한다.

## 복구 훈련

- [ ] 최근 backup으로 격리 restore를 수행했다.
- [ ] 복원된 상태의 무결성과 서비스 기동을 확인했다.
- [ ] RTO/RPO, 훈련 일시, backup ID, 담당자와 결과를 기록했다.
