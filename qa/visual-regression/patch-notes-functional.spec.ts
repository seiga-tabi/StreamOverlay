import { expect, test, type Page, type Route } from "@playwright/test";
import type { PatchNote, PatchNotesFeed, PatchPlaySummary } from "@streamops/shared";

/* 실제 Riot 목록에서 받은 값의 모양을 그대로 씁니다(2026-08-09 실측). */
const NOTES: PatchNote[] = [
  {
    slug: "league-of-legends-patch-26-15-notes",
    title: "리그 오브 레전드 26.15 패치 노트",
    summary: "시즌 3가 시작됩니다. 그런데... 몇 년도죠?!",
    publishedAt: "2026-07-28T18:00:00.000Z",
    patchVersion: "26.15",
    dataDragonVersion: "16.15.1",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-15-notes",
    imageUrl: "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/a-1920x1080.jpg",
    accentColor: "#341a1c"
  },
  {
    slug: "league-of-legends-patch-26-14-notes",
    title: "리그 오브 레전드 26.14 패치 노트",
    summary: "월드 챔피언십 3연속 우승팀에게 영광을!",
    publishedAt: "2026-07-14T18:00:00.000Z",
    patchVersion: "26.14",
    dataDragonVersion: "16.14.1",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-14-notes",
    imageUrl: "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/b-1920x1080.jpg",
    accentColor: "#b87b6b"
  },
  {
    /* 긴 제목이 카드를 밀어내지 않는지 보려고 일부러 길게 둡니다. */
    slug: "league-of-legends-patch-26-13-notes",
    title: "리그 오브 레전드 26.13 패치 노트 — 챔피언 밸런스와 아이템 조정 그리고 랭크 시스템 개편 안내",
    summary: "악마는 절대 사절이야. - 로크",
    publishedAt: "2026-06-23T18:00:00.000Z",
    patchVersion: "26.13",
    dataDragonVersion: "16.13.1",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-13-notes"
  },
  /* 히어로 1 + 타일 5 + 아카이브 2 가 되도록 채웁니다. 마지막 둘은 시즌 25 입니다. */
  ...[
    ["26.12", "2026-06-09", "16.12.1"],
    ["26.11", "2026-05-27", "16.11.1"],
    ["26.10", "2026-05-12", "16.10.1"],
    ["25.24", "2025-12-10", "15.24.1"],
    ["25.23", "2025-11-26", "15.23.1"]
  ].map(([version, day, ddragon]) => ({
    slug: `league-of-legends-patch-${version!.replace(".", "-")}-notes`,
    title: `리그 오브 레전드 ${version} 패치 노트`,
    summary: `${version} 요약 문장입니다.`,
    publishedAt: `${day}T18:00:00.000Z`,
    patchVersion: version!,
    dataDragonVersion: ddragon!,
    url: `https://www.leagueoflegends.com/ko-kr/news/game-updates/patch-${version!.replace(".", "-")}-notes`,
    imageUrl: "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/c-1920x1080.jpg",
    accentColor: "#16162d"
  }))
];

const JA_NOTES: PatchNote[] = [{
  slug: "league-of-legends-patch-26-15-notes",
  title: "リーグ・オブ・レジェンド パッチノート 26.15",
  summary: "シーズン3が始まります… いつの年のでしょうね！？",
  publishedAt: "2026-07-28T18:00:00.000Z",
  patchVersion: "26.15",
  dataDragonVersion: "16.15.1",
  url: "https://www.leagueoflegends.com/ja-jp/news/game-updates/league-of-legends-patch-26-15-notes",
  imageUrl: "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/a-1920x1080.jpg"
}];

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function feed(overrides: Partial<PatchNotesFeed> = {}): PatchNotesFeed {
  return {
    schemaVersion: 1,
    locale: "ko",
    fetchedAt: "2026-07-15T00:00:00.000Z",
    stale: false,
    notes: NOTES,
    ...overrides
  };
}

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body)
  });
}

const SUMMARY: PatchPlaySummary = {
  schemaVersion: 1,
  gameName: "YORO",
  tagLine: "KR1",
  lolPlatform: "kr",
  sampledMatches: 12,
  fetchedAt: "2026-07-15T00:00:00.000Z",
  patches: [
    { patchKey: "16.15", games: 8, wins: 5, winRate: 62.5 },
    { patchKey: "16.14", games: 4, wins: 1, winRate: 25 }
  ]
};

/* 화면이 어떤 언어를 요청했는지 기록합니다. Riot 은 ko-kr·ja-jp 를 따로 서비스합니다. */
const requestedLocales: string[] = [];

type Fixtures = {
  patchNotes: PatchNotesFeed | number;
  /** 최근 검색에 남아 있는 소환사. 이 화면은 저장소를 읽기만 합니다. */
  stored?: Array<{ gameName: string; tagLine: string; lolPlatform: string; profileIconUrl?: string }>;
  summary?: PatchPlaySummary | number;
};

async function installFixtures(page: Page, fixtures: Fixtures | PatchNotesFeed | number): Promise<void> {
  const options: Fixtures = typeof fixtures === "number" || (fixtures as PatchNotesFeed).schemaVersion === 1
    ? { patchNotes: fixtures as PatchNotesFeed | number }
    : fixtures as Fixtures;
  const patchNotes = options.patchNotes;
  const stored = options.stored ?? [];
  requestedLocales.length = 0;
  await page.addInitScript((recent) => {
    window.localStorage.setItem("yoro.google.consent.v1", "denied");
    window.localStorage.setItem("loltrace.recent.jp", JSON.stringify(recent));
    const fixedNow = new Date("2026-07-15T03:00:00.000Z").valueOf();
    Date.now = () => fixedNow;
  }, stored);
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/public/patch-notes") {
      requestedLocales.push(new URL(route.request().url()).searchParams.get("locale") ?? "(none)");
      if (typeof patchNotes === "number") {
        await route.fulfill({
          status: patchNotes,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ error: "PATCH_NOTES_UNAVAILABLE" })
        });
        return;
      }
      await json(route, patchNotes);
      return;
    }
    if (pathname === "/api/public/patch-notes/summary") {
      const summary = options.summary;
      if (summary === undefined || typeof summary === "number") {
        await route.fulfill({
          status: typeof summary === "number" ? summary : 503,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ error: "unavailable" })
        });
        return;
      }
      await json(route, summary);
      return;
    }
    if (pathname === "/api/public/locale") {
      await json(route, { locale: patchNotes !== null && typeof patchNotes === "object" ? patchNotes.locale : "ko" });
      return;
    }
    await json(route, {});
  });
  /* dev 서버에는 없는 파일입니다. 없는 채로 두면 404 가 console 오류로 잡힙니다. */
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

function runtimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}
test("히어로·타일·아카이브로 나뉘고 모든 링크는 Riot 원문으로만 간다", async ({ page }) => {
  const errors = runtimeErrors(page);
  await installFixtures(page, feed());
  await page.goto("/patch-notes");

  /* 최신 1장은 화면, 다음 5장은 키아트 타일, 나머지는 아카이브 줄입니다. */
  await expect(page.locator(".yoro-pn-hero")).toHaveCount(1);
  await expect(page.locator(".yoro-pn-tile")).toHaveCount(5);
  await expect(page.locator(".yoro-pn-row")).toHaveCount(NOTES.length - 6);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("패치 노트");

  /* 패치 번호가 목록의 기준선입니다. 히어로에서 가장 큽니다. */
  await expect(page.locator(".yoro-pn-hero-num")).toContainText("26.15");
  const sizes = await page.evaluate(() => ({
    hero: parseFloat(getComputedStyle(document.querySelector(".yoro-pn-hero-num")!).fontSize),
    tile: parseFloat(getComputedStyle(document.querySelector(".yoro-pn-tile-num")!).fontSize),
    row: parseFloat(getComputedStyle(document.querySelector(".yoro-pn-row-num")!).fontSize),
    title: parseFloat(getComputedStyle(document.querySelector(".yoro-pn-hero-title")!).fontSize)
  }));
  expect(sizes.hero).toBeGreaterThan(sizes.tile);
  expect(sizes.tile).toBeGreaterThan(sizes.row);
  expect(sizes.hero).toBeGreaterThan(sizes.title);

  const links = await page.locator(".yoro-pn-link").evaluateAll((elements) => elements.map((element) => {
    const anchor = element as HTMLAnchorElement;
    return { href: anchor.href, target: anchor.target, rel: anchor.rel };
  }));
  expect(links).toHaveLength(NOTES.length);
  for (const link of links) {
    expect(link.href.startsWith("https://www.leagueoflegends.com/")).toBe(true);
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
  }

  /* 출처 고지는 목록 아래에 항상 있어야 합니다. */
  await expect(page.locator(".yoro-pn-attribution")).toContainText("Riot Games");

  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll<HTMLElement>(".yoro-pn-page *")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1
        && element.clientWidth > 0
        && !element.className.toString().includes("sr-only"))
      .map((element) => `${element.tagName}.${element.className}`.slice(0, 70))
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.overflowing).toEqual([]);
  expect(errors).toEqual([]);
});

test("Riot 이 준 패치 색이 그대로 CSS 로 전달된다", async ({ page }) => {
  await installFixtures(page, feed());
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero")).toBeVisible();

  /* 우리가 만든 색이 아니라 imageMedia.colors.primary 입니다. */
  const accents = await page.evaluate(() => ({
    hero: (document.querySelector(".yoro-pn-hero") as HTMLElement).style.getPropertyValue("--pn-k"),
    tile: (document.querySelector(".yoro-pn-tile") as HTMLElement).style.getPropertyValue("--pn-k")
  }));
  expect(accents.hero).toBe("#341a1c");
  expect(accents.tile).toBe("#b87b6b");
});

test("카드마다 링크 하나이고 손가락 목표가 충분하다", async ({ page }) => {
  await installFixtures(page, feed());
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero")).toBeVisible();

  const cards = await page.locator(".yoro-pn-hero, .yoro-pn-tile, .yoro-pn-row").evaluateAll((all) => all.map((card) => {
    const link = card.querySelector<HTMLAnchorElement>(".yoro-pn-link");
    return {
      height: card.getBoundingClientRect().height,
      links: card.querySelectorAll("a").length,
      overlayCovers: link ? window.getComputedStyle(link, "::after").position === "absolute" : false
    };
  }));
  expect(cards.length).toBe(NOTES.length);
  for (const card of cards) {
    expect(card.height).toBeGreaterThanOrEqual(44);
    /* 카드마다 tab 정지점이 하나여야 목록을 훑기 쉽습니다. */
    expect(card.links).toBe(1);
    expect(card.overlayCovers).toBe(true);
  }
});

