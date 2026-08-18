import test from "node:test";
import assert from "node:assert/strict";

const {
  applyPublicSeoMetadata,
  palworldEntityPath,
  palworldEntityRedirectPath,
  palworldEntityRouteForPath,
  palworldEntitySeoMetadata,
  publicSeoMetadataForPath,
  palworldBreedingFallback,
  reactionShareRouteForPath,
  reactionShareSeoMetadata,
} = await import("../dist/routes/public-seo.js");
const {
  PUBLIC_SITEMAP_STATIC_PATHS,
  buildLocalizedUrlSetSitemap,
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

test("팰월드는 ko·ja·en·x-default hreflang을 상호 참조로 노출한다", () => {
  /* 영어 본문이 있는 섹션이라 en 까지 4종입니다. x-default 는 "언어가 맞지 않는
     방문자에게 보일 판"이므로 영어판이 있으면 en 이 그 자리를 맡습니다. */
  const html = render("/ja/palworld/pals");
  assert.match(html, /<link rel="alternate" hreflang="ko" href="https:\/\/yoro\.gg\/ko\/palworld\/pals" \/>/u);
  assert.match(html, /<link rel="alternate" hreflang="ja" href="https:\/\/yoro\.gg\/ja\/palworld\/pals" \/>/u);
  assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/yoro\.gg\/en\/palworld\/pals" \/>/u);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/yoro\.gg\/en\/palworld\/pals" \/>/u);
  assert.match(html, /<link rel="canonical" href="https:\/\/yoro\.gg\/ja\/palworld\/pals">/u);
  assert.match(html, /<html lang="ja"/u);
});

test("영어 본문이 없는 섹션에는 en hreflang을 붙이지 않는다", () => {
  /* 없는 페이지를 크롤러에게 약속하지 않기 위해서입니다. LoL 은 ko·ja 만 있습니다. */
  const html = render("/ko/lol");
  assert.match(html, /<link rel="alternate" hreflang="ko" href="https:\/\/yoro\.gg\/ko\/lol" \/>/u);
  assert.match(html, /<link rel="alternate" hreflang="ja" href="https:\/\/yoro\.gg\/ja\/lol" \/>/u);
  assert.doesNotMatch(html, /hreflang="en"/u);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/yoro\.gg\/ko\/lol" \/>/u);
});

test("팰월드 /en 은 영어 메타와 자기 canonical 을 낸다", () => {
  const html = render("/en/palworld/pals");
  assert.match(html, /<html lang="en"/u);
  assert.match(html, /<title>Paldeck \| Palworld \| YORO\.gg<\/title>/u);
  assert.match(html, /<link rel="canonical" href="https:\/\/yoro\.gg\/en\/palworld\/pals">/u);
  assert.match(html, /<meta property="og:locale" content="en_US" \/>/u);
  /* 본문 링크도 en 판으로 이어져야 크롤 경로가 en 안에서 닫힙니다. */
  assert.match(html, /<a href="\/en\/palworld\/breeding">Breeding pairs<\/a>/u);
});

