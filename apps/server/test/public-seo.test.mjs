import test from "node:test";
import assert from "node:assert/strict";

const {
  applyPublicSeoMetadata,
  palworldEntityPath,
  palworldEntityRedirectPath,
  palworldEntityRouteForPath,
  palworldEntitySeoMetadata,
  publicSeoMetadataForPath,
} = await import("../dist/routes/public-seo.js");
const {
  PUBLIC_SITEMAP_STATIC_PATHS,
  buildPalworldEntitySitemap,
  buildSitemapIndex,
  buildStaticSitemap,
} = await import("../dist/routes/public-sitemap.js");

const APP_SHELL = '<!doctype html><html lang="ko"><head>'
  + '<meta name="description" content="home">'
  + '<link rel="canonical" href="https://yoro.gg/">'
  + '<meta property="og:title" content="home">'
  + '<meta property="og:description" content="home">'
  + '<meta property="og:url" content="https://yoro.gg/">'
  + '<meta name="twitter:title" content="home">'
  + '<meta name="twitter:description" content="home">'
  + "<title>YORO.gg</title></head><body><div id=\"root\"></div></body></html>";

function render(pathname) {
  return applyPublicSeoMetadata(APP_SHELL, publicSeoMetadataForPath(pathname));
}

test("공개 페이지는 ko·ja·x-default hreflang을 상호 참조로 노출한다", () => {
  const html = render("/ja/palworld/pals");
  assert.match(html, /<link rel="alternate" hreflang="ko" href="https:\/\/yoro\.gg\/ko\/palworld\/pals" \/>/u);
  assert.match(html, /<link rel="alternate" hreflang="ja" href="https:\/\/yoro\.gg\/ja\/palworld\/pals" \/>/u);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/yoro\.gg\/ko\/palworld\/pals" \/>/u);
  assert.match(html, /<link rel="canonical" href="https:\/\/yoro\.gg\/ja\/palworld\/pals">/u);
  assert.match(html, /<html lang="ja"/u);
});

test("hreflang은 비지역화 경로에는 붙지 않는다", () => {
  const html = render("/login");
  assert.doesNotMatch(html, /hreflang/u);
});

test("공개 홈은 WebSite SearchAction과 Organization JSON-LD를 제공한다", () => {
  const html = render("/");
  const scripts = [...html.matchAll(/<script type="application\/ld\+json" nonce="([^"]*)">([\s\S]*?)<\/script>/gu)];
  assert.equal(scripts.length, 2);
  // CSP nonce placeholder가 있어야 정적 파일과 같은 치환 경로를 탄다.
  assert.equal(scripts[0][1], "__STREAMOPS_CSP_NONCE__");
  const types = scripts.map((match) => JSON.parse(match[2])["@type"]);
  assert.deepEqual(types, ["WebSite", "Organization"]);
  const website = JSON.parse(scripts[0][2]);
  assert.equal(website.potentialAction["@type"], "SearchAction");
});

test("하위 경로는 BreadcrumbList를 제공한다", () => {
  const html = render("/ko/palworld/skills");
  const script = /<script type="application\/ld\+json"[^>]*>(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList[\s\S]*?)<\/script>/u.exec(html);
  assert.ok(script, "BreadcrumbList JSON-LD가 있어야 합니다");
  const breadcrumb = JSON.parse(script[1]);
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.item),
    ["https://yoro.gg/ko/", "https://yoro.gg/ko/palworld", "https://yoro.gg/ko/palworld/skills"],
  );
});

test("준비 중인 발로란트 공개 경로는 locale별 metadata를 제공하되 색인하지 않는다", () => {
  const ko = render("/ko/valorant/agents");
  const ja = render("/ja/valorant/ranked");
  assert.match(ko, /<title>발로란트 요원 도감 \| YORO\.gg<\/title>/u);
  assert.match(ko, /<link rel="canonical" href="https:\/\/yoro\.gg\/ko\/valorant\/agents">/u);
  assert.match(ja, /<html lang="ja"/u);
  assert.match(ja, /<link rel="canonical" href="https:\/\/yoro\.gg\/ja\/valorant\/ranked">/u);
  assert.match(ko, /name="robots" content="noindex"/u);
  assert.match(ja, /name="robots" content="noindex"/u);
  const sitemap = buildStaticSitemap();
  assert.doesNotMatch(sitemap, /\/valorant/u);
});

