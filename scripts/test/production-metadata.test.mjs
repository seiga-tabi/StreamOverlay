import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("공개 SEO 메타데이터는 운영 도메인 yoro.gg를 사용한다", async () => {
  const [html, robots, sitemap] = await Promise.all([
    readFile(path.join(projectRoot, "apps/dashboard/index.html"), "utf8"),
    readFile(path.join(projectRoot, "apps/dashboard/public/robots.txt"), "utf8"),
    readFile(path.join(projectRoot, "apps/dashboard/public/sitemap.xml"), "utf8")
  ]);

  assert.match(html, /<link rel="canonical" href="https:\/\/yoro\.gg\/"/);
  assert.match(html, /<meta property="og:url" content="https:\/\/yoro\.gg\/"/);
  assert.match(robots, /Sitemap: https:\/\/yoro\.gg\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/yoro\.gg\//);
  assert.doesNotMatch(`${html}\n${robots}\n${sitemap}`, /gg\.seigatabi\.com/);
});

test("AdSense는 명시적 광고 동의 전에는 직접 로드되지 않는다", async () => {
  const html = await readFile(path.join(projectRoot, "apps/dashboard/index.html"), "utf8");

  assert.doesNotMatch(html, /<script[^>]+src="https:\/\/pagead2\.googlesyndication\.com/i);
  assert.match(html, /yoro\.ads\.consent/);
  assert.match(html, /yoro:ads-consent/);
  assert.match(html, /event\.detail\?\.granted === true/);
});