test("글자는 렌더된 픽셀 기준으로 4.5:1 이상이다", async ({ page }) => {
  /* 소환사 칩까지 그려진 상태에서 재야 컨트롤 바 전체를 확인할 수 있습니다. */
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [{ gameName: "YORO", tagLine: "KR1", lolPlatform: "kr", profileIconUrl: "https://ddragon.leagueoflegends.com/i.png" }],
    summary: SUMMARY
  });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-row").first()).toBeVisible();

  const contrast = await page.evaluate(() => {
    function channel(value: number): number {
      const ratio = value / 255;
      return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
    }
    function luminance(rgb: number[]): number {
      return 0.2126 * channel(rgb[0] ?? 0) + 0.7152 * channel(rgb[1] ?? 0) + 0.0722 * channel(rgb[2] ?? 0);
    }
    function parse(value: string): number[] {
      const parts = value.match(/[\d.]+/gu)?.map(Number) ?? [0, 0, 0];
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
    }
    /* 배경은 계산값이 아니라 실제로 뒤에 깔린 색을 따라 올라가며 찾습니다. */
    function backdrop(element: Element): number[] {
      let current: Element | null = element;
      const stack: number[][] = [];
      while (current) {
        const style = window.getComputedStyle(current);
        const [r = 0, g = 0, b = 0] = parse(style.backgroundColor);
        const alpha = Number((style.backgroundColor.match(/[\d.]+/gu) ?? [])[3] ?? 1);
        if (alpha > 0) stack.push([r, g, b, alpha]);
        if (alpha >= 1) break;
        current = current.parentElement;
      }
      let result = [255, 255, 255];
      for (const layer of stack.reverse()) {
        const alpha = layer[3] ?? 1;
        result = [0, 1, 2].map((index) => (layer[index] ?? 0) * alpha + (result[index] ?? 0) * (1 - alpha));
      }
      return result;
    }
    function ratio(element: Element): number {
      const style = window.getComputedStyle(element);
      const front = parse(style.color);
      const back = backdrop(element);
      const light = Math.max(luminance(front), luminance(back));
      const dark = Math.min(luminance(front), luminance(back));
      return (light + 0.05) / (dark + 0.05);
    }
    return [".yoro-pn-row-num", ".yoro-pn-row-title", ".yoro-pn-row-source", ".yoro-pn-row-when time",
      ".yoro-pn-archive-title", ".yoro-pn-season b", ".yoro-pn-attribution",
      ".yoro-pn-bar-count", ".yoro-pn-chip", ".yoro-pn-who b", ".yoro-pn-who small"]
      .map((selector) => {
        const element = document.querySelector(selector);
        return { selector, ratio: element ? Number(ratio(element).toFixed(2)) : 0 };
      });
  });

  for (const entry of contrast) {
    expect(entry.ratio, `${entry.selector} 대비 ${entry.ratio}:1`).toBeGreaterThanOrEqual(4.5);
  }
});

test("검색하면 히어로와 타일을 접고 결과만 한 줄로 보여 준다", async ({ page }) => {
  await installFixtures(page, feed());
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero")).toHaveCount(1);

  const search = page.locator(".yoro-pn-bar-search input");
  await search.fill("26.14");
  await expect(page.locator(".yoro-pn-hero")).toHaveCount(0);
  await expect(page.locator(".yoro-pn-tile")).toHaveCount(0);
  await expect(page.locator(".yoro-pn-row")).toHaveCount(1);
  await expect(page.locator(".yoro-pn-row-num")).toContainText("26.14");
  /* 검색 중에는 시즌 머리글도 접습니다. */
  await expect(page.locator(".yoro-pn-season")).toHaveCount(0);

  await search.fill("없는패치");
  await expect(page.locator(".yoro-pn-row")).toHaveCount(0);
  await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();
});

test("시즌이 바뀌는 자리에만 머리글이 붙는다", async ({ page }) => {
  await installFixtures(page, feed());
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-row").first()).toBeVisible();

  /* 아카이브에 남는 건 25.24 · 25.23 이라 시즌 25 머리글 하나뿐입니다. */
  const seasons = await page.locator(".yoro-pn-season b").allTextContents();
  expect(seasons).toEqual(["시즌 25"]);
  await expect(page.locator(".yoro-pn-season small")).toContainText("2개 패치");
});

test("저장본을 보여 줄 때는 빈 화면 대신 이유를 말한다", async ({ page }) => {
  await installFixtures(page, feed({ stale: true }));
  await page.goto("/patch-notes");

  await expect(page.locator(".yoro-pn-stale")).toBeVisible();
  await expect(page.locator(".yoro-pn-stale")).toContainText("마지막으로 저장한 내용");
  await expect(page.locator(".yoro-pn-hero")).toHaveCount(1);
});

test("가져오지 못하면 다시 시도할 수 있는 오류 화면을 낸다", async ({ page }) => {
  await installFixtures(page, 503);
  await page.goto("/patch-notes");

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  await expect(page.locator(".yoro-pn-hero")).toHaveCount(0);
});

test("일본어에서는 Riot 의 ja 원문이 그대로 나온다", async ({ page }) => {
  await installFixtures(page, feed({ locale: "ja", notes: JA_NOTES }));
  await page.goto("/ja/patch-notes");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("パッチノート");
  await expect(page.locator(".yoro-pn-hero-title")).toContainText("リーグ・オブ・レジェンド パッチノート 26.15");
  const href = await page.locator(".yoro-pn-link").first().getAttribute("href");
  expect(href).toContain("/ja-jp/");
});

test("기록이 있는 패치에만 승률 게이지가 붙고 기준선이 함께 그려진다", async ({ page }) => {
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [{ gameName: "YORO", tagLine: "KR1", lolPlatform: "kr", profileIconUrl: "https://ddragon.leagueoflegends.com/i.png" }],
    summary: SUMMARY
  });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero")).toBeVisible();

  /* 게이지는 히어로와 아카이브 줄에만 답니다. 타일은 배지로 붙습니다. */
  await expect(page.locator(".yoro-pn-gauge")).toHaveCount(1);
  const hero = page.locator(".yoro-pn-hero .yoro-pn-gauge");
  await expect(hero).toContainText("62.5%");
  /* v2 — 승만이 아니라 패도 함께 말합니다(승/패 2색 막대와 같은 정보). */
  await expect(hero).toContainText("5승 3패 · 8판");
  await expect(hero.locator(".yoro-pn-gauge-win")).toHaveCount(1);
  await expect(hero.locator(".yoro-pn-gauge-loss")).toHaveCount(1);
  /* 직전 패치(25%) 대비 +37.5%p. 색만이 아니라 부호와 숫자로 말합니다. */
  await expect(page.locator(".yoro-pn-delta")).toContainText("+37.5%p");
  /* 26.14 는 타일이므로 배지로 붙습니다. */
  await expect(page.locator(".yoro-pn-tile-rate")).toHaveText("25.0%");

  const gauge = await page.locator(".yoro-pn-hero .yoro-pn-gauge").evaluate((element) => ({
    /* v2 — 승 구간과 패 구간을 모두 칠하므로 비율은 flex-grow 로 표현됩니다. */
    win: (element.querySelector(".yoro-pn-gauge-win") as HTMLElement).style.flexGrow,
    loss: (element.querySelector(".yoro-pn-gauge-loss") as HTMLElement).style.flexGrow,
    mid: window.getComputedStyle(element.querySelector(".yoro-pn-gauge-mid")!).position,
    label: element.querySelector(".yoro-pn-gauge-track")?.getAttribute("aria-label")
  }));
  expect(gauge.win).toBe("5");
  expect(gauge.loss).toBe("3");
  expect(gauge.mid).toBe("absolute");
  expect(gauge.label).toContain("기준 50");

  await expect(page.locator(".yoro-pn-who")).toContainText("최근 12경기");
  await expect(page.locator(".yoro-pn-who")).toContainText("YORO#KR1");
});