test("마인크래프트 실데이터 경로는 고유 metadata를 제공하고 준비 중 경로는 색인하지 않는다", () => {
  const ko = publicSeoMetadataForPath("/ko/minecraft/recipes");
  const ja = publicSeoMetadataForPath("/ja/minecraft/enchants");
  assert.equal(ko.title, "마인크래프트 조합법 | YORO.gg");
  assert.match(ko.description, /제작 조합법/u);
  assert.equal(ko.robotsNoindex, undefined);
  assert.equal(ja.title, "マインクラフト エンチャント | YORO.gg");
  assert.equal(ja.canonicalUrl, "https://yoro.gg/ja/minecraft/enchants");

  const library = publicSeoMetadataForPath("/ko/minecraft/library");
  const patchNotes = publicSeoMetadataForPath("/ja/minecraft/patch-notes");
  assert.equal(library.robotsNoindex, true);
  assert.equal(patchNotes.robotsNoindex, true);
  assert.match(applyPublicSeoMetadata(APP_SHELL, library), /name="robots" content="noindex"/u);

  const sitemap = buildStaticSitemap();
  assert.match(sitemap, /\/ko\/minecraft\/recipes/u);
  assert.match(sitemap, /\/ja\/minecraft\/items/u);
  assert.doesNotMatch(sitemap, /\/minecraft\/(?:library|patch-notes)/u);

  const readyPatchNotes = publicSeoMetadataForPath("/ja/minecraft/patch-notes", {
    minecraftPatchNotesReady: true,
  });
  assert.equal(readyPatchNotes.robotsNoindex, undefined);
  assert.equal(readyPatchNotes.title, "マインクラフト パッチノート | YORO.gg");
  const readySitemap = buildStaticSitemap(undefined, { minecraftPatchNotesReady: true });
  assert.match(readySitemap, /\/ko\/minecraft\/patch-notes/u);
  assert.match(readySitemap, /\/ja\/minecraft\/patch-notes/u);
});

test("JSON-LD는 script 종료 태그를 만들 수 있는 문자를 escape한다", () => {
  const metadata = publicSeoMetadataForPath("/");
  const html = applyPublicSeoMetadata(APP_SHELL, {
    ...metadata,
    structuredData: [{ "@type": "Thing", name: "</script><script>alert(1)</script>" }],
  });
  assert.doesNotMatch(html, /<\/script><script>alert/u);
  assert.match(html, /\\u003c\\u002fscript|\\u003c\/script|\\u003c/u);
});

test("app shell은 crawler가 읽을 수 있는 h1과 내부 링크를 담는다", () => {
  const html = render("/ko/");
  assert.match(html, /<div id="root"><div class="seo-fallback" data-seo-fallback="true"><h1>/u);
  assert.match(html, /<a href="\/ko\/palworld\/pals">팰 도감<\/a>/u);
  assert.doesNotMatch(html, /<div id="root"><\/div>/u);
});

test("Palworld 엔티티 경로를 해석하고 조작된 id는 거부한다", () => {
  assert.deepEqual(
    palworldEntityRouteForPath("/ja/palworld/pals/lamball"),
    { id: "lamball", kind: "pal", locale: "ja" },
  );
  assert.deepEqual(
    palworldEntityRouteForPath("/palworld/items/accessory-talent-checker"),
    { id: "accessory-talent-checker", kind: "item", locale: "ko" },
  );
  assert.equal(palworldEntityRouteForPath("/palworld/pals"), undefined);
  assert.equal(palworldEntityRouteForPath("/palworld/pals/../../etc/passwd"), undefined);
  assert.equal(palworldEntityRouteForPath("/palworld/pals/UPPER"), undefined);
  assert.equal(palworldEntityRouteForPath("/palworld/unknown/lamball"), undefined);
});

test("legacy 상세 query는 고유 경로로 흡수된다", () => {
  assert.equal(
    palworldEntityRedirectPath("/ko/palworld/pals", new URLSearchParams("pal=lamball")),
    "/ko/palworld/pals/lamball",
  );
  assert.equal(
    palworldEntityRedirectPath("/palworld/items", new URLSearchParams("item=stone")),
    "/palworld/items/stone",
  );
  // 상세 query가 없으면 목록 URL을 그대로 둡니다.
  assert.equal(palworldEntityRedirectPath("/palworld/pals", new URLSearchParams("sort=name")), undefined);
  // 같은 key가 여러 개면 조작된 URL로 보고 이동하지 않습니다.
  assert.equal(palworldEntityRedirectPath("/palworld/pals", new URLSearchParams("pal=a&pal=b")), undefined);
});

