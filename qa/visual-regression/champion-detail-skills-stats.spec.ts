import { expect, test, type Page, type Route } from "@playwright/test";
import type { LolChampionDetailResponse, LolChampionSummary } from "@streamops/shared";

/* 챔피언 상세의 스킬 표시 —
   승인 스펙 `docs/mockups/lol-champion-detail-skills-stats.approved-spec.html`
   §02(배치안 A) · §10 계약입니다.

   기본 정보 패널과 패시브의 "쿨타임·소모값 없음" 메타 문구는 화면에서 제거됐습니다.
   아래 테스트는 패시브+QWER 5줄, 액티브 스킬 메타, 상세 API fail-soft 동작을
   검증합니다. baseStats 픽스처는 API 계약이 유지되므로 그대로 둡니다.

   스킬 패널은 글로벌 빌드 통계와 다른 원천이라 fail-soft 여야 합니다. 그래서
   "스킬이 뜬다"만 보지 않고 "상세 API 가 죽어도 빌드 통계는 그대로 산다"를 함께 봅니다.

   스킬 문장·수치는 Data Dragon 실제 응답값입니다
   (16.17.1 · ko_KR · 아리 championId 103). */

const CHAMPIONS: LolChampionSummary[] = [
  { championId: 103, championKey: "Ahri", nameKo: "아리", nameJa: "アーリ", nameEn: "Ahri" }
];

const AHRI_DETAIL: LolChampionDetailResponse = {
  championId: 103,
  championKey: "Ahri",
  dataDragonVersion: "16.17.1",
  passive: {
    nameKo: "정기 흡수",
    descriptionKo: "아리가 미니언 또는 몬스터를 9마리 처치하면 체력을 회복합니다.<br>아리가 적 챔피언 처치에 관여하면 더 많은 체력을 회복합니다.",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.17.1/img/passive/Ahri_SoulEater2.png"
  },
  spells: [
    {
      key: "Q",
      spellId: "AhriOrbofDeception",
      nameKo: "현혹의 구슬",
      descriptionKo: "아리가 구슬을 던지고 다시 받습니다. 던질 때는 마법 피해를 주며 돌아올 때는 고정 피해를 줍니다.",
      cooldown: [7, 7, 7, 7, 7],
      costBurn: "55/65/75/85/95",
      costTypeKo: "마나",
      range: [970, 970, 970, 970, 970],
      iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.17.1/img/spell/AhriQ.png"
    },
    {
      key: "W",
      spellId: "AhriFoxFire",
      nameKo: "여우불",
      descriptionKo: "아리의 이동 속도가 잠시 동안 크게 증가하며 아리가 여우불 세 개를 생성하면, 각각 자동으로 적을 찾아 공격합니다.",
      cooldown: [9, 8, 7, 6, 5],
      costBurn: "30",
      costTypeKo: "마나",
      range: [700, 700, 700, 700, 700],
      iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.17.1/img/spell/AhriW.png"
    },
    {
      key: "E",
      spellId: "AhriSeduce",
      nameKo: "매혹",
      descriptionKo: "아리가 입맞춤을 날려 피해를 주며 맞은 적을 홀립니다.",
      cooldown: [12, 12, 12, 12, 12],
      costBurn: "60",
      costTypeKo: "마나",
      range: [975, 975, 975, 975, 975],
      iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.17.1/img/spell/AhriE.png"
    },
    {
      key: "R",
      spellId: "AhriTumble",
      nameKo: "혼령 질주",
      descriptionKo: "아리가 전방으로 질주하며 근처 적 챔피언들에게 혼령의 정기를 쏘아냅니다.",
      cooldown: [130, 110, 90],
      costBurn: "100",
      costTypeKo: "마나",
      range: [450, 450, 450],
      iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.17.1/img/spell/AhriR.png"
    }
  ],
  baseStats: {
    hp: 590, hpperlevel: 104, hpregen: 2.5, hpregenperlevel: 0.6,
    mp: 418, mpperlevel: 25, mpregen: 8, mpregenperlevel: 0.8,
    attackdamage: 53, attackdamageperlevel: 0, attackspeed: 0.668, attackspeedperlevel: 2.2,
    armor: 21, armorperlevel: 4.2, spellblock: 30, spellblockperlevel: 1.3,
    movespeed: 330, attackrange: 550, crit: 0, critperlevel: 0
  }
};

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body)
  });
}

/** 빌드 통계는 이 화면의 다른 축입니다 — 상세가 죽어도 이쪽이 살아 있는지 봅니다. */
const BUILD_STATS = {
  championId: 103,
  teamPosition: "MIDDLE",
  queueId: 420,
  patch: "16.17",
  dataDragonVersion: "16.17.1",
  totalGames: 12,
  positions: [{ teamPosition: "MIDDLE", games: 12, winRate: 55 }],
  updatedAt: "2026-09-01T00:00:00.000Z",
  sampleInsufficient: true
};

