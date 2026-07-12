# Production Network Verification

## Application Defaults

- compose server port는 기본적으로 `127.0.0.1`에 bind한다.
- production HTTP 요청은 configured HTTPS URL로 redirect한다.
- HTTPS 응답에는 HSTS가 포함되며 preload는 사용하지 않는다.
- `/dashboard/config.js`는 application과 CDN 모두 `no-store`로 지정한다.

## Cloudflare

- SSL/TLS: `Full (strict)`
- Always Use HTTPS 또는 동등한 redirect rule
- origin certificate 검증
- `/dashboard/config.js` cache bypass rule
- WebSocket 허용
- health endpoint에 인증 우회가 필요한지 최소 범위 검토

현재 `http://gg.seigatabi.com`이 `200`을 반환하거나 HTTPS에 HSTS가 없다면 edge 설정이 완료되지 않은 상태다. 코드 배포만으로 Cloudflare edge 응답을 바꿀 수 없으므로 운영 계정에서 아래 순서로 적용한다.

1. SSL/TLS mode를 `Full (strict)`로 설정하고 origin certificate가 유효한지 확인한다.
2. `Always Use HTTPS` 또는 Redirect Rule로 `http://gg.seigatabi.com/*`를 동일 path의 HTTPS로 `301` 또는 `308` redirect한다.
3. redirect가 안정적으로 동작한 뒤 HSTS를 `max-age=15552000`으로 시작한다.
4. `includeSubDomains`는 모든 하위 도메인의 HTTPS를 확인한 뒤에만 활성화한다.
5. `preload`는 별도 승인 전 활성화하지 않는다.
6. Cache Rule에서 `/dashboard/config.js`를 cache bypass하고 origin의 `no-store`를 존중한다.
7. rule 적용 후 아래 자동 점검과 `curl`을 모두 통과시킨다.

```bash
node scripts/verify-production-edge.mjs --base-url=https://gg.seigatabi.com
curl -sS -o /dev/null -D - http://gg.seigatabi.com/
curl -sS -o /dev/null -D - https://gg.seigatabi.com/
curl -sS -o /dev/null -D - https://gg.seigatabi.com/dashboard/config.js
```

기대 결과:

- HTTP 응답은 `301`, `302`, `307`, `308` 중 하나이고 `Location`은 HTTPS다.
- HTTPS 응답에 `Strict-Transport-Security: max-age=...`가 있다.
- runtime config에 `Cache-Control: no-store`와 `Cloudflare-CDN-Cache-Control: no-store`가 있다.

## Origin Host

운영자가 서버에서 확인한다.

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml config
ss -lntp
curl -I http://127.0.0.1:3000/
curl -I -H 'X-Forwarded-Proto: https' http://127.0.0.1:3000/dashboard/config.js
curl --fail --silent http://127.0.0.1:3000/health/live
curl --fail --silent http://127.0.0.1:3000/health/ready
```

확인 항목:

- app port가 `0.0.0.0` 또는 public IP에 listen하지 않는다.
- host firewall이 app port 직접 접근을 차단한다.
- Cloudflare Tunnel 또는 reverse proxy만 loopback app port에 접근한다.
- DB/Redis를 추가하면 private network에만 두고 host port를 publish하지 않는다.
- HTTPS 응답에 `Strict-Transport-Security`가 있다.
- runtime config 응답에 `Cache-Control: no-store`와 `Cloudflare-CDN-Cache-Control: no-store`가 있다.
