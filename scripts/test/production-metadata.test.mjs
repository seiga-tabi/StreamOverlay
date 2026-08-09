import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("공개 SEO 메타데이터는 운영 도메인 yoro.gg를 사용한다", async () => {
  const [html, robots, ads] = await Promise.all([
    readFile(path.join(projectRoot, "apps/dashboard/index.html"), "utf8"),
    readFile(path.join(projectRoot, "apps/dashboard/public/robots.txt"), "utf8"),
    readFile(path.join(projectRoot, "apps/dashboard/public/ads.txt"), "utf8")
  ]);

  assert.match(html, /<link rel="canonical" href="https:\/\/yoro\.gg\/"/);
  assert.match(html, /<meta property="og:url" content="https:\/\/yoro\.gg\/"/);
  assert.match(html, /<meta name="google-adsense-account" content="ca-pub-7880271953912430"/);
  assert.match(robots, /Sitemap: https:\/\/yoro\.gg\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Disallow:\s*\/(?:privacy|terms)/);
  assert.equal(ads.trim(), "google.com, pub-7880271953912430, DIRECT, f08c47fec0942fa0");
  assert.doesNotMatch(`${html}\n${robots}\n${ads}`, /gg\.seigatabi\.com/);
});

test("robots.txt는 공개 페이지 렌더링에 필요한 build asset을 크롤러에 허용한다", async () => {
  const robots = await readFile(path.join(projectRoot, "apps/dashboard/public/robots.txt"), "utf8");
  const viteConfig = await readFile(path.join(projectRoot, "apps/dashboard/vite.config.ts"), "utf8");

  // build asset은 base path 아래에 놓입니다. 이 경로가 막히면 crawler가 CSR app을
  // 렌더링하지 못해 모든 공개 페이지가 빈 문서로 색인됩니다.
  assert.match(viteConfig, /base:.*"\/dashboard\/"/u);
  assert.match(robots, /^Allow: \/dashboard\/assets\/$/mu);
  assert.match(robots, /^Allow: \/dashboard\/images\/$/mu);
  assert.match(robots, /^Allow: \/dashboard\/config\.js$/mu);
  assert.match(robots, /^Disallow: \/dashboard$/mu);

  // robots 경로 매칭은 더 긴 규칙이 이깁니다. Allow가 Disallow보다 길어야 자산이 열립니다.
  const allowLength = "/dashboard/assets/".length;
  const disallowLength = "/dashboard".length;
  assert.ok(allowLength > disallowLength);
});

test("정적 sitemap.xml 파일은 남아 있지 않다", async () => {
  // sitemap은 서버가 route 목록과 Palworld data service로 생성합니다.
  // 정적 파일을 함께 두면 두 원본이 갈라집니다.
  await assert.rejects(
    () => readFile(path.join(projectRoot, "apps/dashboard/public/sitemap.xml"), "utf8"),
    /ENOENT/
  );
});

test("AdSense는 Consent Mode를 적용해 모든 공개 페이지에서 한 번만 로드된다", async () => {
  const html = await readFile(path.join(projectRoot, "apps/dashboard/index.html"), "utf8");

  assert.doesNotMatch(html, /<script[^>]+src="https:\/\/pagead2\.googlesyndication\.com/i);
  assert.match(html, /yoro\.ads\.consent/);
  assert.match(html, /yoro:ads-consent/);
  assert.match(html, /yoro\.google\.consent\.v1/);
  assert.match(html, /yoro:google-consent/);
  assert.match(html, /window\.gtag\("consent", "default"/);
  assert.match(html, /ad_storage: "denied"/);
  assert.match(html, /ad_user_data: "denied"/);
  assert.match(html, /ad_personalization: "denied"/);
  assert.match(html, /analytics_storage: "denied"/);
  assert.match(html, /window\.__yoroGoogleConsentInitialized = true/);
  assert.match(html, /window\.gtag\("set", "ads_data_redaction", true\)/);
  assert.match(html, /script\.async = true/);
  assert.match(html, /script\.crossOrigin = "anonymous"/);
  assert.match(html, /script\.id = adsenseScriptId/);
  assert.match(html, /adsbygoogle\.js\?client=ca-pub-7880271953912430/);
  assert.match(html, /"\/bot"/);
  assert.match(html, /"\/bot\/features"/);
  assert.match(html, /"\/bot\/connect"/);
  assert.match(html, /"\/bot\/dedicated-server"/);
  assert.match(html, /"\/palworld\/pals"/);
  assert.match(html, /"\/palworld\/breeding"/);
  assert.match(html, /"\/palworld\/items"/);
  assert.match(html, /"\/palworld\/technology"/);
  assert.match(html, /"\/palworld\/skills"/);
  assert.match(html, /"\/palworld\/map"/);
  assert.match(html, /"\/lol\/summoners\/"/);
  assert.match(html, /"\/patch-notes"/);
  /* 커뮤니티는 걷어냈습니다. 광고 대상 경로에도 남아 있으면 안 됩니다. */
  assert.doesNotMatch(html, /"\/community/);
  assert.match(html, /applyStoredGoogleConsent\(\);\s+window\.addEventListener/);
  assert.match(html, /localStorage\.getItem\(googleConsentKey\) !== "granted"/);
  assert.doesNotMatch(html, /applyStoredGoogleConsent\(\);\s+loadAdsense\(\)/);
  assert.match(html, /window\.gtag\("consent", "update", consentState\(choice\)\)/);
  assert.match(html, /window\.addEventListener\("publicroutechange", loadAdsense\)/);
  assert.match(html, /window\.addEventListener\("palworldroutechange", loadAdsense\)/);
  assert.doesNotMatch(html, /"\/(?:admin|dashboard|streamer)"/);
  assert.match(html, /document\.getElementById\(adsenseScriptId\)/);
  assert.doesNotMatch(html, /script\.dataset\.yoroAdsense/);
});
