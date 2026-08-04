import { expect, test } from "@playwright/test";

test.describe("Google Analytics 실제 전송", () => {
  test.skip(
    process.env.YORO_GA_LIVE_TEST !== "1",
    "외부 Google 수집 endpoint를 호출하는 명시적 진단에서만 실행합니다."
  );

  test("동의 승인 뒤 page_view가 g/collect 204로 전송된다", async ({ page }) => {
    const collectResponses: Array<{ status: number; url: string }> = [];
    page.on("response", (response) => {
      const url = response.url();
      if (
        /^https:\/\/(?:[a-z0-9-]+\.)?google-analytics\.com\/g\/collect(?:\?|$)/u.test(url)
        || /^https:\/\/analytics\.google\.com\/g\/collect(?:\?|$)/u.test(url)
      ) {
        collectResponses.push({ status: response.status(), url });
      }
    });

    await page.goto("/ko/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "모두 허용" }).click();

    await expect.poll(() => collectResponses.length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(collectResponses.some((response) => response.status === 204)).toBe(true);
    expect(collectResponses.some((response) => response.url.includes("tid=G-SEG94KMT1H"))).toBe(true);
    expect(collectResponses.some((response) => response.url.includes("en=page_view"))).toBe(true);
    expect(collectResponses.some((response) => response.url.includes("_ss=1"))).toBe(true);
    expect(collectResponses.some((response) => response.url.includes("ep.debug_mode=true"))).toBe(true);

    const consentUpdate = await page.evaluate(() => {
      const analyticsWindow = window as Window & { dataLayer?: unknown[] };
      const entries = analyticsWindow.dataLayer ?? [];
      return entries
        .map((entry) => Array.from(entry as ArrayLike<unknown>))
        .find((entry) => entry[0] === "consent" && entry[1] === "update");
    });
    expect(consentUpdate).toEqual([
      "consent",
      "update",
      {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "granted"
      }
    ]);

    const firstPageViewCount = collectResponses.filter((response) => (
      response.url.includes("en=page_view")
    )).length;
    await page.evaluate(() => {
      window.history.pushState({}, "", "/ko/palworld");
      window.dispatchEvent(new Event("publicroutechange"));
    });
    await expect.poll(
      () => collectResponses.filter((response) => response.url.includes("en=page_view")).length,
      { timeout: 15_000 },
    ).toBeGreaterThan(firstPageViewCount);
    expect(collectResponses.some((response) => (
      response.url.includes("en=page_view")
      && decodeURIComponent(response.url).includes("/ko/palworld")
    ))).toBe(true);
  });
});
