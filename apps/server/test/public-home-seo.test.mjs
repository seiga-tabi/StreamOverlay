import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* 새 공개 화면(루트 홈 · LoL 홈 · LoL 스트리머)의 서버 렌더 메타.
 *
 * 화면(PublicHomePage)은 뜨자마자 title·description·canonical 을 자기 값으로
 * 덮어씁니다. 서버가 크롤러에게 먼저 주는 값이 그와 다르면, 공유 카드와 초기
 * HTML 에는 옛 문구가 남고 렌더 후에는 다른 문구가 됩니다.
 *
 * 그래서 문구를 두 곳에 복제하되 여기서 대조합니다 — 대시보드 원본을 소스 텍스트로
 * 읽어 서버 값과 맞는지 봅니다. 한쪽만 고치면 이 테스트가 먼저 깨집니다.
 */

const { publicSeoMetadataForPath } = await import("../dist/routes/public-seo.js");
const { createHttpHandler } = await import("../dist/routes/http-api.js");

/* 화면 문구의 단일 원본. 서버는 대시보드 코드를 import 할 수 없어 문구를 복제하므로,
   원본을 소스 텍스트로 읽어 대조합니다. */
const I18N_MODULES = {
  home: "home-i18n.ts",
  lolHome: "lol-home-i18n.ts",
  lolStreamers: "lol-streamers-i18n.ts"
};

function i18nSource(module) {
  return readFileSync(
    fileURLToPath(new URL(`../../dashboard/src/features/public-home/i18n/${module}`, import.meta.url)),
    "utf8"
  );
}

