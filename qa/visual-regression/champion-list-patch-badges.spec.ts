import { expect, test, type Page, type Route } from "@playwright/test";
import type { LolChampionSummary, PatchNote, PatchNotesFeed } from "@streamops/shared";

/* 전체 챔피언 목록의 최신 패치 버프/너프 배지 + 정렬 —
   목업 `docs/mockups/lol-champion-buff-nerf.approved-spec.html` §02·§03·§06 계약입니다.

   이 화면의 배지는 목록 API 와 무관한 부가 정보라 fail-soft 여야 합니다. 그래서
   "배지가 뜬다"만 보지 않고 "패치 요약이 없어도 목록이 그대로 산다"를 함께 봅니다. */

const CHAMPIONS: LolChampionSummary[] = [
  { championId: 266, championKey: "Aatrox", nameKo: "아트록스", nameJa: "エイトロックス", nameEn: "Aatrox" },
  { championId: 103, championKey: "Ahri", nameKo: "아리", nameJa: "アーリ", nameEn: "Ahri" },
  { championId: 22, championKey: "Ashe", nameKo: "애쉬", nameJa: "アッシュ", nameEn: "Ashe" },
  { championId: 53, championKey: "Blitzcrank", nameKo: "블리츠크랭크", nameJa: "ブリッツクランク", nameEn: "Blitzcrank" },
  { championId: 164, championKey: "Camille", nameKo: "카밀", nameJa: "カミール", nameEn: "Camille" },
  { championId: 122, championKey: "Darius", nameKo: "다리우스", nameJa: "ダリウス", nameEn: "Darius" },
  { championId: 81, championKey: "Ezreal", nameKo: "이즈리얼", nameJa: "エズリアル", nameEn: "Ezreal" },
  { championId: 104, championKey: "Graves", nameKo: "그레이브즈", nameJa: "グレイブス", nameEn: "Graves" }
];

/* 패치 번호가 큰 것이 최신입니다. 목록 순서를 일부러 흐트러뜨려, 화면이 피드 정렬이
   아니라 번호 비교로 최신을 고르는지 봅니다("16.9" > "16.17" 문자열 비교 함정). */
const NOTES: PatchNote[] = [
  {
    slug: "patch-16-9-notes",
    title: "리그 오브 레전드 16.9 패치 노트",
    publishedAt: "2026-05-06T18:00:00.000Z",
    patchVersion: "16.9",
    dataDragonVersion: "16.9.1",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/patch-16-9-notes"
  },
  {
    slug: "season-notice",
    title: "시즌 안내",
    publishedAt: "2026-08-30T18:00:00.000Z",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/season-notice"
  },
  {
    slug: "patch-16-17-notes",
    title: "리그 오브 레전드 16.17 패치 노트",
    publishedAt: "2026-08-25T18:00:00.000Z",
    patchVersion: "16.17",
    dataDragonVersion: "16.17.1",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/patch-16-17-notes"
  },
  {
    slug: "patch-16-16-notes",
    title: "리그 오브 레전드 16.16 패치 노트",
    publishedAt: "2026-08-11T18:00:00.000Z",
    patchVersion: "16.16",
    dataDragonVersion: "16.16.1",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/patch-16-16-notes"
  }
];

/* 다리우스=너프 · 블리츠크랭크=버프 · 아트록스=버프 · 애쉬=너프 · 이즈리얼=버프,
   그리고 카밀은 adjust — adjust 는 배지도 정렬 우선순위도 받지 않습니다(목업 §07). */
