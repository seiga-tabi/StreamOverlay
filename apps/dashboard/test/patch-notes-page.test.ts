import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parsePatchNote, parsePatchNotesFeed, parsePatchPlaySummary } from "@streamops/shared";

const page = await readFile(
  new URL("../src/features/public-lol/pages/PublicPatchNotesPage.tsx", import.meta.url),
  "utf8"
);
const api = await readFile(
  new URL("../src/features/public-lol/api/patch-notes.ts", import.meta.url),
  "utf8"
);
const css = await readFile(
  new URL("../src/styles/pages/public-lol/35-patch-notes.css", import.meta.url),
  "utf8"
);
const i18n = await readFile(
  new URL("../src/features/public-lol/i18n/public-lol-i18n.ts", import.meta.url),
  "utf8"
);
const mineModule = await readFile(
  new URL("../src/features/public-lol/components/PatchNotesMineModule.tsx", import.meta.url),
  "utf8"
);
const bar = await readFile(
  new URL("../src/features/public-lol/components/PatchNotesControlBar.tsx", import.meta.url),
  "utf8"
);
const headerMenu = await readFile(
  new URL("../src/features/public-lol/components/PublicHeaderMenu.tsx", import.meta.url),
  "utf8"
);
const stylesIndex = await readFile(
  new URL("../src/styles/index.css", import.meta.url),
  "utf8"
);

test("응답은 화면이 쓰기 전에 shared parser를 한 번 더 통과한다", () => {
  // 서버가 이미 검증하지만, 검증되지 않은 값으로 링크와 이미지를 만들지 않습니다.
  assert.match(api, /parsePatchNotesFeed\(await response\.json\(\)\)/u);
  // Riot 은 ko-kr·ja-jp 를 따로 서비스합니다. 언어는 호출 시점의 전역이 아니라 인자로 받습니다.
  assert.match(api, /export async function requestPatchNotes\(\s*locale: PatchNoteLocale/u);
  assert.match(api, /locale=\$\{locale === "ja" \? "ja" : "ko"\}/u);
  // 요청한 언어와 다른 목록이 오면 화면에 올리지 않습니다.
  assert.match(api, /feed\.locale !== locale/u);
  // 언어가 바뀌면 목록을 다시 받아야 합니다.
  assert.match(page, /requestPatchNotes\(feedLocale, controller\.signal\)/u);
  assert.match(page, /\}, \[feedLocale\]\);/u);
});