test("Palworld 엔티티 metadata는 엔티티별 title과 canonical을 만든다", () => {
  const route = { id: "lamball", kind: "pal", locale: "ko" };
  const metadata = palworldEntitySeoMetadata(route, {
    id: "lamball",
    nameKo: "도로롱",
    nameJa: "モコロン",
    nameEn: "Lamball",
    number: 1,
    elements: ["neutral"],
    rarity: 1,
  });
  assert.equal(metadata.canonicalUrl, "https://yoro.gg/ko/palworld/pals/lamball");
  assert.equal(metadata.title, "도로롱(Lamball) 능력치·교배 | 팰월드 | YORO.gg");
  assert.equal(metadata.openGraphType, "article");
  assert.equal(metadata.alternateUrls.ja, "https://yoro.gg/ja/palworld/pals/lamball");
  assert.equal(metadata.fallback.heading, "도로롱");

  const html = applyPublicSeoMetadata(APP_SHELL, metadata);
  assert.match(html, /<h1>도로롱<\/h1>/u);
  assert.match(html, /<dt>도감 번호<\/dt><dd>No\.1<\/dd>/u);
  assert.match(html, /<a href="\/ko\/palworld\/breeding">교배 조합 보기<\/a>/u);
});

test("일본어 엔티티 metadata는 일본어 이름과 문구를 사용한다", () => {
  const metadata = palworldEntitySeoMetadata(
    { id: "lamball", kind: "pal", locale: "ja" },
    { id: "lamball", nameKo: "도로롱", nameJa: "モコロン", nameEn: "Lamball" },
  );
  assert.equal(metadata.title, "モコロン(Lamball) ステータス・配合 | パルワールド | YORO.gg");
  assert.equal(metadata.canonicalUrl, "https://yoro.gg/ja/palworld/pals/lamball");
});

test("엔티티 경로 생성은 id를 URL escape한다", () => {
  assert.equal(palworldEntityPath("skill", "passive-a_b-1"), "/palworld/skills/passive-a_b-1");
});

test("sitemap index는 하위 sitemap만 나열한다", () => {
  const xml = buildSitemapIndex([
    { path: "/sitemap-static.xml" },
    { path: "/sitemap-palworld-pals.xml", lastmod: "2026-08-01T00:00:00.000Z" },
  ]);
  assert.match(xml, /<sitemapindex/u);
  assert.match(xml, /<loc>https:\/\/yoro\.gg\/sitemap-static\.xml<\/loc>/u);
  assert.match(xml, /<lastmod>2026-08-01T00:00:00\.000Z<\/lastmod>/u);
});

test("잘못된 lastmod는 생략한다", () => {
  // 부정확한 lastmod는 Google이 사이트 전체의 lastmod를 무시하게 만듭니다.
  const xml = buildSitemapIndex([{ path: "/sitemap-static.xml", lastmod: "not-a-date" }]);
  assert.doesNotMatch(xml, /<lastmod>/u);
});

test("정적 sitemap은 ko·ja URL과 hreflang alternate를 함께 담는다", () => {
  const xml = buildStaticSitemap();
  for (const path of PUBLIC_SITEMAP_STATIC_PATHS) {
    const suffix = path === "/" ? "/" : path;
    assert.match(xml, new RegExp(`<loc>https://yoro\\.gg/ko${suffix}</loc>`, "u"), `ko${path}`);
    assert.match(xml, new RegExp(`<loc>https://yoro\\.gg/ja${suffix}</loc>`, "u"), `ja${path}`);
  }
  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/u);
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="x-default"/u);
  // 색인 가치가 없는 경로는 넣지 않습니다.
  assert.doesNotMatch(xml, /\/privacy|\/terms|\/contact|\/palworld\/search|\/valorant|\/community/u);
  assert.doesNotMatch(xml, /<loc>[^<]*\?/u);
});

test("행동·개인화·법적 고지 화면은 noindex로 제공한다", () => {
  for (const pathname of [
    "/login",
    "/account",
    "/account/connections",
    "/follow",
    "/participation",
    "/privacy",
    "/terms",
    "/contact",
    "/palworld/search",
  ]) {
    assert.equal(publicSeoMetadataForPath(pathname).robotsNoindex, true, pathname);
  }
});

