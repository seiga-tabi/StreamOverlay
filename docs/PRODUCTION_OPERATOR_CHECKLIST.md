# 운영자 수동 확인 체크리스트

아래 항목은 로컬 코드 검사만으로 GO 판정을 내릴 수 없습니다. 운영자가 실제 환경에서 확인하고 날짜와 담당자를 기록해야 합니다.

## Runtime 설정

- [ ] 실제 `LEGAL_*` 운영정보와 Riot/Twitch 자격 증명을 운영 secret 저장소에 입력했다.
- [ ] `chmod 600 .env`로 환경 파일 권한을 제한했다.
- [ ] `npm run configure:production -- --domain yoro.gg` dry-run이 통과했다.
- [ ] `npm run configure:production -- --domain yoro.gg --write` 후 `npm run validate:runtime`이 통과했다.
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
- [ ] AdSense는 동의 전 요청이 없고 동의 후에만 로드된다.
- [ ] 필요한 지역에서는 Google 인증 CMP를 연결하고 동의 철회를 제공한다.

## 복구 훈련

- [ ] 최근 backup으로 격리 restore를 수행했다.
- [ ] 복원된 상태의 무결성과 서비스 기동을 확인했다.
- [ ] RTO/RPO, 훈련 일시, backup ID, 담당자와 결과를 기록했다.
