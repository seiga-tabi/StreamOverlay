# Google Analytics·AdSense·Search Console 등록 절차

이 문서는 `https://yoro.gg` 운영 배포를 기준으로 합니다. Google 계정의 소유권 승인이나 광고 정책 심사는 코드만으로 완료할 수 없으므로, 아래 코드 검증과 운영 콘솔 확인을 함께 수행합니다.

## 코드에 포함된 등록 정보

- Google Analytics 4 측정 ID: `G-SEG94KMT1H`
- AdSense 계정 메타 태그: `ca-pub-7880271953912430`
- 루트 판매자 선언: `https://yoro.gg/ads.txt`
- Search Console sitemap: `https://yoro.gg/sitemap.xml`
- crawler 정책: `https://yoro.gg/robots.txt`
- 공개 canonical 기준 origin: `https://yoro.gg`

`ads.txt`의 publisher ID와 `DIRECT` 관계는 배포 전에 AdSense의 **사이트 > ads.txt** 화면에서 제공되는 행과 정확히 일치하는지 운영자가 다시 확인해야 합니다.

## Google Analytics 연결

공개 페이지는 `G-SEG94KMT1H` Google tag를 한 번만 로드하고 SPA route 변경을
`page_view`로 전송합니다. `/admin`, `/dashboard`, `/login`, `/account`,
query와 hash도 전송하지 않습니다.

Consent Mode v2의 `analytics_storage`, `ad_storage`, `ad_user_data`,
`ad_personalization`은 기본 `denied`입니다. 따라서 기본 상태에서는 분석·광고
cookie를 만들지 않고 동의 상태가 포함된 제한적인 측정 ping만 전송합니다.
관할 지역에서 저장 기반 분석을 사용하려면 Google 인증 CMP에서 사용자 선택을
받고 consent update를 연결해야 합니다.

배포 후 Google Tag Assistant에서 `https://yoro.gg/`를 연결해
`G-SEG94KMT1H`가 감지되는지 확인하고, GA4 실시간 보고서와 DebugView에서
`page_view`를 확인합니다. SPA 중복 집계를 피하기 위해 Data Stream의
Enhanced Measurement에서 browser history 기반 page view를 별도로 켜지
않습니다.

## Search Console 등록

1. Search Console에서 `yoro.gg` **도메인 속성**을 추가합니다.
2. DNS TXT 소유권 확인을 완료합니다. 도메인 속성은 HTTP/HTTPS와 `www`를 함께 포함하므로 기본 등록 방식으로 사용합니다.
3. **Sitemaps**에서 `https://yoro.gg/sitemap.xml`을 제출합니다.
4. URL 검사에서 `/`, `/lol/aram`, `/palworld`, `/palworld/pals`를 각각 검사합니다.
5. `www.yoro.gg`와 HTTP 요청은 edge에서 `https://yoro.gg`로 영구 redirect되는지 확인합니다.

DNS 방식을 사용하는 동안 `google-site-verification` 메타 태그나 `google*.html` 파일은 필요하지 않습니다. HTML 검증 방식으로 바꾸려면 Google이 발급한 파일명과 본문을 그대로 추가해야 하며, 임의 토큰이나 placeholder를 배포하지 않습니다.

## AdSense 사이트 연결

공개 페이지의 `<head>`에서는 `ca-pub-7880271953912430`용 AdSense loader를
한 번만 생성합니다. SPA 이동 시에도 공개 LoL·Palworld·YORO Bot·커뮤니티
경로를 동일하게 지원하며 `/login`, `/account`, `/dashboard`, `/admin`,
비공개 경로에는 광고 loader를 추가하지 않습니다.

광고 태그를 불러오기 전에 Consent Mode v2의 `ad_storage`, `ad_user_data`,
`ad_personalization`, `analytics_storage`를 `denied`로 설정하고 광고 데이터
redaction을 사용합니다. EEA·영국·스위스 등에 맞는 실제 동의 수집은 AdSense
Privacy & messaging의 Google 인증 CMP를 별도로 활성화해야 합니다.

1. AdSense **사이트**에 `yoro.gg`를 추가합니다.
2. 계정 메타 태그 또는 `ads.txt` 방식으로 사이트 소유권을 확인합니다.
3. `https://yoro.gg/ads.txt`가 redirect 없이 HTTP 200, `text/plain; charset=utf-8`로 응답하는지 확인합니다.
4. AdSense에서 **확인 요청** 후 사이트 검토를 요청합니다.
5. 광고 송출 전 **개인정보 보호 및 메시지**에서 대상 지역에 필요한 Google 인증 CMP를 설정하고, 동의 거부와 철회 동작을 실제 브라우저에서 확인합니다.

현재 HTML은 공개 콘텐츠 경로에서 AdSense script를 로드하되 저장 동의는 기본
거부합니다. 저장소에는 Google 인증 CMP를 대신할 자체 구현을 넣지 않으며,
AdSense 콘솔에서 CMP가 게시되고 실제 동의 신호가 연결되기 전에는 맞춤 광고
송출 준비가 완료된 것으로 판단하지 않습니다.

AdSense Auto ads를 활성화할 때도 콘솔의 URL 제외 규칙에 `/login`, `/account`,
`/dashboard`, `/admin`을 등록합니다.

## 배포 후 확인

```bash
curl -fsS https://yoro.gg/ads.txt
curl -I https://yoro.gg/robots.txt
curl -I https://yoro.gg/sitemap.xml
curl -I https://yoro.gg/lol/aram
curl -I https://www.yoro.gg/
```

확인 기준:

- `ads.txt`, `robots.txt`, `sitemap.xml`은 인증 없이 접근 가능
- `ads.txt`는 HTML fallback이 아닌 plain text
- sitemap의 각 URL은 자기 자신을 canonical로 반환
- `/privacy`, `/terms`는 crawler가 접근할 수 있고 서버의 `X-Robots-Tag` 정책을 읽을 수 있음
- 존재하지 않는 `/palworld/*` 경로는 SPA HTML 200이 아닌 404
- `www` 및 HTTP 변형은 apex HTTPS로 영구 redirect
- 공개 페이지에서 `gtag/js?id=G-SEG94KMT1H`와 `g/collect` 요청이 발생
- 공개 페이지에서 `adsbygoogle.js?client=ca-pub-7880271953912430` 요청이 한 번만 발생
- 로그인·계정·Dashboard·관리자·Overlay 경로에서는 AdSense 요청이 발생하지 않음
- 요청의 page location에 검색 query, OAuth token 또는 setup token이 없음

`npm run ops:test-alert`는 외부 알림 검증용이며 Google 등록 검증을 대신하지 않습니다.
