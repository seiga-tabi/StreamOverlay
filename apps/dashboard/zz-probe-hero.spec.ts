/* 임시 프로브 — hero 상단 검증 후 삭제합니다. */
import { test } from "@playwright/test";
const TMP = "/Users/kokonenne/.claude/jobs/9eb36740/tmp";
const URLS = {
  ko: "http://localhost:3000/ko/lol/summoners/jp/%E3%81%9B%E3%81%84%E3%81%8C-SEI",
  ja: "http://localhost:3000/ja/lol/summoners/jp/%E3%81%9B%E3%81%84%E3%81%8C-SEI",
};

async function probe(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const r = (e: Element) => { const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
    const thumb = document.querySelector(".public-profile-hero-cast-thumb");
    const castCard = document.querySelector(".public-profile-hero-cast");
    return {
      크레스트: [...document.querySelectorAll(".public-hero-rank-card .public-profile-hero-crest")].map((c) => ({
        슬롯: r(c),
        bg: getComputedStyle(c).backgroundColor,
        테두리: getComputedStyle(c).borderTopWidth,
        안쪽: [...c.children].map((k) => [k.tagName, ...r(k)]),
      })),
      겹침: [...document.querySelectorAll(".public-hero-rank-card")].map((card) => {
        const crest = card.querySelector(".public-profile-hero-crest");
        const copy = card.querySelector(".public-hero-rank-card-copy");
        if (!crest || !copy) return null;
        const a = crest.getBoundingClientRect(), b = copy.getBoundingClientRect();
        return Math.round(a.right - b.left);
      }),
      그래프: [...document.querySelectorAll(".public-hero-rank-card-trend")].map((t) => {
        const svg = t.querySelector("svg");
        return { 담는폭: r(t)[0], 그래프폭: svg ? r(svg)[0] : null };
      }),
      링크아이콘: document.querySelectorAll(".public-profile-hero-cast-links a").length,
      미리보기: thumb && castCard ? { 썸네일: r(thumb), 카드폭: r(castCard)[0] } : null,
      카드높이: [...new Set([...document.querySelectorAll(".public-hero-rank-card:not(.public-hero-mastery-card)")]
        .map((c) => Math.round(c.getBoundingClientRect().height)))],
      숙련도: document.querySelectorAll(".public-hero-mastery-list > li").length,
      언랭크빈그래프: [...document.querySelectorAll(".public-hero-rank-card.is-unranked svg.public-profile-hero-sparkline")].length,
      고스트버튼: (() => {
        const ghost = document.querySelector(".public-hero-rank-card .public-profile-hero-ghost");
        const card = ghost?.closest(".public-hero-rank-card");
        if (!ghost || !card) return null;
        const g = ghost.getBoundingClientRect(), c = card.getBoundingClientRect();
        return { 카드안: g.right <= c.right + 1 && g.left >= c.left - 1, 폭: Math.round(g.width), 카드폭: Math.round(c.width) };
      })(),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

for (const [locale, url] of Object.entries(URLS)) {
  test(`hero probe ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector(".public-hero-rank-card");
    console.log(`HERO-${locale}:`, JSON.stringify(await probe(page), null, 1));
    if (locale === "ko") {
      await page.screenshot({ path: `${TMP}/hero-light.png`, clip: { x: 0, y: 0, width: 1440, height: 760 } });
      await page.evaluate(() => {
        document.documentElement.setAttribute("data-public-theme", "dark");
        document.querySelector(".public-profile-platform-v2")?.classList.remove("theme-light");
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${TMP}/hero-dark.png`, clip: { x: 0, y: 0, width: 1440, height: 760 } });
    }
  });
}

test("hero responsive", async ({ page }) => {
  await page.goto(URLS.ko, { waitUntil: "networkidle" });
  await page.waitForSelector(".public-hero-rank-card");
  for (const width of [360, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.waitForTimeout(250);
    const out = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      crest: [...new Set([...document.querySelectorAll(".public-hero-rank-card .public-profile-hero-crest")]
        .map((c) => Math.round(c.getBoundingClientRect().width)))],
    }));
    console.log(`W${width}:`, JSON.stringify(out));
    if (width === 390) await page.screenshot({ path: `${TMP}/hero-390.png`, clip: { x: 0, y: 0, width: 390, height: 900 } });
  }
});