const CHANGE_SUMMARY = {
  patchVersion: "16.17",
  comparedVersions: ["16.16.1", "16.17.1"],
  systemChanges: [],
  championChanges: [
    { championId: 122, name: "다리우스", direction: "nerf", changes: [{ stat: "movespeed", from: 340, to: 335 }] },
    { championId: 53, name: "블리츠크랭크", direction: "buff", changes: [{ stat: "hp", from: 600, to: 620 }] },
    { championId: 266, name: "아트록스", direction: "buff", changes: [{ stat: "attackdamage", from: 60, to: 63 }] },
    { championId: 22, name: "애쉬", direction: "nerf", changes: [{ stat: "attackspeed", from: 0.658, to: 0.64 }] },
    { championId: 81, name: "이즈리얼", direction: "buff", changes: [{ stat: "hp", from: 530, to: 545 }] },
    { championId: 164, name: "카밀", direction: "adjust", changes: [{ stat: "armor", from: 35, to: 34 }] }
  ],
  itemChanges: [],
  skillChangesIncluded: false
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

function feed(): PatchNotesFeed {
  return {
    schemaVersion: 1,
    locale: "ko",
    fetchedAt: "2026-09-01T00:00:00.000Z",
    stale: false,
    notes: NOTES
  };
}

type Fixtures = {
  /** 숫자면 그 상태 코드로 실패시킵니다(계약 없는 배포 재현). */
  changes?: unknown | number;
  patchNotes?: PatchNotesFeed | number;
};

async function installChampionListFixtures(page: Page, fixtures: Fixtures = {}): Promise<void> {
  const changes = fixtures.changes ?? CHANGE_SUMMARY;
  const patchNotes = fixtures.patchNotes ?? feed();
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
    if (pathname === "/api/public/patch-notes") {
      if (typeof patchNotes === "number") {
        await route.fulfill({ status: patchNotes, contentType: "application/json", body: "{}" });
        return;
      }
      await json(route, patchNotes);
      return;
    }
    if (pathname === "/api/public/patch-notes/changes") {
      if (typeof changes === "number") {
        await route.fulfill({ status: changes, contentType: "application/json", body: "{}" });
        return;
      }
      await json(route, changes);
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

function cardNames(page: Page): Promise<string[]> {
  return page.locator(".public-champion-card-name").allInnerTexts();
}

/** 토큰 원값(#RRGGBB)을 브라우저가 계산한 color 표기로 옮겨 같은 축에서 비교합니다. */
function hexToRgb(page: Page, hex: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.append(probe);
    const { color } = window.getComputedStyle(probe);
    probe.remove();
    return color;
  }, hex);
}

test("최신 패치 배지가 붙고, 변경 챔피언이 구분선 아래 앞줄로 모인다", async ({ page }) => {
  await installChampionListFixtures(page);
  await page.goto("/lol/champions");
  await expect(page.locator(".public-champion-card").first()).toBeVisible();

  /* 최신은 16.17 입니다 — 16.9 나 패치 번호 없는 공지가 앞에 있어도 흔들리지 않습니다. */
  const grouplines = page.locator(".public-champions-groupline");
  await expect(grouplines).toHaveCount(2);
  await expect(grouplines.nth(0)).toHaveText("16.17 패치에서 변경된 챔피언");
  await expect(grouplines.nth(1)).toHaveText("변경 없음");

  /* 변경 그룹(가나다) → 무변경 그룹(가나다). adjust 인 카밀은 무변경 쪽입니다. */
  expect(await cardNames(page)).toEqual([
    "다리우스", "블리츠크랭크", "아트록스", "애쉬", "이즈리얼",
    "그레이브즈", "아리", "카밀"
  ]);

  await expect(page.locator('.public-champion-card-badge[data-direction="buff"]')).toHaveCount(3);
  await expect(page.locator('.public-champion-card-badge[data-direction="nerf"]')).toHaveCount(2);
  await expect(page.locator(".public-champion-card-badge")).toHaveCount(5);

  /* 배지는 아이콘 형제여야 잘리지 않습니다(아이콘은 overflow: hidden — 목업 §07). */
  await expect(page.locator(".public-champion-card-figure > .public-champion-card-badge")).toHaveCount(5);

  /* 판정은 카드 aria-label 이 말합니다 — 배지는 aria-hidden 이라 낭독되지 않습니다(§06). */
  await expect(page.getByLabel("아트록스 — 이번 패치에서 버프되었습니다. 글로벌 빌드 통계 보기")).toBeVisible();
  await expect(page.getByLabel("애쉬 — 이번 패치에서 너프되었습니다. 글로벌 빌드 통계 보기")).toBeVisible();
  await expect(page.getByLabel("카밀 글로벌 빌드 통계 보기")).toBeVisible();
  await expect(page.locator('.public-champion-card-badge[aria-hidden="true"]')).toHaveCount(5);

  /* 판정색은 --graph-win-ink/--graph-loss-ink 참조뿐입니다 — 새 색을 만들지 않았으므로
     테마가 뒤집혀도 배지 글자색은 그 토큰의 현재 값과 언제나 같아야 합니다. */
  const buff = await page.locator('.public-champion-card-badge[data-direction="buff"]').first()
    .evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { color: style.color, token: style.getPropertyValue("--graph-win-ink").trim() };
    });
  const nerf = await page.locator('.public-champion-card-badge[data-direction="nerf"]').first()
    .evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { color: style.color, token: style.getPropertyValue("--graph-loss-ink").trim() };
    });
  /* 다크 #63C375/#E97180 · 라이트 #1D8139/#C0394A — 화면 테마가 고른 쪽 한 값입니다. */
  expect(["#63c375", "#1d8139"]).toContain(buff.token.toLowerCase());
  expect(["#e97180", "#c0394a"]).toContain(nerf.token.toLowerCase());
  expect(buff.color).toBe(await hexToRgb(page, buff.token));
  expect(nerf.color).toBe(await hexToRgb(page, nerf.token));

  /* 배지가 카드 높이·격자 리듬을 바꾸지 않는 것이 A안 확정 근거입니다(§02). */
  const withBadge = await page.locator(".public-champion-card").first().boundingBox();
  const withoutBadge = await page.locator(".public-champion-card").last().boundingBox();
  expect(withBadge?.height).toBe(withoutBadge?.height);
});

