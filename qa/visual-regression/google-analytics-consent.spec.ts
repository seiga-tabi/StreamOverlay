import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://www.googletagmanager.com/gtag/js?*", (route) => route.fulfill({
    body: "/* Google tag은 동의 상태 테스트에서 네트워크 전송을 수행하지 않습니다. */",
    contentType: "application/javascript",
    status: 200
  }));
  await page.route("https://pagead2.googlesyndication.com/**", (route) => route.abort());
});

test("공개 페이지 동의 배너는 네 가지 Consent Mode 신호를 함께 갱신한다", async ({ page }) => {
  await page.goto("/ko/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "분석 및 광고 쿠키 설정" })).toBeVisible();
  await page.getByRole("button", { name: "모두 허용" }).click();

  await expect(page.getByRole("region", { name: "분석 및 광고 쿠키 설정" })).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("yoro.google.consent.v1")))
    .toBe("granted");

  const update = await page.evaluate(() => {
    const analyticsWindow = window as Window & { dataLayer?: unknown[] };
    return (analyticsWindow.dataLayer ?? [])
      .map((entry) => Array.from(entry as ArrayLike<unknown>))
      .find((entry) => entry[0] === "consent" && entry[1] === "update");
  });
  expect(update).toEqual([
    "consent",
    "update",
    {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted"
    }
  ]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "분석 및 광고 쿠키 설정" })).toHaveCount(0);
});

test("일본어 공개 URL은 일본어 동의 UI를 제공하고 비공개 경로에는 표시하지 않는다", async ({ page }) => {
  await page.goto("/ja/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "分析・広告Cookie設定" })).toBeVisible();
  await expect(page.getByRole("button", { name: "すべて許可" })).toBeVisible();
  await page.getByRole("button", { name: "すべて拒否" }).click();

  await page.evaluate(() => localStorage.removeItem("yoro.google.consent.v1"));
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".google-consent-banner")).toHaveCount(0);
});
