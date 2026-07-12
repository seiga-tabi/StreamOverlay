# 외부 서비스 및 법적 출시 조건

## 코드로 검증 가능한 항목

- [ ] production runtime URL이 HTTPS이고 localhost가 아니다.
- [ ] Twitch callback URL 형식이 HTTPS이다.
- [ ] secret 길이, 중복 사용, 약한 기본값, 파일 권한을 validation이 거부한다.
- [ ] runtime config JS가 `no-store`이다.
- [ ] favicon과 sitemap asset이 build artifact에 존재한다.
- [ ] legal page가 승인 전 검색 노출되지 않도록 release gate에서 차단한다.

## 사람이 확인해야 하는 BLOCKER

### Riot

- [ ] public service용 production API key 승인 상태
- [ ] 등록한 서비스 URL과 실제 canonical domain 일치
- [ ] Riot Games 정책 고지 문구와 로고/asset 사용 정책 검토
- [ ] rate limit 상향 필요 여부와 연락 담당자

### Twitch

- [ ] Creator Console callback URL과 `TWITCH_REDIRECT_URI` 일치
- [ ] public viewer callback URL과 `TWITCH_PUBLIC_REDIRECT_URI` 일치
- [ ] EventSub subscription별 OAuth scope 승인
- [ ] 운영 broadcaster/bot 계정 연결 및 만료 token 재연결 절차

### Mail And DNS

- [ ] `support@yoro.gg` MX가 실제 inbound provider를 가리킨다.
- [ ] inbound routing이 webhook까지 전달되고 관리자 수신함에서 확인된다.
- [ ] SPF, DKIM, DMARC alignment와 보고 주소가 운영팀 소유이다.
- [ ] 메일 보관 기간과 삭제 요청 처리 절차를 개인정보 문서에 반영했다.

확인 명령 예시:

```bash
dig +short MX yoro.gg
dig +short TXT yoro.gg
dig +short TXT _dmarc.yoro.gg
```

DNS 전파와 provider 상태는 명령 결과만으로 최종 승인하지 않고 실제 송수신 테스트를 수행한다.

### Legal

- [ ] 법률 전문가가 KR/JP 제공 범위와 개인 운영자의 소재지를 기준으로 최종 문안을 검토했다.
- [ ] `LEGAL_OPERATOR_NAME`, `LEGAL_CONTACT_ADDRESS`에 개인 운영자의 법적 이름과 연락 주소를 입력했다.
- [ ] `LEGAL_PRIVACY_OFFICER_NAME`, `LEGAL_CONTACT_EMAIL`, 선택 항목인 `LEGAL_CONTACT_PHONE`을 실제 응대 가능한 정보로 입력했다.
- [ ] `LEGAL_EFFECTIVE_DATE`를 승인된 시행일의 `YYYY-MM-DD` 값으로 입력했다.
- [ ] `LEGAL_GOVERNING_LAW_KO/JA`, `LEGAL_DISPUTE_VENUE_KO/JA`를 소비자 강행규정과 운영자 소재지에 맞게 확정했다.
- [ ] 수집 항목과 처리 목적
- [ ] Riot ID, Twitch ID, 로그, 참여·커뮤니티 데이터, 문의 메일의 실제 보관·파기 동작이 공개 문서와 일치한다.
- [ ] `LEGAL_PROCESSORS_KO/JA`에 호스팅, CDN/보안, 이메일 수신 등 실제 수탁자와 업무·항목·기간을 기재했다.
- [ ] `LEGAL_CROSS_BORDER_TRANSFER_KO/JA`에 이전받는 자, 국가, 항목, 목적, 시점·방법, 보유기간과 보호조치를 기재했다.
- [ ] 삭제·열람·정정 요청 경로
- [ ] `LEGAL_MINIMUM_AGE`와 법정대리인 동의 절차가 KR/JP 대상 이용자에게 적절한지 검토했다.
- [ ] 쿠키/session 정책
- [ ] 승인된 개인정보 처리방침과 이용약관의 시행일
- [ ] production 환경에서 `npm run validate:runtime`가 법적 운영정보를 포함해 통과한다.
- [ ] `/dashboard/config.js`에 공개 운영정보만 포함되고 secret이 포함되지 않는다.

필수 운영정보가 비어 있거나 `미정`, `초안`, `TBD` 같은 placeholder이면 production runtime validation이 실패한다. 코드 검증 통과는 변호사·행정사 등 자격 있는 전문가의 개별 법률 자문을 대체하지 않는다.