test("검색 중에는 구분선과 우선 정렬이 사라지고 순수 이름순으로 돌아간다", async ({ page }) => {
  await installChampionListFixtures(page);
  await page.goto("/lol/champions");
  await expect(page.locator(".public-champions-groupline")).toHaveCount(2);

  /* 한국어 화면에서도 라틴 표기로 찾힙니다(기존 검색 계약). "s" 는 Ashe·Darius·Graves —
     변경 2 + 무변경 1 이라 우선 정렬이 남아 있으면 순서가 달라집니다. */
  await page.getByLabel("챔피언 검색").fill("s");
  await expect(page.locator(".public-champions-groupline")).toHaveCount(0);
  /* 우선 정렬이 켜져 있었다면 "다리우스 · 애쉬 · 그레이브즈" 였을 자리입니다. */
  expect(await cardNames(page)).toEqual(["그레이브즈", "다리우스", "애쉬"]);
  /* 배지 자체는 검색 중에도 남습니다 — 사라지는 것은 그룹 경계와 우선 배치뿐입니다. */
  await expect(page.locator(".public-champion-card-badge")).toHaveCount(2);

  await page.getByLabel("챔피언 검색").fill("");
  await expect(page.locator(".public-champions-groupline")).toHaveCount(2);
});

test("패치 변경 요약이 없어도 목록은 그대로 살고 오류를 노출하지 않는다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installChampionListFixtures(page, { changes: 404 });
  await page.goto("/lol/champions");
  await expect(page.locator(".public-champion-card").first()).toBeVisible();

  await expect(page.locator(".public-champion-card-badge")).toHaveCount(0);
  await expect(page.locator(".public-champions-groupline")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  /* 배지가 없으면 정렬은 이전 화면과 똑같은 순수 이름순으로 되돌아갑니다. */
  expect(await cardNames(page)).toEqual([
    "그레이브즈", "다리우스", "블리츠크랭크", "아리", "아트록스", "애쉬", "이즈리얼", "카밀"
  ]);
  expect(errors).toEqual([]);
});

test("패치 노트 피드 자체가 죽어도 목록은 그대로 산다", async ({ page }) => {
  await installChampionListFixtures(page, { patchNotes: 503 });
  await page.goto("/lol/champions");
  await expect(page.locator(".public-champion-card").first()).toBeVisible();
  await expect(page.locator(".public-champion-card")).toHaveCount(8);
  await expect(page.locator(".public-champion-card-badge")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
