# YORO.gg Support Mail Worker

`support@yoro.gg`로 수신된 메일을 YORO.gg 서버의 서명 검증 webhook으로 전달한다.

## 배포 전 설정

1. 서버와 Worker에 동일한 32자 이상의 `SUPPORT_MAILBOX_WEBHOOK_SECRET`을 설정한다.
2. 서버에는 `SUPPORT_MAILBOX_ENCRYPTION_KEY`를 `openssl rand -base64 32`로 생성해 설정한다.
3. Node.js 22 이상 환경에서 Worker secret을 등록한다.

```bash
npx --yes wrangler@4.110.0 secret put SUPPORT_WEBHOOK_URL --config apps/email-worker/wrangler.jsonc
npx --yes wrangler@4.110.0 secret put SUPPORT_WEBHOOK_SECRET --config apps/email-worker/wrangler.jsonc
npm --workspace apps/email-worker run deploy
```

`SUPPORT_WEBHOOK_URL` 값은 공개 서버의 `/api/inbound-email/cloudflare` endpoint를 사용한다.
HTTPS 주소만 허용하며, URL 예시는 `https://gg.seigatabi.com/api/inbound-email/cloudflare`이다.

## Cloudflare Email Routing

1. Cloudflare Dashboard의 `Compute > Email Service > Email Routing`에서 `yoro.gg`를 활성화한다.
2. Cloudflare가 제안하는 MX, SPF, DKIM record를 적용한다.
3. `support@yoro.gg` custom address의 destination을 `yoro-support-mail-inbound` Worker로 지정한다.
4. 외부 메일 계정에서 테스트 메일을 보내고 관리자 페이지의 `문의 메일`에서 확인한다.

첨부파일의 내용과 HTML은 저장하지 않는다. 파일명, MIME type, 크기만 관리자 화면에 표시한다.
Cloudflare Email Routing은 수신 경로만 제공한다. 관리자 화면의 `답장하기`는 운영자의 메일 앱을 여는 방식이며 서버가 직접 발신하지 않는다.