test("플레이한 패치는 아카이브 축 위의 점이 채워진다", async ({ page }) => {
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [{ gameName: "YORO", tagLine: "KR1", lolPlatform: "kr", profileIconUrl: "https://ddragon.leagueoflegends.com/i.png" }],
    /* 아카이브에 남는 25.23 에만 기록을 둡니다. */
    summary: { ...SUMMARY, sampledMatches: 4, patches: [{ patchKey: "15.23", games: 4, wins: 3, winRate: 75 }] }
  });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-row").first()).toBeVisible();

  await expect(page.locator(".yoro-pn-row.is-played")).toHaveCount(1);
  await expect(page.locator(".yoro-pn-row.is-played .yoro-pn-row-num")).toHaveText("25.23");
  /* 화면에 보이지 않는 사람에게도 뜻이 전해져야 합니다. */
  await expect(page.locator(".yoro-pn-row.is-played")).toContainText("내가 플레이한 패치");
  const played = await page.locator(".yoro-pn-row.is-played .yoro-pn-node").evaluate((node) => {
    const style = window.getComputedStyle(node);
    return { background: style.backgroundColor, width: style.width };
  });
  expect(played.background).not.toBe("rgba(0, 0, 0, 0)");
});

test("기록이 없는 패치에는 아무 숫자도 만들지 않는다", async ({ page }) => {
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [{ gameName: "YORO", tagLine: "KR1", lolPlatform: "kr", profileIconUrl: "https://ddragon.leagueoflegends.com/i.png" }],
    summary: { ...SUMMARY, sampledMatches: 0, patches: [] }
  });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero")).toBeVisible();
  await expect(page.locator(".yoro-pn-gauge")).toHaveCount(0);
  await expect(page.locator(".yoro-pn-tile-rate")).toHaveCount(0);
  await expect(page.locator(".yoro-pn-row.is-played")).toHaveCount(0);
  /* 기록이 없으면 표본 문구를 붙이지 않습니다. */
  await expect(page.locator(".yoro-pn-who")).not.toContainText("최근");
});

test("검색 이력이 없으면 내 승률 모듈이 초대 카드로 안내한다", async ({ page }) => {
  /* 리디자인(2026-08-16): 이동 CTA 대신 모듈 안 직접 입력 — 목업 §②. */
  await installFixtures(page, { patchNotes: feed(), stored: [] });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero")).toBeVisible();

  const module = page.getByTestId("patch-notes-mine-module");
  await expect(module).toContainText("전적을 검색하면");
  await expect(module).toContainText("계정 연동이 아닙니다");
  await expect(module.getByLabel("Riot ID")).toBeVisible();
  /* 형식 오류는 인라인으로 안내합니다. */
  await module.getByLabel("Riot ID").fill("형식오류");
  await module.getByRole("button", { name: "보기" }).click();
  await expect(module.getByRole("alert")).toContainText("닉네임#태그 형식");
  /* 미표시 상태에서는 행에 개인 컬럼(게이지·빈 값)이 전혀 없습니다. */
  await expect(page.locator(".yoro-pn-gauge")).toHaveCount(0);
  await expect(page.locator(".yoro-pn-row-norate")).toHaveCount(0);
});

test("내 전적만 실패해도 패치 목록은 그대로 보인다", async ({ page }) => {
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [{ gameName: "YORO", tagLine: "KR1", lolPlatform: "kr", profileIconUrl: "https://ddragon.leagueoflegends.com/i.png" }],
    summary: 503
  });
  await page.goto("/patch-notes");

  await expect(page.locator(".yoro-pn-hero")).toHaveCount(1);
  await expect(page.locator(".yoro-pn-tile")).toHaveCount(5);
  await expect(page.locator(".yoro-pn-gauge")).toHaveCount(0);
  const alert = page.locator(".yoro-pn-bar-state[role=alert]");
  await expect(alert).toContainText("내 전적을 불러올 수 없습니다.");
  await expect(alert.getByRole("button", { name: "다시 시도" })).toBeVisible();
});

test("소환사가 여럿이면 골라서 볼 수 있다", async ({ page }) => {
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [
      { gameName: "YORO", tagLine: "KR1", lolPlatform: "kr" },
      { gameName: "세이가", tagLine: "JP1", lolPlatform: "jp1" }
    ],
    summary: SUMMARY
  });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-gauge").first()).toBeVisible();

  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/public/patch-notes/summary")) requests.push(request.url());
  });
  await page.locator(".yoro-pn-who").click();
  await expect(page.locator(".yoro-pn-who-menu")).toBeVisible();
  await page.getByRole("menuitemradio", { name: /세이가#JP1/ }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(decodeURIComponent(requests[0] ?? "")).toContain("riotId=세이가#JP1");
  expect(requests[0]).toContain("platform=jp1");
});