type Fixtures = {
  /** 숫자면 그 상태 코드로 실패시킵니다(계약 없는 배포·장애 재현). */
  detail?: LolChampionDetailResponse | number;
};

async function installChampionDetailFixtures(page: Page, fixtures: Fixtures = {}): Promise<void> {
  const detail = fixtures.detail ?? AHRI_DETAIL;
  await page.addInitScript(() => {
    window.localStorage.setItem("yoro.google.consent.v1", "denied");
    window.localStorage.setItem("loltrace.locale", "ko");
  });
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/lol/champions") {
      await json(route, { dataDragonVersion: "16.17.1", champions: CHAMPIONS });
      return;
    }
    if (pathname === "/api/lol/champion-detail") {
      if (typeof detail === "number") {
        await route.fulfill({ status: detail, contentType: "application/json", body: "{}" });
        return;
      }
      await json(route, detail);
      return;
    }
    if (pathname === "/api/lol/champion-build-stats") {
      await json(route, BUILD_STATS);
      return;
    }
    if (pathname === "/api/public/locale") {
      await json(route, { locale: "ko" });
      return;
    }
    await json(route, {});
  });
  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.__STREAMOPS_CONFIG__ = {};"
    });
  });
  await page.route(/^https:\/\/(?!127\.0\.0\.1)/, async (route) => {
    if (route.request().resourceType() === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: transparentPng });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
}

test("스킬 5줄이 머리와 빌드 통계 사이에 들어간다", async ({ page }) => {
  await installChampionDetailFixtures(page, { detail: AHRI_DETAIL });
  await page.goto("/lol/champions/103");

  const rows = page.locator(".public-cskill-row");
  await expect(rows).toHaveCount(5);
  await expect(page.locator(".public-cskill-key")).toHaveText(["P", "Q", "W", "E", "R"]);
  await expect(page.locator(".public-cskill-name").nth(0)).toHaveText("정기 흡수");
  await expect(page.locator(".public-cskill-name").nth(4)).toHaveText("혼령 질주");

  /* 슬래시 접기 — 전 레벨이 같으면 한 값, 다르면 슬래시입니다(스펙 §02). */
  const qMeta = await rows.nth(1).locator(".public-cskill-meta dd").allInnerTexts();
  expect(qMeta).toEqual(["7초", "마나 55/65/75/85/95", "970"]);
  const wMeta = await rows.nth(2).locator(".public-cskill-meta dd").allInnerTexts();
  expect(wMeta).toEqual(["9/8/7/6/5초", "마나 30", "700"]);
  /* 메타 항목이 없는 패시브에는 빈 정의 목록을 렌더하지 않습니다. */
  await expect(rows.nth(0).locator(".public-cskill-meta")).toHaveCount(0);

  /* 설명은 원문의 <br> 를 줄바꿈으로만 살립니다 — 태그가 글자로 새지 않아야 합니다. */
  const passiveText = await rows.nth(0).locator(".public-cskill-desc").innerText();
  expect(passiveText).toContain("아리가 미니언 또는 몬스터를 9마리 처치하면 체력을 회복합니다.");
  expect(passiveText).not.toContain("<br>");

  /* 순서 — 스킬 → 글로벌 빌드 통계. */
  const headings = await page.locator(".public-champion-build-page h2").allInnerTexts();
  expect(headings).toEqual(["스킬", "챔피언 글로벌 빌드"]);
});

test("변경이 없으면 배지·태그·알림 줄이 전부 사라진다(기본 상태)", async ({ page }) => {
  await installChampionDetailFixtures(page, { detail: AHRI_DETAIL });
  await page.goto("/lol/champions/103");
  await expect(page.locator(".public-cskill-row")).toHaveCount(5);

  await expect(page.locator(".public-champion-card-badge")).toHaveCount(0);
  await expect(page.locator(".public-cskill-tag")).toHaveCount(0);
  await expect(page.locator(".public-cpatch-note")).toHaveCount(0);
});

test("상세 API 가 죽어도 스킬 패널만 빠지고 빌드 통계 화면은 그대로 산다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installChampionDetailFixtures(page, { detail: 503 });
  await page.goto("/lol/champions/103");

  await expect(page.locator("#public-global-build-stats")).toBeVisible();
  await expect(page.getByRole("heading", { name: "아리" })).toBeVisible();
  await expect(page.locator(".public-cskill-row")).toHaveCount(0);
  /* 부가 정보의 실패를 화면에 올리지 않습니다 — 오류 배너가 뜨면 안 됩니다. */
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});