test("엔티티 sitemap은 ko·ja 두 URL을 만든다", () => {
  const xml = buildPalworldEntitySitemap("pal", ["lamball", "cattiva"], "2026-08-01T00:00:00.000Z");
  assert.match(xml, /<loc>https:\/\/yoro\.gg\/ko\/palworld\/pals\/lamball<\/loc>/u);
  assert.match(xml, /<loc>https:\/\/yoro\.gg\/ja\/palworld\/pals\/cattiva<\/loc>/u);
  assert.equal((xml.match(/<url>/gu) ?? []).length, 4);
});

test("robotsNoindex metadata는 noindex 메타를 주입하고, 기본 페이지는 주입하지 않는다", () => {
  const metadata = publicSeoMetadataForPath("/ko/lol/summoners/kr/Unknown-XX99");
  // 기본 metadata에는 noindex가 없어야 합니다(캐시 존재 여부는 라우트 계층 판단).
  const indexed = applyPublicSeoMetadata(APP_SHELL, metadata);
  assert.doesNotMatch(indexed, /name="robots"/u);

  const blocked = applyPublicSeoMetadata(APP_SHELL, { ...metadata, robotsNoindex: true });
  assert.match(blocked, /<meta name="robots" content="noindex" \/>/u);
  // strip이 동작해 재적용해도 중복되지 않습니다.
  const reapplied = applyPublicSeoMetadata(blocked, { ...metadata, robotsNoindex: true });
  assert.equal((reapplied.match(/name="robots"/gu) ?? []).length, 1);
});

test("fallback 링크와 breadcrumb은 라우트가 없는 /lol/summoners 목록을 가리키지 않는다", () => {
  // /lol 페이지의 sibling 링크에 404인 소환사 목록이 섞이면 크롤러에게 깨진
  // 내부 링크를 제공하게 됩니다.
  const lolHtml = render("/ko/lol");
  assert.doesNotMatch(lolHtml, /href="\/ko\/lol\/summoners"/u);

  // 소환사 상세 breadcrumb JSON-LD에도 목록 URL이 없어야 합니다.
  const profileHtml = render("/ko/lol/summoners/kr/Seiga-KR1");
  assert.doesNotMatch(profileHtml, /yoro\.gg\/ko\/lol\/summoners"/u);
});

test("소셜 이미지는 게임별 경로 접두사로 매핑되고 그 외에는 범용 이미지를 유지한다", () => {
  /* 회귀 고정 — 전 페이지가 범용 이미지 1장을 공유하면 X(제목·설명 미표시)에서
     어떤 페이지를 공유해도 동일하게 보입니다. docs/mockups/sns-link-previews.html §02. */
  const image = (pathname) => publicSeoMetadataForPath(pathname).imageUrl;
  assert.equal(image("/palworld"), "https://yoro.gg/images/yorogg-og-palworld.png");
  assert.equal(image("/ja/palworld/breeding"), "https://yoro.gg/images/yorogg-og-palworld.png");
  assert.equal(image("/minecraft"), "https://yoro.gg/images/yorogg-og-minecraft.png");
  assert.equal(image("/ko/minecraft/recipes"), "https://yoro.gg/images/yorogg-og-minecraft.png");
  assert.equal(image("/valorant/agents"), "https://yoro.gg/images/yorogg-og-valorant.png");
  assert.equal(image("/bot/commands"), "https://yoro.gg/images/yorogg-og-bot.png");
  /* LoL 생태와 홈은 LoL 이미지를 사이트 대표로 겸용합니다. */
  for (const path of ["/", "/lol", "/lol/aram", "/patch-notes", "/follow", "/participation"]) {
    assert.equal(image(path), "https://yoro.gg/images/yorogg-og-lol.png", path);
  }
  /* 게임 외 화면은 기존 범용 이미지 유지 — 접두사 오탐(/bottle 류)도 범용으로. */
  for (const path of ["/privacy", "/terms", "/contact", "/bottle"]) {
    assert.equal(image(path), "https://yoro.gg/images/yorogg-og.png", path);
  }
  /* imageAlt 는 게임·locale 별 문구를 씁니다. */
  assert.match(publicSeoMetadataForPath("/minecraft").imageAlt, /마인크래프트/u);
  assert.match(publicSeoMetadataForPath("/ja/minecraft").imageAlt, /マインクラフト/u);

  /* Palworld 엔티티 상세도 팰월드 이미지를 씁니다. */
  const route = palworldEntityRouteForPath("/palworld/pals/anubis");
  const metadata = palworldEntitySeoMetadata(route, { id: "anubis", nameKo: "아누비스", nameEn: "Anubis" });
  assert.equal(metadata.imageUrl, "https://yoro.gg/images/yorogg-og-palworld.png");
});