test("언어를 바꾸면 패치 목록을 그 언어로 다시 받아온다", async ({ page }) => {
  /* Riot 은 ko-kr 과 ja-jp 를 서로 다른 문서로 서비스합니다.
     UI 라벨만 바뀌고 목록이 그대로면 한국어 패치 노트를 일본어 화면에서 보게 됩니다. */
  await page.addInitScript(() => window.localStorage.setItem("yoro.google.consent.v1", "denied"));
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/public/patch-notes") {
      const asked = url.searchParams.get("locale") ?? "(none)";
      requestedLocales.push(asked);
      await json(route, asked === "ja" ? feed({ locale: "ja", notes: JA_NOTES }) : feed());
      return;
    }
    if (url.pathname === "/api/public/locale") {
      await json(route, { locale: "ko" });
      return;
    }
    await json(route, {});
  });
  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "window.__STREAMOPS_CONFIG__ = {};" });
  });
  await page.route(/^https:\/\/(?!127\.0\.0\.1)/, async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
  requestedLocales.length = 0;

  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero-title")).toContainText("리그 오브 레전드");

  /* 데스크톱은 상단바의 팝오버, 좁은 화면은 통합 메뉴 안의 radio 목록입니다. */
  const localeButton = page.locator(".public-locale-button").first();
  if (await localeButton.isVisible()) {
    await localeButton.click();
    await page.getByRole("menuitemradio", { name: /JP/ }).click();
  } else {
    await page.locator(".public-game-header__menu-button").click();
    await page.getByRole("radio", { name: /JP/ }).click();
  }

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("パッチノート");
  await expect(page.locator(".yoro-pn-hero-title")).toContainText("リーグ・オブ・レジェンド");
  expect(requestedLocales).toContain("ja");
  const href = await page.locator(".yoro-pn-link").first().getAttribute("href");
  expect(href).toContain("/ja-jp/");
});

test("요청한 언어와 다른 목록이 오면 화면에 올리지 않는다", async ({ page }) => {
  /* 캐시가 어긋나 한국어 목록이 일본어 요청에 실려 오면 조용히 보여 주지 않습니다. */
  await installFixtures(page, { patchNotes: feed() });
  await page.goto("/ja/patch-notes");

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".yoro-pn-hero")).toHaveCount(0);
});

test("빠른 필터는 개수를 함께 보여 주고 누르면 목록을 좁힌다", async ({ page }) => {
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [{ gameName: "YORO", tagLine: "KR1", lolPlatform: "kr" }],
    summary: SUMMARY
  });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero")).toBeVisible();

  const chips = page.locator(".yoro-pn-chip");
  /* 전체 · 내가 플레이한 · 시즌 26 · 시즌 25 */
  await expect(chips).toHaveCount(4);
  await expect(chips.nth(0)).toContainText("전체");
  await expect(chips.nth(0)).toContainText(String(NOTES.length));
  /* 누르기 전에 결과 규모를 알 수 있어야 합니다. */
  await expect(chips.nth(1)).toContainText("내가 플레이한");
  await expect(chips.nth(1)).toContainText("2");
  await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "true");

  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "false");
  /* 좁히는 조작이므로 히어로·타일을 접고 결과만 줄로 보여 줍니다. */
  await expect(page.locator(".yoro-pn-hero")).toHaveCount(0);
  await expect(page.locator(".yoro-pn-tile")).toHaveCount(0);
  await expect(page.locator(".yoro-pn-row")).toHaveCount(2);
  await expect(page.locator(".yoro-pn-row.is-played")).toHaveCount(2);
  await expect(page.locator(".yoro-pn-bar-count")).toHaveText(`2${"건"}`);

  /* 시즌 25 는 25.24 · 25.23 두 개입니다. */
  await page.getByRole("button", { name: /시즌 25/ }).click();
  await expect(page.locator(".yoro-pn-row")).toHaveCount(2);
  await expect(page.locator(".yoro-pn-row-num").first()).toHaveText("25.24");
});

test("기록이 없으면 플레이한 패치 칩을 내지 않는다", async ({ page }) => {
  await installFixtures(page, { patchNotes: feed(), stored: [] });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero")).toBeVisible();
  /* 눌러도 0건인 칩을 두면 헛걸음이 됩니다. */
  await expect(page.getByRole("button", { name: /내가 플레이한/ })).toHaveCount(0);
  await expect(page.locator(".yoro-pn-chip")).toHaveCount(3);
});

test("소환사 메뉴는 키보드로 다루고 닫으면 초점이 돌아온다", async ({ page }) => {
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [
      { gameName: "YORO", tagLine: "KR1", lolPlatform: "kr" },
      { gameName: "세이가", tagLine: "JP1", lolPlatform: "jp1" }
    ],
    summary: SUMMARY
  });
  await page.goto("/patch-notes");
  const trigger = page.locator(".yoro-pn-who");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.locator(".yoro-pn-who-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitemradio")).toHaveCount(2);
  await expect(menu.getByRole("menuitemradio").first()).toHaveAttribute("aria-checked", "true");
  /* v2 — 홈으로 나가는 링크는 제거했습니다. 다른 소환사는 모듈의 검색창으로 봅니다. */
  await expect(menu.getByRole("menuitem")).toHaveCount(0);

  /* 화살표로 옮기고 Escape 로 닫으면 초점이 트리거로 돌아와야 합니다. */
  await menu.getByRole("menuitemradio").first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemradio").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();

  /* 바깥을 누르면 닫힙니다. */
  await trigger.click();
  await expect(menu).toBeVisible();
  await page.locator(".yoro-pn-attribution").click();
  await expect(menu).toHaveCount(0);
});