/** i18n 모듈의 로케일 블록에서 seoTitle·seoDescription 을 그대로 꺼냅니다. */
function seoCopy(module, locale) {
  const source = i18nSource(module);
  const block = new RegExp(`\\n  ${locale}: \\{([\\s\\S]*?)\\n  \\}`, "u").exec(source);
  assert.ok(block, `${module} 의 ${locale} 블록을 찾지 못했습니다 — 구조가 바뀌었습니다`);
  const read = (key) => {
    const found = new RegExp(`\\n    ${key}: "((?:[^"\\\\]|\\\\.)*)"`, "u").exec(block[1]);
    assert.ok(found, `${module} 의 ${locale}.${key} 를 찾지 못했습니다`);
    return found[1].replace(/\\"/gu, '"');
  };
  return { title: read("seoTitle"), description: read("seoDescription") };
}

function homeSeoCopy(locale) {
  return seoCopy(I18N_MODULES.home, locale);
}

test("루트 메타는 화면이 덮어쓸 문구와 같다", () => {
  for (const [locale, pathname] of [["ko", "/ko/"], ["ja", "/ja/"], ["en", "/en/"]]) {
    const copy = homeSeoCopy(locale);
    const metadata = publicSeoMetadataForPath(pathname);
    assert.equal(metadata.title, copy.title, pathname);
    assert.equal(metadata.description, copy.description, pathname);
    /* 크롤러가 JS 없이 읽는 본문도 같은 화면을 설명해야 합니다. */
    assert.equal(metadata.fallback.heading, copy.title, pathname);
    assert.equal(metadata.fallback.summary, copy.description, pathname);
  }

  /* 프리픽스 없는 루트의 서버 SEO 기본값은 영어입니다. */
  const bare = publicSeoMetadataForPath("/");
  assert.equal(bare.title, homeSeoCopy("en").title);
  assert.equal(bare.locale, "en");
  assert.equal(bare.canonicalUrl, "https://yoro.gg/en/");
});

/* 화면마다 경로와 원본 모듈이 다릅니다. 새 화면을 만들면 여기 한 줄만 늘립니다. */
const SCREENS = [
  { name: "루트 홈", path: "", module: I18N_MODULES.home },
  { name: "LoL 홈", path: "/lol", module: I18N_MODULES.lolHome },
  { name: "LoL 스트리머", path: "/follow", module: I18N_MODULES.lolStreamers }
];

test("새 화면의 서버 메타는 모두 화면이 덮어쓸 문구와 같다", () => {
  for (const screen of SCREENS) {
    for (const locale of ["ko", "ja", "en"]) {
      const copy = seoCopy(screen.module, locale);
      const pathname = `/${locale}${screen.path || "/"}`;
      const metadata = publicSeoMetadataForPath(pathname);
      assert.equal(metadata.title, copy.title, `${screen.name} ${pathname}`);
      assert.equal(metadata.description, copy.description, `${screen.name} ${pathname}`);
      /* 화면이 영어를 그리는데 서버가 ko 라고 말하면 크롤러는 영어판을 한국어의
         중복으로 보고 색인에서 뺍니다. */
      assert.equal(metadata.locale, locale, `${screen.name} ${pathname}`);
    }
  }
});

test("/en/ 은 영어로 서빙하고 canonical 도 /en/ 이다", () => {
  /* 화면은 /en/ 에서 영어를 그립니다. 서버가 ko 라고 말하면 크롤러는 영어 페이지를
     한국어의 중복으로 보고 색인에서 뺍니다(고치기 전 실제 상태였습니다). */
  const metadata = publicSeoMetadataForPath("/en/");
  assert.equal(metadata.locale, "en");
  assert.equal(metadata.canonicalUrl, "https://yoro.gg/en/");
});

test("루트는 세 로케일을 서로 참조한다", () => {
  const metadata = publicSeoMetadataForPath("/");
  assert.deepEqual(metadata.alternateUrls, {
    ko: "https://yoro.gg/ko/",
    ja: "https://yoro.gg/ja/",
    en: "https://yoro.gg/en/"
  });
});

test("루트는 색인 대상이고 sitemap 에 남는다", async () => {
  const { PUBLIC_SITEMAP_STATIC_PATHS } = await import("../dist/routes/public-sitemap.js");
  assert.ok(PUBLIC_SITEMAP_STATIC_PATHS.includes("/"), "루트는 전용 홈이므로 sitemap 에 있어야 합니다");
  assert.ok(PUBLIC_SITEMAP_STATIC_PATHS.includes("/lol"), "LoL 홈은 별개 화면으로 남습니다");
  assert.notEqual(publicSeoMetadataForPath("/").robotsNoindex, true);
});

test("홈이 쓰는 웹폰트를 CSP 가 막지 않는다", async () => {
  /* 이 문제는 프로덕션에서만 드러납니다 — 시각 회귀는 vite preview 로 도는데
     그쪽은 이 헤더를 보내지 않아, 로컬에서는 글꼴이 멀쩡히 보입니다.
     열기 전 실제 상태: stylesheet 는 style-src 에, 글꼴 파일은 default-src 'self'
     에 걸려 둘 다 차단됐습니다(명조 헤드라인과 붓글씨 마크가 시스템 글꼴로 떨어짐). */
  const handler = createHttpHandler({ store: {}, twitchAuth: {}, actions: { async dispatchOne() {} } });
  const res = {
    statusCode: 0,
    headers: {},
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers ?? {};
    },
    end() {}
  };
  await handler(
    { method: "GET", url: "/ko/", headers: { host: "yoro.gg" }, async *[Symbol.asyncIterator]() {} },
    res
  );
  const csp = String(res.headers["Content-Security-Policy"] ?? "");
  const directive = (name) => csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

  assert.ok(directive("style-src").includes("https://fonts.googleapis.com"), csp);
  assert.ok(directive("font-src").includes("https://fonts.gstatic.com"), csp);

  /* 호스트를 정확히 열어야 합니다 — https: 전체를 열면 임의의 외부 stylesheet 와
     글꼴이 들어옵니다. */
  assert.doesNotMatch(directive("style-src"), /\shttps:(\s|$)/u);
  assert.doesNotMatch(directive("font-src"), /\shttps:(\s|$)/u);
});