test("원문 링크는 Riot 도메인만 통과하고 새 창에서 안전하게 열린다", () => {
  assert.match(page, /rel="noopener noreferrer"/u);
  assert.match(page, /target="_blank"/u);
  /* 링크는 파서가 검증한 note.url 에서 로케일 경로 조각만 화면 언어로 바꿉니다
     (패치 노트 보강 §3 — /ko-kr/ ↔ /ja-jp/ ↔ /en-us/). 임의 URL 을 만들지 않습니다. */
  assert.match(page, /href=\{riotLocaleUrl\(note\.url\)\}/u);
  assert.match(page, /RIOT_LOCALE_PATH = \{ ko: "\/ko-kr\/", ja: "\/ja-jp\/", en: "\/en-us\/" \} as const;/u);
  assert.match(page, /url\.replace\(\/\\\/\(\?:ko-kr\|ja-jp\|en-us\)\\\/\/,/u);
  assert.equal(parsePatchNotesFeed({
    schemaVersion: 1,
    locale: "ko",
    fetchedAt: "2026-08-09T00:00:00.000Z",
    stale: false,
    notes: [{
      slug: "a",
      title: "t",
      publishedAt: "2026-08-09T00:00:00.000Z",
      url: "https://evil.example/a"
    }]
  }), undefined);
});

test("본문은 담지 않고 제목·요약·썸네일·링크만 보여 준다", () => {
  // 패치 노트 본문은 Riot 저작물입니다. 화면에 본문 필드가 있으면 안 됩니다.
  assert.equal(/note\.(body|content|richText)/u.test(page), false);
  assert.match(page, /patchNotesAttribution/u);
});

test("legacy !important를 피하는 새 이름만 쓴다", () => {
  // 04-followers.css:671·690 의 `.public-dashboard-shell .yoro-card__{title,description}`
  // !important 는 pages layer 로 이길 수 없습니다.
  assert.equal(page.includes("<CardTitle"), false);
  assert.equal(page.includes("<CardDescription>"), false);
  assert.match(page, /className="yoro-pn-hero-title"/u);
  /* 사이드바 행 제목은 사용성 §2-1-7 에서 sr-only 링크로 접혔습니다 — 행 우측 값이 새 이름. */
  assert.match(page, /className="yoro-pn-row-delta"/u);
  assert.match(page, /className="yoro-pn-tile-sum"/u);
});

test("스타일은 pages layer 안에 있고 !important 를 쓰지 않는다", () => {
  // 주석에는 legacy !important 를 설명하는 문장이 있으므로 규칙만 남기고 봅니다.
  const rules = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.match(css, /^@layer pages \{/u);
  assert.equal(rules.includes("!important"), false);
  assert.match(stylesIndex, /@import "\.\/pages\/public-lol\/35-patch-notes\.css";/u);
  // 존재하지 않는 토큰을 쓰면 fallback 값으로만 동작합니다.
  const tokens = [...rules.matchAll(/var\((--yoro-[a-z0-9-]+)/gu)].map((match) => match[1]);
  for (const token of new Set(tokens)) {
    assert.match(token ?? "", /^--yoro-(color|space|radius|font-size)-/u, `알 수 없는 토큰 ${token}`);
  }
});

test("이미지는 자리를 먼저 잡고 히어로만 먼저 받아온다", () => {
  // 히어로는 첫 화면이라 즉시, 나머지는 lazy 입니다.
  // (행 썸네일 .yoro-pn-row-art 는 폭 0 이라 사용성 §2-1 에서 은퇴했습니다.)
  assert.match(page, /className="yoro-pn-hero-art"[\s\S]{0,140}loading="eager"/u);
  assert.match(page, /className="yoro-pn-tile-art"[\s\S]{0,140}loading="lazy"/u);
  assert.equal(page.includes('className="yoro-pn-row-art"'), false);
  // width/height 를 주지 않으면 이미지가 도착할 때 레이아웃이 밀립니다.
  for (const pair of [/height=\{720\}[\s\S]{0,80}width=\{1280\}/u, /height=\{360\}[\s\S]{0,80}width=\{640\}/u]) {
    assert.match(page, pair);
  }
});

test("카드 전체가 클릭 영역이지만 tab 정지점은 하나다", () => {
  assert.match(css, /\.yoro-pn-link::after \{[\s\S]*position: absolute;[\s\S]*inset: 0;/u);
  assert.match(css, /\.yoro-pn-row:focus-within \{[\s\S]*outline: 2px solid/u);
  // 원문 보기 문구는 장식이라 보조기기에서 제목을 두 번 읽지 않게 합니다.
  assert.match(page, /aria-hidden="true" className="yoro-pn-hero-cta"/u);
});

test("시간 축 장식은 은퇴했고 reduced-motion 을 존중한다", () => {
  /* 축 선(.yoro-pn-list::before)·축 점(.yoro-pn-node)은 폭 0 장식이라 사용성
     §2-1 에서 DOM 째 은퇴했습니다 — 규칙이 다시 살아나면 회귀입니다. */
  const rules = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.equal(/\.yoro-pn-node\s*\{/u.test(rules), false);
  assert.equal(/\.yoro-pn-list::before\s*\{/u.test(rules), false);
  assert.match(css, /@media \(max-width: 52rem\)/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
});

test("히어로·타일·아카이브 세 층으로 나눈다", () => {
  // 섞어쓰기: 최신 1장은 화면, 다음 5장은 포스터, 나머지는 훑어보는 줄.
  assert.match(page, /const FEATURED_TILE_COUNT = 5;/u);
  assert.match(page, /const hero = searching \? undefined : visibleEntries\[0\];/u);
  assert.match(page, /visibleEntries\.slice\(1, 1 \+ FEATURED_TILE_COUNT\)/u);
  assert.match(page, /visibleEntries\.slice\(1 \+ FEATURED_TILE_COUNT\)/u);
  // 검색 중에는 층을 접고 결과만 한 줄로 보여 줍니다.
  assert.match(page, /const searching = trimmedQuery\.length > 0 \|\| filter !== "all";/u);
});

test("패치 색(accentColor)은 화면에 흘리지 않는다", () => {
  /* 2026-08-21 보강 §1 — Riot 썸네일 임의 색이 화면마다 팔레트를 무너뜨려
     accentStyle(--pn-k) 경로를 은퇴시켰습니다. parser 의 #RRGGBB 검증은
     응답 위생을 위해 그대로 두되, UI 는 그 값을 쓰지 않습니다. */
  assert.equal(/function accentStyle/u.test(page), false);
  assert.equal(page.includes('"--pn-k"'), false); // style 객체 키로 주입되지 않음(주석 언급은 허용)
  assert.equal(parsePatchNote({
    slug: "a",
    title: "t",
    publishedAt: "2026-08-09T00:00:00.000Z",
    url: "https://www.leagueoflegends.com/ko-kr/news/a",
    accentColor: "red; background:url(x)"
  }), undefined);
  assert.equal(parsePatchNote({
    slug: "a",
    title: "t",
    publishedAt: "2026-08-09T00:00:00.000Z",
    url: "https://www.leagueoflegends.com/ko-kr/news/a",
    accentColor: "#341a1c"
  })?.accentColor, "#341a1c");
  // CSS 에서도 임의 색 변수(--pn-k)가 완전히 사라졌는지 고정합니다.
  assert.equal(/var\(--pn-k\)/u.test(css), false);
});

test("아카이브는 자체 표면 위에 올린다", async () => {
  /* 수묵 리스킨(2026-08-21): 사설 --pn-surface 는 은퇴했고 표면 규격은
     42-ink-patch-notes.css 의 카드 문법(수묵 surface 토큰)이 소유합니다. */
  const inkCss = await readFile(
    new URL("../src/styles/pages/public-lol/42-ink-patch-notes.css", import.meta.url),
    "utf8",
  );
  assert.match(inkCss, /\.yoro-pn-archive \{[\s\S]{0,240}background: var\(--public-gray-surface\);/u);
  // 사설 팔레트가 되살아나지 않게 고정합니다.
  assert.equal(css.includes("--pn-surface:"), false);
  assert.equal(css.includes("--pn-accent"), false);
});

test("커뮤니티가 있던 nav 자리를 패치 노트가 이어받는다", () => {
  assert.match(headerMenu, /page: "patchNotes"/u);
  assert.match(headerMenu, /publicI18n\.ko\.patchNotesHeaderNav/u);
  assert.match(headerMenu, /publicI18n\.ja\.patchNotesHeaderNav/u);
  // 하단 탭바는 5개를 넘기지 않습니다.
  assert.equal([...headerMenu.matchAll(/^\s{6}icon: "/gmu)].length, 5);
});

test("모든 문구가 한국어와 일본어로 함께 있다", () => {
  const koreanBlock = i18n.slice(i18n.indexOf("ko: {"), i18n.indexOf("ja: {"));
  const japaneseBlock = i18n.slice(i18n.indexOf("ja: {"));
  const keys = [...page.matchAll(/t\(\)\.(patchNotes[A-Za-z]+)/gu)].map((match) => match[1]);
  keys.push(...[...api.matchAll(/t\(\)\.(patchNotes[A-Za-z]+)/gu)].map((match) => match[1]));
  assert.ok(keys.length >= 15, `patchNotes 문구가 ${keys.length}개뿐입니다.`);
  for (const key of new Set(keys)) {
    assert.match(koreanBlock, new RegExp(`\\n    ${key}: "`, "u"), `ko ${key} 없음`);
    assert.match(japaneseBlock, new RegExp(`\\n    ${key}: "`, "u"), `ja ${key} 없음`);
  }
});

test("패치별 내 전적은 저장소를 읽기만 하고 아무것도 새로 쓰지 않는다", () => {
  // 이 화면이 최근 검색을 덮어쓰면 방문자의 검색 이력이 망가집니다.
  assert.match(page, /readRecentSearches|readFavorites/u);
  assert.equal(/saveRecentSearch|writeFavorites|localStorage\.setItem/u.test(page), false);
});

test("노트와 전적은 Data Dragon major.minor 로만 이어진다", () => {
  // 날짜 범위로 추측하면 패치 배포 시각·시간대에 따라 어긋납니다.
  assert.match(page, /patchKeyFromDataDragonVersion\(note\.dataDragonVersion\)/u);
  assert.equal(/publishedAt[\s\S]{0,80}(?:>=|<=)[\s\S]{0,40}patch/u.test(page), false);
});

test("기록이 없는 패치에는 숫자를 만들어 넣지 않는다", () => {
  /* 행 우측은 변화가 있을 때만 %p, 없으면 — 한 글자(사용성 §2-1-4 — 「플레이 없음」 반복 은퇴). */
  assert.match(page, /delta === undefined \? "—" : signed\(delta\)/u);
  assert.equal(page.includes('className="yoro-pn-row-norate"'), false);
  // 표본 수를 밝히지 않으면 20경기 승률이 전체 승률로 읽힙니다. 소환사 칩 안에 답니다.
  assert.match(mineModule, /patchNotesSampleShort\.replace\("\{count\}"/u);
  // 기록이 없으면 표본 문구를 붙이지 않습니다.
  assert.match(mineModule, /sampledMatches !== undefined && sampledMatches > 0/u);
});

test("승/판/승률이 서로 어긋난 응답은 화면에 올리지 않는다", () => {
  assert.match(api, /parsePatchPlaySummary\(await response\.json\(\)\)/u);
  assert.equal(parsePatchPlaySummary({
    schemaVersion: 1,
    gameName: "YORO",
    tagLine: "KR1",
    lolPlatform: "kr",
    sampledMatches: 4,
    fetchedAt: "2026-08-09T00:00:00.000Z",
    patches: [{ patchKey: "16.15", games: 4, wins: 1, winRate: 90 }]
  }), undefined);
});

test("증감은 색만이 아니라 부호로도 말한다", () => {
  // 색만으로 좋고 나쁨을 전하면 색각 이상에서 뜻이 사라집니다.
  assert.match(page, /function signed/u);
  assert.match(page, /value > 0 \? "\+" : ""/u);
  assert.match(css, /\.yoro-pn-delta\[data-tone="good"\] b/u);
  assert.match(css, /\.yoro-pn-delta\[data-tone="bad"\] b/u);
  // 승률도 색만이 아니라 길이와 50% 기준선으로 읽힙니다.
  assert.match(css, /\.yoro-pn-gauge-mid \{/u);
  assert.match(page, /className="yoro-pn-gauge-mid"/u);
});

test("컨트롤 바는 검색·필터·소환사를 한 줄에 둔다", () => {
  // 예전에는 전폭 흰 바 두 개였고, 1440px 에서 Riot ID 와 표본 수 사이가 987px 떨어져 있었습니다.
  assert.match(css, /\.yoro-pn-bar \{[\s\S]*display: flex;/u);
  assert.equal(css.includes(".yoro-pn-mine-bar {"), false);
  assert.equal(css.includes(".yoro-pn-toolbar {"), false);
  assert.equal(page.includes("yoro-pn-toolbar"), false);
  // 결과 수는 입력창 안에 있어야 무엇의 개수인지 붙어 읽힙니다.
  assert.match(bar, /<div className="yoro-pn-bar-search">[\s\S]*yoro-pn-bar-count[\s\S]*<\/div>/u);
});

test("소환사는 아바타 칩과 팝오버 메뉴로 고른다", () => {
  // native select 는 아바타도, 다른 소환사를 찾아 나갈 길도 담지 못했습니다.
  assert.equal(bar.includes("<Select"), false);
  assert.match(mineModule, /aria-haspopup="menu"/u);
  assert.match(mineModule, /role="menuitemradio"/u);
  assert.match(mineModule, /aria-checked=\{index === targetIndex\}/u);
  // 저장돼 있던 프로필 아이콘을 씁니다. 새로 받아오지 않습니다.
  assert.match(page, /item\.profileIconUrl \? \{ profileIconUrl: item\.profileIconUrl \} : \{\}/u);
  assert.match(mineModule, /target\.profileIconUrl \?/u);
});

test("메뉴는 Escape 와 바깥 클릭으로 닫히고 초점을 되돌린다", () => {
  assert.match(mineModule, /event\.key === "Escape"/u);
  assert.match(mineModule, /document\.addEventListener\("pointerdown", handlePointerDown\)/u);
  assert.match(mineModule, /restoreTriggerFocus/u);
  // 열려 있지 않을 때 document listener 를 남기면 다른 화면의 Escape 를 삼킵니다.
  assert.match(mineModule, /if \(!open\) return undefined;/u);
  assert.match(mineModule, /removeEventListener\("pointerdown", handlePointerDown\)/u);
});

test("빠른 필터는 결과가 있는 것만 내고 개수를 함께 보여 준다", () => {
  // 눌러도 0건인 칩을 두면 헛걸음이 됩니다.
  assert.match(page, /if \(played > 0\)/u);
  assert.match(bar, /<b>\{option\.count\}<\/b>/u);
  assert.match(bar, /aria-pressed=\{filter === option\.value\}/u);
  // 고른 필터가 사라지면 전체로 되돌립니다 — 시즌 셀렉트 값도 유효 목록에
  // 포함해야 시즌을 고르는 순간 전체로 튕기지 않습니다(사용성 §2-2-5).
  assert.match(page, /const valid = filterOptions\.some\(\(option\) => option\.value === filter\)\s*\|\|\s*seasonOptions\.some\(\(option\) => `season:\$\{option\.season\}` === filter\);/u);
  assert.match(page, /if \(!valid\) setFilter\("all"\);/u);
  // 시즌은 칩이 아니라 셀렉트 하나 — .slice\(0, 2\) 로 시즌이 잘리면 회귀입니다.
  assert.equal(page.includes(".slice(0, 2)"), false);
  assert.match(bar, /className="yoro-pn-season-select"/u);
  assert.match(bar, /patchNotesSeasonAll/u);
  // 좁히는 조작이면 히어로·타일을 접습니다.
  assert.match(page, /trimmedQuery\.length > 0 \|\| filter !== "all"/u);
});

test("칩 줄이 페이지를 가로로 밀지 않는다", () => {
  // 가로 스크롤 줄은 min-width 를 풀어 주지 않으면 부모의 폭을 밀어 올립니다.
  assert.match(css, /\.yoro-pn-bar \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/u);
  assert.match(css, /\.yoro-pn-bar-chips \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;[\s\S]*overflow-x: auto;/u);
});