test("검색과 결과 수는 같은 상자 안에 있다", async ({ page }) => {
  await installFixtures(page, { patchNotes: feed(), stored: [] });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-bar")).toBeVisible();

  /* 개수가 입력창 밖에 있으면 무엇의 개수인지 붙어 읽히지 않습니다. */
  const inside = await page.evaluate(() => {
    const box = document.querySelector(".yoro-pn-bar-search");
    return Boolean(box?.contains(document.querySelector(".yoro-pn-bar-count")));
  });
  expect(inside).toBe(true);
  await expect(page.locator(".yoro-pn-bar-count")).toHaveText(`${NOTES.length}${"건"}`);
  /* 돋보기 아이콘으로 입력창임을 즉시 알립니다. */
  await expect(page.locator(".yoro-pn-bar-icon")).toBeVisible();

  await page.locator(".yoro-pn-bar-search input").fill("26.14");
  await expect(page.locator(".yoro-pn-bar-count")).toHaveText("1건");
});

test("컨트롤 바가 문서를 가로로 넘치게 하지 않는다", async ({ page }) => {
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [{ gameName: "YORO", tagLine: "KR1", lolPlatform: "kr" }],
    summary: SUMMARY
  });
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-bar")).toBeVisible();

  /* 칩 줄은 가로로 스크롤되지만 그 때문에 페이지가 넘치면 안 됩니다. */
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    chipsScrolls: (() => {
      const chips = document.querySelector(".yoro-pn-bar-chips");
      return chips ? window.getComputedStyle(chips).overflowX : "";
    })()
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.chipsScrolls).toBe("auto");
});

/* v2 계약 — docs/mockups/lol-patch-notes-search-redesign.html §②-B/C/D, v2-6 */
const SUMMARY_V2: PatchPlaySummary = {
  schemaVersion: 1,
  gameName: "YORO",
  tagLine: "KR1",
  lolPlatform: "kr",
  sampledMatches: 20,
  fetchedAt: "2026-07-15T00:00:00.000Z",
  /* 히어로(16.15)·타일(16.14)·아카이브 줄(16.10, 15.24)에 고루 붙여
     막대 길이가 판수에 따라 달라지는지 한 화면에서 확인합니다. 합계는 표본 20 이하. */
  patches: [
    { patchKey: "16.15", games: 8, wins: 5, winRate: 62.5 },
    { patchKey: "16.14", games: 2, wins: 1, winRate: 50 },
    { patchKey: "16.10", games: 7, wins: 4, winRate: 57.1 },
    { patchKey: "15.24", games: 3, wins: 2, winRate: 66.7 }
  ]
};

async function installV2(page: Page): Promise<void> {
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [{
      gameName: "YORO",
      tagLine: "KR1",
      lolPlatform: "kr",
      profileIconUrl: "https://ddragon.leagueoflegends.com/i.png"
    }],
    summary: SUMMARY_V2
  });
}

test("표시 중에도 소환사 검색창이 남고 페이지를 떠나지 않는다", async ({ page }) => {
  /* v1 결함 — 활성 분기에 form 이 없어 이미 조회한 대상 사이에서만 오갈 수 있었고,
     "다른 소환사 검색하기" 링크는 홈(/)으로 이동해 패치 노트를 떠났습니다. */
  await installV2(page);
  await page.goto("/patch-notes");
  const mine = page.getByTestId("patch-notes-mine-module");
  await expect(mine).toContainText("YORO#KR1");

  await expect(mine.locator("form")).toHaveCount(1);
  await expect(mine.getByRole("textbox")).toBeVisible();
  /* 홈으로 튕기는 이탈 링크는 없어야 합니다. */
  await expect(mine.locator('a[href="/"], a[href="/ko/"], a[href="/ja/"]')).toHaveCount(0);

  await mine.getByRole("textbox").fill("Faker#KR1");
  await mine.getByRole("button", { name: "보기" }).click();
  await expect(mine).toContainText("Faker#KR1");
  await expect(page).toHaveURL(/\/patch-notes(?:\?.*)?$/u);
});

