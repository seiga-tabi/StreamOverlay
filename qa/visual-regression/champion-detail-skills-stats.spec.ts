import { expect, test, type Page, type Route } from "@playwright/test";
import type { LolChampionDetailResponse, LolChampionSummary } from "@streamops/shared";

/* 챔피언 상세의 스킬·기본 스탯 표시 —
   승인 스펙 `docs/mockups/lol-champion-detail-skills-stats.approved-spec.html`
   §02(배치안 A) · §09 · §10 계약입니다.

   이번 패치 변경 배지/before→after 표기(§05·§06)는 챔피언 패치 변경 자동감지
   기능 3개 제거(2026-09-04)와 함께 삭제되었습니다 — 아래 픽스처와 테스트는
   그 부분만 정리하고 스킬·기본 스탯 표시 자체(패시브+QWER, 20종 스탯, fail-soft,
   모바일 반응형)는 그대로 유지합니다.

   이 두 패널은 글로벌 빌드 통계와 다른 원천이라 fail-soft 여야 합니다. 그래서
   "스킬이 뜬다"만 보지 않고 "상세 API 가 죽어도 빌드 통계는 그대로 산다"를 함께 봅니다.

   스킬 문장·수치와 기본 스탯 20종은 Data Dragon 실제 응답값입니다
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

test("스킬 5줄과 기본 스탯 20칸이 머리와 빌드 통계 사이에 들어간다", async ({ page }) => {
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
  /* 패시브는 쿨타임·소모값이 아예 없다는 사실을 문장으로 말합니다(빈 칸 금지 · §10). */
  await expect(rows.nth(0).locator(".public-cskill-meta-none")).toHaveText("지속 효과 — 쿨타임·소모값 없음");

  /* 설명은 원문의 <br> 를 줄바꿈으로만 살립니다 — 태그가 글자로 새지 않아야 합니다. */
  const passiveText = await rows.nth(0).locator(".public-cskill-desc").innerText();
  expect(passiveText).toContain("아리가 미니언 또는 몬스터를 9마리 처치하면 체력을 회복합니다.");
  expect(passiveText).not.toContain("<br>");

  /* 기본 스탯 20칸 — 0 인 칸도 숨기지 않습니다(빈 칸은 "로딩 중"으로 읽힙니다). */
  await expect(page.locator(".public-cstat")).toHaveCount(20);
  const firstCard = page.locator(".public-cstat").first();
  await expect(firstCard.locator(".public-cstat-label")).toHaveText("체력");
  await expect(firstCard.locator(".public-cstat-value")).toHaveText("590");
  /* critperlevel 라벨이 없으면 영문 키가 그대로 노출됩니다(STAT_LABELS 20번째 키). */
  await expect(page.locator(".public-cstat-label").last()).toHaveText("레벨당 치명타");
  await expect(page.locator('.public-cstat-label[data-fallback="true"]')).toHaveCount(0);

  /* 순서 — 스킬 → 기본 정보 → 글로벌 빌드 통계(스펙 §01). */
  const headings = await page.locator(".public-champion-build-page h2").allInnerTexts();
  expect(headings).toEqual(["스킬", "기본 정보", "챔피언 글로벌 빌드"]);
});

test("변경이 없으면 배지·태그·알림 줄이 전부 사라진다(기본 상태)", async ({ page }) => {
  await installChampionDetailFixtures(page, { detail: AHRI_DETAIL });
  await page.goto("/lol/champions/103");
  await expect(page.locator(".public-cskill-row")).toHaveCount(5);

  await expect(page.locator(".public-champion-card-badge")).toHaveCount(0);
  await expect(page.locator(".public-cskill-tag")).toHaveCount(0);
  await expect(page.locator(".public-cstat-delta")).toHaveCount(0);
  await expect(page.locator(".public-cpatch-note")).toHaveCount(0);
  /* "변경 없음" 이라는 빈 상태 문구도 넣지 않습니다 — 이것이 예외가 아니라 기본형입니다. */
  await expect(page.locator(".public-cstat[data-direction]")).toHaveCount(0);
});

test("상세 API 가 죽어도 두 패널만 빠지고 빌드 통계 화면은 그대로 산다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installChampionDetailFixtures(page, { detail: 503 });
  await page.goto("/lol/champions/103");

  await expect(page.locator("#public-global-build-stats")).toBeVisible();
  await expect(page.getByRole("heading", { name: "아리" })).toBeVisible();
  await expect(page.locator(".public-cskill-row")).toHaveCount(0);
  await expect(page.locator(".public-cstat")).toHaveCount(0);
  /* 부가 정보의 실패를 화면에 올리지 않습니다 — 오류 배너가 뜨면 안 됩니다. */
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("모바일 390px 에서 스탯 격자는 2열을 유지하고 가로 오버플로가 없다", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "모바일 뷰포트 전용");
  await installChampionDetailFixtures(page);
  await page.goto("/lol/champions/103");
  await expect(page.locator(".public-cstat")).toHaveCount(20);

  const columns = await page.locator(".public-cstat-grid").evaluate((node) => (
    window.getComputedStyle(node).gridTemplateColumns.split(" ").length
  ));
  expect(columns).toBe(2);

  /* 스킬 행은 minmax(0, 1fr) 이라 긴 문장에서도 가로로 넘치지 않아야 합니다(§09). */
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  /* 최악 케이스는 Q 의 「마나 55/65/75/85/95」입니다 — 이 항목 때문에 「사거리 970」이
     다음 줄로 접힙니다. 접힌 줄의 첫 항목 왼쪽에 구분선이 홀로 남으면 안 됩니다(§09). */
  const qMeta = await page.locator(".public-cskill-row").nth(1).locator(".public-cskill-meta > div").evaluateAll((items) => items.map((item) => ({
    top: (item as HTMLElement).offsetTop,
    left: (item as HTMLElement).offsetLeft,
    borderLeft: window.getComputedStyle(item).borderLeftWidth
  })));
  expect(qMeta).toHaveLength(3);
  expect(qMeta[2]?.top).toBeGreaterThan(qMeta[0]?.top ?? 0);
  expect(qMeta[2]?.left).toBe(qMeta[0]?.left);
  expect(qMeta.map((item) => item.borderLeft)).toEqual(["0px", "0px", "0px"]);
});