test("영어 본문이 없는 섹션의 /en 은 ko 메타로 접히고 canonical 도 /ko 를 가리킨다", () => {
  /* 번역이 없는 화면을 en 으로 색인시키면 중복 페이지가 늘어납니다. 동작은 그대로
     두고 색인만 ko 한 판으로 모읍니다. */
  const html = render("/en/lol");
  assert.match(html, /<html lang="ko"/u);
  assert.match(html, /<link rel="canonical" href="https:\/\/yoro\.gg\/ko\/lol">/u);
  assert.doesNotMatch(html, /hreflang="en"/u);
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

test("영어 엔티티 metadata는 영문 이름·설명과 영어 본문을 사용한다", () => {
  const metadata = palworldEntitySeoMetadata(
    { id: "lamball", kind: "pal", locale: "en" },
    {
      id: "lamball",
      nameKo: "도로롱",
      nameJa: "モコロン",
      nameEn: "Lamball",
      number: 1,
      elements: ["neutral"],
      stats: { hp: 70, attack: 70 },
      workSuitabilities: [{ type: "handiwork", level: 1 }],
    },
  );
  /* 이름이 곧 영문이라 제목에 "이름(영문)" 을 겹쳐 쓰지 않습니다. */
  assert.equal(metadata.title, "Lamball Stats & Breeding | Palworld | YORO.gg");
  assert.equal(metadata.canonicalUrl, "https://yoro.gg/en/palworld/pals/lamball");
  assert.equal(metadata.alternateUrls.en, "https://yoro.gg/en/palworld/pals/lamball");
  assert.equal(metadata.fallback.heading, "Lamball");

  const html = applyPublicSeoMetadata(APP_SHELL, metadata);
  assert.match(html, /<html lang="en"/u);
  assert.match(html, /<dt>Paldeck no\.<\/dt><dd>No\.1<\/dd>/u);
  assert.match(html, /<h2>Base stats<\/h2>/u);
  assert.match(html, /<dt>Attack<\/dt><dd>70<\/dd>/u);
  assert.match(html, /Handiwork Lv\.1/u);
  assert.match(html, /<a href="\/en\/palworld\/breeding">View breeding pairs<\/a>/u);
  /* 영문 이름 fact 는 en 판에서 제목과 같은 값이라 내지 않습니다. */
  assert.doesNotMatch(html, /English name/u);
});

test("영어 엔티티는 descriptionEn 이 있으면 그 문장을 요약으로 쓴다", () => {
  const metadata = palworldEntitySeoMetadata(
    { id: "foxparks", kind: "pal", locale: "en" },
    { id: "foxparks", nameEn: "Foxparks", descriptionEn: "A fiery fox that can be used as a flamethrower." },
  );
  assert.equal(metadata.description, "A fiery fox that can be used as a flamethrower.");
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

test("엔티티 sitemap은 팰월드 3개 로케일 URL을 만든다", () => {
  const xml = buildPalworldEntitySitemap("pal", ["lamball", "cattiva"], "2026-08-01T00:00:00.000Z");
  assert.match(xml, /<loc>https:\/\/yoro\.gg\/ko\/palworld\/pals\/lamball<\/loc>/u);
  assert.match(xml, /<loc>https:\/\/yoro\.gg\/ja\/palworld\/pals\/cattiva<\/loc>/u);
  assert.match(xml, /<loc>https:\/\/yoro\.gg\/en\/palworld\/pals\/lamball<\/loc>/u);
  assert.equal((xml.match(/<url>/gu) ?? []).length, 6);
  /* head 의 hreflang 과 같은 규칙 — 영어판이 있으면 x-default 도 en 입니다. */
  assert.match(xml, /hreflang="x-default" href="https:\/\/yoro\.gg\/en\/palworld\/pals\/lamball"/u);
});

test("정적 sitemap 은 영어 본문이 없는 경로에 en URL 을 제출하지 않는다", () => {
  const xml = buildLocalizedUrlSetSitemap([{ path: "/lol" }, { path: "/palworld" }]);
  assert.doesNotMatch(xml, /<loc>https:\/\/yoro\.gg\/en\/lol<\/loc>/u);
  assert.match(xml, /<loc>https:\/\/yoro\.gg\/en\/palworld<\/loc>/u);
  assert.equal((xml.match(/<url>/gu) ?? []).length, 5);
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

test("미니게임 경로는 전용 OG 이미지·metadata·breadcrumb·sitemap을 제공한다", () => {
  const hubKo = render("/ko/games");
  const reactionJa = render("/ja/games/reaction");

  /* title·description — 문구 원본은 features/public-games/i18n/games-i18n.ts 입니다. */
  assert.match(hubKo, /<title>미니게임 \| YORO\.gg<\/title>/u);
  assert.match(hubKo, /<meta name="description" content="게이머 반사신경 훈련장[^"]*">/u);
  assert.match(reactionJa, /<title>反応速度テスト \| YORO\.gg<\/title>/u);
  assert.match(reactionJa, /<meta name="description" content="緑の信号にできるだけ早く[^"]*">/u);
  assert.match(reactionJa, /<html lang="ja"/u);

  /* OG 이미지 — prefix 매칭이라 하위 경로까지 커버하되, 이미지에 문구가 박혀 있어
     ja 경로에는 ja 판을 내립니다(ja 링크가 한국어 이미지로 보이던 실사례). */
  assert.match(hubKo, /<meta property="og:image" content="https:\/\/yoro\.gg\/images\/yorogg-og-games\.png" \/>/u);
  assert.match(reactionJa, /<meta property="og:image" content="https:\/\/yoro\.gg\/images\/yorogg-og-games-ja\.png" \/>/u);
  assert.match(hubKo, /<meta property="og:image:alt" content="YORO\.gg 미니게임 미리보기" \/>/u);
  assert.match(reactionJa, /<meta property="og:image:alt" content="YORO\.gg ミニゲームのプレビュー" \/>/u);

  /* 콘텐츠 페이지이므로 색인 대상입니다(noindex 금지). */
  assert.doesNotMatch(hubKo, /name="robots" content="noindex"/u);
  assert.doesNotMatch(reactionJa, /name="robots" content="noindex"/u);

  /* hreflang — 지역화 라우트로 등록돼야 상호 참조가 붙습니다. */
  assert.match(hubKo, /<link rel="alternate" hreflang="ja" href="https:\/\/yoro\.gg\/ja\/games" \/>/u);
  assert.match(reactionJa, /<link rel="alternate" hreflang="ko" href="https:\/\/yoro\.gg\/ko\/games\/reaction" \/>/u);

  /* breadcrumb — 홈 > 미니게임 > 반응속도 테스트 */
  const script = /<script type="application\/ld\+json"[^>]*>(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList[\s\S]*?)<\/script>/u
    .exec(render("/ko/games/reaction"));
  assert.ok(script, "BreadcrumbList JSON-LD가 있어야 합니다");
  const breadcrumb = JSON.parse(script[1]);
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.item),
    ["https://yoro.gg/ko/", "https://yoro.gg/ko/games", "https://yoro.gg/ko/games/reaction"],
  );
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.name),
    ["YORO.gg", "미니게임", "반응속도 테스트"],
  );

  /* sitemap — live 인 게임만. 준비 중(시각반응)은 라우트가 없어 넣지 않습니다. */
  assert.ok(PUBLIC_SITEMAP_STATIC_PATHS.includes("/games"));
  assert.ok(PUBLIC_SITEMAP_STATIC_PATHS.includes("/games/reaction"));
  assert.ok(!PUBLIC_SITEMAP_STATIC_PATHS.includes("/games/visual"));
  const sitemap = buildStaticSitemap();
  assert.match(sitemap, /https:\/\/yoro\.gg\/ko\/games<\/loc>/u);
  assert.match(sitemap, /https:\/\/yoro\.gg\/ja\/games\/reaction<\/loc>/u);
});

test("팰 상세 fallback 본문에 능력치·작업 적성·교배 조합 실데이터가 담긴다", () => {
  /* 외부 SEO 리뷰(2026-08-18): 롱테일 데이터 사이트인데 크롤러가 읽을 본문이
     142자뿐이었습니다. 값은 전부 화면 카드에 이미 있는 것과 같습니다(cloaking 금지). */
  const entity = {
    id: "anubis",
    number: 139,
    nameKo: "아누비스",
    nameJa: "アヌビス",
    nameEn: "Anubis",
    elements: ["ground"],
    rarity: 10,
    descriptionKo: "설명",
    descriptionJa: "説明",
    stats: { hp: 120, attack: 130, defense: 100, moveSpeed: 800, stamina: 100 },
    workSuitabilities: [{ type: "handiwork", level: 6 }, { type: "mining", level: 6 }],
    drops: [{ nameKo: "뼈", nameJa: "骨", nameEn: "Bone" }],
    partnerSkillName: "사막의 수호신",
    breedingParents: [{ a: "셸가드라", b: "무라사메" }],
    breedingParentsTotal: 234,
    breedingChildren: [{ partner: "펭키", child: "아누비스" }],
    breedingChildrenTotal: 287
  };

  const ko = palworldEntitySeoMetadata({ id: "anubis", kind: "pal", locale: "ko" }, entity);
  const headings = (ko.fallback?.sections ?? []).map((section) => section.heading);
  assert.deepEqual(headings, [
    "능력치", "작업 적성", "파트너 스킬", "드랍 아이템",
    "이 팰이 나오는 교배 조합", "이 팰을 부모로 한 교배"
  ]);
  const stats = ko.fallback.sections[0];
  assert.deepEqual(stats.facts.map((fact) => `${fact.label}=${fact.value}`), [
    "HP=120", "공격=130", "방어=100", "이동 속도=800", "스태미나=100"
  ]);
  assert.deepEqual(ko.fallback.sections[1].items, ["수작업 Lv.6", "채굴 Lv.6"]);
  assert.deepEqual(ko.fallback.sections[4].items, ["셸가드라 × 무라사메"]);
  /* 상한으로 잘린 경우 전체 개수를 실값으로 알립니다. */
  assert.equal(ko.fallback.sections[4].note, "전체 234개 조합");

  const ja = palworldEntitySeoMetadata({ id: "anubis", kind: "pal", locale: "ja" }, entity);
  assert.deepEqual((ja.fallback?.sections ?? []).map((section) => section.heading), [
    "ステータス", "作業適性", "パートナースキル", "ドロップ",
    "この個体が生まれる配合", "この個体を親にした配合"
  ]);
  assert.equal(ja.fallback.sections[1].items[0], "手作業 Lv.6");

  /* 데이터가 없으면 섹션 없이 기존 요약만 — 빈 페이지가 되지 않습니다. */
  const bare = palworldEntitySeoMetadata(
    { id: "anubis", kind: "pal", locale: "ko" },
    { id: "anubis", nameKo: "아누비스", descriptionKo: "설명" }
  );
  assert.equal(bare.fallback?.sections, undefined);
  assert.ok(bare.fallback?.heading);
  assert.ok(bare.fallback?.summary);
});

test("팰 상세 fallback 은 HTML 로 렌더될 때 실데이터 문자열을 포함한다", () => {
  const html = render("/ko/palworld/pals/anubis");
  /* 데이터 서비스가 없는 테스트 핸들러라 섹션은 없지만, 본문 골격과 제목은 남습니다. */
  assert.match(html, /data-seo-fallback="true"/u);
});

test("교배 페이지 fallback 은 시스템 요약과 팰 상세 내부 링크를 낸다", () => {
  const base = {
    facts: [],
    heading: "교배 조합",
    summary: "요약",
    links: [{ href: "/ko/palworld", label: "팰월드" }]
  };
  const pals = [{ id: "lamball", name: "도로롱" }, { id: "anubis", name: "아누비스" }];

  const ko = palworldBreedingFallback(base, "ko", pals, 574);
  assert.equal(ko.sections.length, 2);
  assert.equal(ko.sections[0].heading, "교배 시스템");
  assert.equal(ko.sections[1].heading, "팰별 교배 조합");
  assert.deepEqual(ko.sections[1].links, [
    { href: "/ko/palworld/pals/lamball", label: "도로롱" },
    { href: "/ko/palworld/pals/anubis", label: "아누비스" }
  ]);
  assert.equal(ko.sections[1].note, "전체 574종의 팰");

  const ja = palworldBreedingFallback(base, "ja", pals, 574);
  assert.equal(ja.sections[0].heading, "配合の仕組み");
  assert.equal(ja.sections[1].links[0].href, "/ja/palworld/pals/lamball");

  /* 스냅샷이 없으면 원본 그대로(빈 페이지 금지). */
  assert.deepEqual(palworldBreedingFallback(base, "ko", [], 0), base);
});

test("홈 title 은 무엇을 하는 사이트인지 담는다", () => {
  const ko = render("/ko/");
  const ja = render("/ja/");
  assert.match(ko, /<title>YORO\.gg — LoL 전적 검색·팰월드 데이터베이스<\/title>/u);
  assert.match(ko, /<meta property="og:title" content="YORO\.gg — LoL 전적 검색·팰월드 데이터베이스">/u);
  assert.match(ja, /<title>YORO\.gg — LoL戦績検索・パルワールドデータベース<\/title>/u);
});

test("팰월드 데이터베이스 표기는 '팰월드' 로 통일돼 있다", () => {
  const html = render("/ko/palworld");
  assert.match(html, /팰월드 데이터베이스/u);
  assert.doesNotMatch(html, /펠월드/u, "'펠월드' 오표기가 남아 있으면 안 됩니다");
});

test("아이템 상세 fallback 은 제작·획득·드랍 팰을 본문에 담는다", () => {
  const entity = {
    id: "bone",
    nameKo: "뼈",
    nameJa: "骨",
    nameEn: "Bone",
    rarity: 0,
    descriptionKo: "팰에게서 얻는 뼈.",
    descriptionJa: "パルから採れる骨。",
    sellPrice: 200,
    weight: 0,
    maxStack: 9999,
    technologyLevel: 34,
    craftingMaterials: [{ name: "제련 주괴", count: 30 }],
    craftingFacilities: ["상급 작업대"],
    acquisitionLabels: ["Pal 드롭 데이터에 포함"],
    dropPals: [{ id: "anubis", name: "아누비스" }],
    dropPalsTotal: 23
  };

  const ko = palworldEntitySeoMetadata({ id: "bone", kind: "item", locale: "ko" }, entity);
  assert.deepEqual((ko.fallback?.sections ?? []).map((section) => section.heading), [
    "기본 정보", "제작 재료", "제작 시설", "획득 방법", "드랍하는 팰"
  ]);
  assert.deepEqual(ko.fallback.sections[0].facts.map((fact) => `${fact.label}=${fact.value}`), [
    "판매가=200", "무게=0", "최대 보유=9999", "기술 레벨=34"
  ]);
  assert.deepEqual(ko.fallback.sections[1].items, ["제련 주괴 ×30"]);
  /* 드랍 팰은 팰 상세로 이어지는 내부 링크라 크롤 경로도 겸합니다. */
  assert.deepEqual(ko.fallback.sections[4].links, [
    { href: "/ko/palworld/pals/anubis", label: "아누비스" }
  ]);
  assert.equal(ko.fallback.sections[4].note, "전체 23종의 팰");

  const ja = palworldEntitySeoMetadata({ id: "bone", kind: "item", locale: "ja" }, entity);
  assert.deepEqual((ja.fallback?.sections ?? []).map((section) => section.heading), [
    "基本情報", "製作素材", "製作施設", "入手方法", "ドロップするパル"
  ]);
  assert.equal(ja.fallback.sections[4].links[0].href, "/ja/palworld/pals/anubis");

  /* 데이터가 없으면 섹션 없이 요약만 남습니다. */
  const bare = palworldEntitySeoMetadata(
    { id: "bone", kind: "item", locale: "ko" },
    { id: "bone", nameKo: "뼈", descriptionKo: "설명" }
  );
  assert.equal(bare.fallback?.sections, undefined);
});

test("스킬 상세 fallback 은 기본 정보와 보유 팰을 담고 종류를 두 번 내지 않는다", () => {
  const entity = {
    id: "frost",
    nameKo: "프로스트 아웃",
    nameJa: "フロストアウト",
    nameEn: "Absolute Frost",
    type: "active",
    descriptionKo: "얼음 기둥을 뻗어낸다.",
    descriptionJa: "氷柱を伸ばす。",
    skillType: "active",
    element: "ice",
    power: 700,
    relatedPals: [{ id: "univolt-cryst", name: "레이콘" }],
    relatedPalsTotal: 1
  };

  const ko = palworldEntitySeoMetadata({ id: "frost", kind: "skill", locale: "ko" }, entity);
  assert.deepEqual((ko.fallback?.sections ?? []).map((section) => section.heading), [
    "기본 정보", "이 스킬을 가진 팰"
  ]);
  assert.deepEqual(ko.fallback.sections[0].facts.map((fact) => `${fact.label}=${fact.value}`), [
    "종류=액티브 스킬", "속성=ice", "위력=700"
  ]);
  assert.deepEqual(ko.fallback.sections[1].links, [
    { href: "/ko/palworld/pals/univolt-cryst", label: "레이콘" }
  ]);

  /* 상단 facts 에 원시값("active")이 다시 나오면 안 됩니다. */
  const topFactLabels = (ko.fallback?.facts ?? []).map((fact) => fact.label);
  assert.ok(!topFactLabels.includes("종류"), "종류는 기본 정보 섹션에만 나옵니다");

  const ja = palworldEntitySeoMetadata({ id: "frost", kind: "skill", locale: "ja" }, entity);
  assert.equal(ja.fallback.sections[0].facts[0].value, "アクティブスキル");

  /* 팰과 아이템은 상단 종류 fact 를 그대로 유지합니다(회귀 방지). */
  const item = palworldEntitySeoMetadata(
    { id: "bone", kind: "item", locale: "ko" },
    { id: "bone", nameKo: "뼈", descriptionKo: "설명", type: "material" }
  );
  assert.ok((item.fallback?.facts ?? []).some((fact) => fact.label === "종류"));
});

test("en 프리픽스 공유 링크는 ko 판으로 접힌다", () => {
  /* 미니게임은 ko·ja 만 있습니다. /en 을 그대로 두면 한국어 문구가 담긴 페이지가
     자기 canonical 로 하나 더 색인됩니다. */
  const route = reactionShareRouteForPath("/en/games/reaction/r/abcd1234efgh");
  assert.equal(route.locale, "ko");
  const metadata = reactionShareSeoMetadata(route, {
    averageMs: 187, tierKey: "master", tierEmoji: "🟣", tierLabel: "마스터",
  });
  assert.equal(metadata.canonicalUrl, "https://yoro.gg/ko/games/reaction/r/abcd1234efgh");
});