test("소환사 모듈은 이모지 없이 그리고 설명문 대비를 4.5:1 이상으로 유지한다", async ({ page }) => {
  await installFixtures(page, { patchNotes: feed() });
  await page.goto("/patch-notes");
  const mine = page.getByTestId("patch-notes-mine-module");
  await expect(mine).toBeVisible();

  /* 이모지는 플랫폼마다 모양이 달라지고 문구와 같은 말을 반복합니다. */
  await expect(mine.locator(".yoro-pn-mine-icon")).toHaveCount(0);
  await expect(mine).not.toContainText("📊");

  /* 라이트 테마 토큰(--yoro-color-text-muted)을 이 다크 모듈에서 쓰면 3.86:1 로 묻힙니다. */
  const ratio = await mine.locator(".yoro-pn-mine-copy small").evaluate((el) => {
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const [a, b] = [lum(parse(getComputedStyle(el).color)), lum([16, 22, 42])].sort((x, y) => y - x);
    return Math.round(((a! + 0.05) / (b! + 0.05)) * 100) / 100;
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("승률 막대는 판수에 비례하고 표본이 적으면 참고용으로 표시한다", async ({ page }) => {
  await installV2(page);
  await page.goto("/patch-notes");
  await expect(page.locator(".yoro-pn-hero")).toBeVisible();

  /* 승률이 같아도 판수가 다르면 막대 길이가 달라야 합니다(3판 2승 vs 30판 20승 문제). */
  const widths = await page.locator(".yoro-pn-gauge-track").evaluateAll(
    (nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width))
  );
  expect(widths.length).toBeGreaterThan(1);
  expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths));

  /* 5판 미만은 숫자만 보고 과신하지 않게 문구를 답니다. */
  await expect(page.locator(".yoro-pn-gauge-thin").first()).toContainText("참고용");

  /* 타일은 숫자 배지 안에 미니 막대를 함께 그립니다. */
  await expect(page.locator(".yoro-pn-tile-rate > i").first()).toBeVisible();

  /* 추이 스파크는 이미 받은 summary.patches 로만 그립니다. */
  const trend = page.locator(".yoro-pn-trend");
  await expect(trend).toBeVisible();
  await expect(trend.locator("i")).toHaveCount(SUMMARY_V2.patches.length);
});

test("소환사 모듈은 상태가 바뀌어도 행 수가 유지되고 좁은 화면에서 넘치지 않는다", async ({ page }) => {
  /* v1 은 flex-wrap 이라 문구 길이에 따라 폼이 제 줄로 접혀 75px ↔ 166px 로 요동했습니다. */
  await installV2(page);
  await page.goto("/patch-notes");
  const mine = page.getByTestId("patch-notes-mine-module");
  await expect(mine).toBeVisible();

  for (const width of [1440, 1024, 820, 700, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${width}px 가로 스크롤`).toBeLessThanOrEqual(0);
  }

  /* 넓은 폭에서는 조작부가 같은 행에 있어야 합니다(다음 행으로 밀리면 높이가 뜁니다). */
  await page.setViewportSize({ width: 1280, height: 900 });
  const sameRow = await mine.evaluate((root) => {
    const head = root.querySelector(".yoro-pn-mine-head");
    const acts = root.querySelector(".yoro-pn-mine-acts");
    if (!head || !acts) return false;
    return Math.abs(head.getBoundingClientRect().top - acts.getBoundingClientRect().top) <= 8;
  });
  expect(sameRow).toBe(true);
});

test("소환사 모듈의 글자는 어떤 상태에서도 배경에 묻히지 않는다", async ({ page }) => {
  /* 회귀 고정 — .yoro-pn-who 와 .yoro-pn-bar-state 는 흰색 .yoro-pn-bar 안에
     살던 선택기였는데, 다크한 .yoro-pn-mine-module 로 옮겨오면서 라이트 카드용
     --pn-ink(#14171f)·--pn-ink-soft·--pn-bad 를 그대로 들고 왔습니다. 실측하면
     소환사 이름 1.14:1, 로딩 문구 1.58:1, 오류 문구 2.18:1 이었습니다.
     모듈 배경이 불투명해졌으므로 조상 배경을 거슬러 올라가 계산할 수 있습니다. */
  await installFixtures(page, {
    patchNotes: feed(),
    stored: [
      { gameName: "맹금류애니비아", tagLine: "9314", lolPlatform: "kr" },
      { gameName: "YORO", tagLine: "KR1", lolPlatform: "kr" }
    ],
    summary: SUMMARY_V2
  });
  await page.goto("/patch-notes");
  const mine = page.getByTestId("patch-notes-mine-module");
  await expect(mine).toBeVisible();

  const failures = await mine.evaluate((root) => {
    const parse = (value: string) => {
      const match = /rgba?\(([^)]+)\)/u.exec(value);
      if (!match?.[1]) return null;
      const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
      return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts.length > 3 ? parts[3]! : 1 };
    };
    const channel = (value: number) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (c: { r: number; g: number; b: number }) =>
      0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    /* 첫 불투명 배경까지 올라가며 반투명 층을 합성합니다. */
    const backdrop = (element: Element) => {
      let node: Element | null = element;
      let acc: { r: number; g: number; b: number; a: number } | null = null;
      while (node) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0) {
          if (!acc) acc = { ...bg };
          else {
            const a = acc.a;
            acc = {
              r: acc.r * a + bg.r * (1 - a),
              g: acc.g * a + bg.g * (1 - a),
              b: acc.b * a + bg.b * (1 - a),
              a: a + bg.a * (1 - a)
            };
          }
          if (acc.a >= 0.99) return acc;
        }
        node = node.parentElement;
      }
      return acc;
    };

    const bad: string[] = [];
    for (const element of root.querySelectorAll<HTMLElement>("*")) {
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? "")
        .join("");
      if (!text) continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;

      const style = getComputedStyle(element);
      const fg = parse(style.color);
      const bg = backdrop(element);
      /* 불투명 배경을 못 찾으면 계산이 성립하지 않습니다 — 그 자체가 결함입니다. */
      if (!fg || !bg || bg.a < 0.99) {
        bad.push(`${element.className || element.tagName}: 불투명 배경 없음`);
        continue;
      }
      const blended = fg.a >= 1
        ? fg
        : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a)
        };
      const l1 = luminance(blended);
      const l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = Number.parseFloat(style.fontSize);
      const weight = Number.parseInt(style.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        bad.push(`${element.className || element.tagName} "${text.slice(0, 12)}" ${ratio.toFixed(2)}:1 < ${need}`);
      }
    }
    return bad;
  });
  expect(failures, "모듈 안 저대비 글자").toEqual([]);

  /* 넓은 폭에서는 최근 검색도 신원과 같은 행입니다 — grid-column:1/-1 로 자기 행을
     못박으면 폭이 남아도 항상 2행이 되어 모듈이 70px → 112px 로 커집니다. */
  await page.setViewportSize({ width: 1440, height: 900 });
  const rows = await mine.evaluate((root) => {
    const tops = new Set<number>();
    for (const child of root.children) {
      const box = child.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      tops.add(Math.round(box.top / 8));
    }
    return tops.size;
  });
  expect(rows, "1440px 에서 모듈 행 수").toBe(1);
});

test("공유 카드는 1.91:1 규격 안에 모든 블록을 담고 글자가 카드 밖으로 나가지 않는다", async ({ page }) => {
  /* 예전 카드는 폭 1080 에 내용만큼 세로로 늘어나 1080×990(1.09:1)까지 자랐고,
     SNS 타임라인이 위아래를 잘라 푸터의 출처 문구까지 사라졌습니다(2026-08-18 실사례).
     이제 1200×630 고정에 본문을 3단으로 놓습니다. 히어로가 남는 세로를 흡수하므로
     내용이 적어도 아래가 비지 않습니다.

     키 아트는 같은 origin 프록시로 받습니다 — Riot CDN 은 CORS 헤더를 주지 않아
     crossOrigin 로드가 실패하고 히어로가 늘 빈 그라디언트로 닫혔습니다. */
  test.skip((page.viewportSize()?.width ?? 1440) <= 768, "카드 규격은 뷰포트와 무관하므로 한 번만 확인합니다");
  await installFixtures(page, feed());
  await page.goto("/ko/patch-notes");

  const result = await page.evaluate(async () => {
    const module = await import("/src/features/public-lol/utils/patch-summary-share.ts");
    const icon = (id: number) => `https://ddragon.leagueoflegends.com/cdn/16.16.1/img/champion/${id}.png`;
    const names = ["아우렐리온 솔", "트위스티드 페이트", "누누와 윌럼프"];
    /* 실측(16.15.1 → 16.16.1)에 가장 긴 이름·라벨을 섞은 최대 밀도입니다. */
    const summary = {
      patchVersion: "26.16",
      comparedVersions: ["16.15.1", "16.16.1"] as [string, string],
      systemChanges: [
        { stat: "spellblockperlevel", from: 1.3, to: 1.1, championCount: 128 },
        { stat: "attackdamageperlevel", from: 3.25, to: 3.75, championCount: 27 },
        { stat: "hpregenperlevel", from: .55, to: .75, championCount: 9 },
      ],
      championChanges: [
        ...names.map((name, index) => ({
          championId: 100 + index, name, iconUrl: icon(100 + index), direction: "buff" as const,
          changes: [{ stat: "spellblockperlevel", from: 1.3, to: 1.1 }],
        })),
        ...names.slice(0, 2).map((name, index) => ({
          championId: 200 + index, name, iconUrl: icon(200 + index), direction: "nerf" as const,
          changes: [{ stat: "attackdamageperlevel", from: 3.25, to: 3.75 }],
        })),
        {
          championId: 78, name: "뽀삐", iconUrl: icon(78), direction: "adjust" as const,
          changes: [{ stat: "mp", from: 280, to: 300 }, { stat: "attackdamage", from: 60, to: 56 }],
        },
      ],
      itemChanges: [
        { itemId: 3068, name: "존야의 모래시계", iconUrl: icon(3068), kind: "price" as const, from: 2700, to: 2800 },
        { itemId: 3157, name: "리안드리의 고통", iconUrl: icon(3157), kind: "price" as const, from: 2700, to: 2800 },
      ],
      skillChangesIncluded: false,
    };

    /* 그려지는 모든 문자열의 실제 폭을 재서 카드 밖으로 나가는 것을 찾습니다.
       elementFromPoint 같은 간접 확인이 아니라 캔버스가 받는 좌표 그대로입니다. */
    const drawn: { value: string; left: number; right: number }[] = [];
    const proto = CanvasRenderingContext2D.prototype;
    const originalFill = proto.fillText;
    proto.fillText = function patched(this: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth?: number) {
      const width = this.measureText(String(value)).width;
      drawn.push({
        value: String(value),
        left: this.textAlign === "right" ? x - width : x,
        right: this.textAlign === "right" ? x : x + width,
      });
      return originalFill.call(this, value, x, y, maxWidth as number);
    } as typeof proto.fillText;

    const blob = await module.createPatchSummaryShareBlob({
      note: {
        slug: "patch-26-16", title: "리그 오브 레전드 26.16 패치 노트",
        summary: "챔피언과 체계 업데이트, 클래식에 찾아온 닌자 등 다양한 변경 사항을 확인해 보세요!",
        publishedAt: "2026-08-12T00:00:00.000Z", patchVersion: "26.16",
        url: "https://example.test/", accentColor: "#231612",
      },
      summary,
      record: { patchKey: "16.16", games: 18, wins: 11, winRate: 61.1 },
      topChampions: names.map((name, index) => ({
        championId: 100 + index, name, iconUrl: icon(100 + index), games: 7 - index, wins: 4 - index,
      })),
      delta: 12.5,
      locale: "ko",
      text: {
        eyebrow: "패치 변경 요약", scope: "기본 스탯 · 아이템 기준", system: "시스템 변경",
        buff: "버프", nerf: "너프", adjust: "조정", items: "아이템",
        championCount: "챔피언 {n}명", winRate: "이 패치 승률", topChampions: "최다 사용 챔피언",
        games: "게임", source: "데이터 Riot Data Dragon · 요약 YORO.gg 자동 비교",
        itemNew: "신규", itemRemoved: "삭제",
      },
    });
    proto.fillText = originalFill;

    const bitmap = await createImageBitmap(blob);
    return { width: bitmap.width, height: bitmap.height, drawn };
  });

  /* ① 규격 — SNS 가 자를 수 없는 비율. */
  expect(result.width).toBe(1200);
  expect(result.height).toBe(630);
  expect(result.width / result.height).toBeGreaterThanOrEqual(1.9);

  /* ② 글자는 좌우 여백(48px) 안에 머뭅니다. */
  const outside = result.drawn.filter((entry) => entry.left < 47.5 || entry.right > 1152.5);
  expect(outside.map((entry) => `${entry.value} ${Math.round(entry.left)}..${Math.round(entry.right)}`)).toEqual([]);

  /* ③ 조정 챔피언은 화면 패널에 나오므로 카드에서도 빠지면 안 됩니다
        — 그 패치에서 가장 많이 바뀐 챔피언이 공유 이미지에서 사라집니다. */
  expect(result.drawn.some((entry) => entry.value === "뽀삐")).toBe(true);

  /* ④ 출처 문구는 항상 남습니다 — 이 카드는 Riot 본문 요약이 아닙니다. */
  expect(result.drawn.some((entry) => entry.value.includes("Riot Data Dragon"))).toBe(true);
});
