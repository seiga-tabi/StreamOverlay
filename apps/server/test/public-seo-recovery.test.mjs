import test from "node:test";
import assert from "node:assert/strict";
import { createHttpHandler } from "../dist/routes/http-api.js";
import { loadPalworldDataService } from "../dist/services/palworld-data.js";
import { DataDragonService } from "../dist/services/data-dragon.js";
import { resetSecurityRateLimiters } from "../dist/security/rate-limit.js";

const service = await loadPalworldDataService();
function handler(extra = {}) {
  return createHttpHandler({ store: {}, twitchAuth: {}, actions: {}, palworldDataService: service, ...extra });
}
async function get(handle, url) {
  resetSecurityRateLimiters();
  const response = { statusCode: 0, headers: {}, body: "",
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(body = "") { this.body = String(body); } };
  await handle({ method: "GET", url, headers: {}, socket: { remoteAddress: "127.0.0.1" } }, response);
  return response;
}
function bodyText(html) {
  const match = html.match(/<div class="seo-fallback"[^>]*>([\s\S]*?)<\/div>/u);
  assert.ok(match, "SSR fallback이 있어야 합니다");
  return match[1].replace(/<[^>]*>/gu, "").replace(/&quot;/gu, '"').replace(/&gt;/gu, ">").replace(/&lt;/gu, "<").replace(/&amp;/gu, "&");
}

// 기본 실행은 언어별 목록 전반에서 최대 12개씩 선택하고 전수 검사는 명시적으로 켭니다.
function sampledPaths(paths) {
  if (process.env.SEO_FULL_SWEEP === "1") return paths;
  return ["ko", "ja", "en"].flatMap((locale) => {
    const localized = paths.filter((path) => path.startsWith(`/${locale}/`));
    const count = Math.min(12, localized.length);
    return Array.from({ length: count }, (_, index) => localized[Math.floor(index * (localized.length - 1) / Math.max(1, count - 1))]);
  });
}

test("실제 아이템과 패시브 스킬의 다국어 SSR은 실데이터 본문과 상세 링크를 제공한다", async () => {
  const handle = handler();
  for (const locale of ["ko", "ja", "en"]) {
    for (const path of ["items/pal-sphere", "skills/passive-passive-legend-8ff382798f"]) {
      const response = await get(handle, `/${locale}/palworld/${path}`);
      assert.equal(response.statusCode, 200);
      const length = [...bodyText(response.body)].length;
      console.log(`SSR 측정 /${locale}/palworld/${path}: ${length}자`);
      assert.ok(length >= 200, `${path}: ${length}자`);
      assert.match(response.body, /href="\/(ko|ja|en)\/palworld\/(items|skills)\/[^"/]+"/u);
      assert.doesNotMatch(response.body, /name="robots" content="noindex/u);
    }
  }
});

test("skills sitemap 표본은 HTTP 200이고 legend는 제출되지 않는다", async () => {
  const handle = handler();
  const sitemap = await get(handle, "/sitemap-palworld-skills.xml");
  assert.equal(sitemap.statusCode, 200);
  const paths = [...sitemap.body.matchAll(/<loc>https:\/\/yoro.gg([^<]+)<\/loc>/gu)].map((m) => m[1]);
  assert.ok(paths.length > 0);
  assert.ok(!paths.some((path) => path.endsWith("/legend")));
  for (const path of sampledPaths(paths)) {
    const response = await get(handle, path);
    assert.equal(response.statusCode, 200, path);
    assert.ok([...bodyText(response.body)].length >= 200, `${path}: 실데이터 본문 부족`);
    assert.match(response.body, /href="\/(ko|ja|en)\/palworld\/(items|skills)\/[^"/]+"/u);
  }
  assert.equal((await get(handle, "/ko/palworld/skills/legend")).statusCode, 404);
  console.log(`skills sitemap: 전체 ${paths.length}개 중 ${sampledPaths(paths).length}개 HTTP 200`);
});

test("챔피언 SSR은 준비된 캐시만 읽고 누락·오류 시에도 200을 유지한다", async () => {
  let networkCalls = 0;
  const dataDragon = new DataDragonService(async () => { networkCalls++; throw new Error("외부 조회 금지"); });
  assert.equal(dataDragon.peekChampionMap(), undefined);
  assert.equal(networkCalls, 0);
  for (const cached of [undefined, new Map(), new Error("캐시 오류")]) {
    const response = await get(handler({ dataDragon: {
      peekChampionMap() { if (cached instanceof Error) throw cached; return cached; },
      getChampionMap() { throw new Error("SSR에서 외부 조회를 호출하면 안 됩니다"); }
    } }), "/ko/lol/champions");
    assert.equal(response.statusCode, 200);
    assert.ok(bodyText(response.body).length > 0);
  }
  // 170개 규모의 캐시 계약 검증용 합성 데이터이며 라이브 목록 측정이 아닙니다.
  const champions = new Map(Array.from({ length: 170 }, (_, index) => [index + 1, {
    championId: index + 1, nameKo: `검증 챔피언 ${index + 1}`, nameJa: `検証チャンピオン ${index + 1}`, nameEn: `Test champion ${index + 1}`
  }]));
  for (const locale of ["ko", "ja", "en"]) {
    const response = await get(handler({ dataDragon: { peekChampionMap: () => champions } }), `/${locale}/lol/champions`);
    assert.equal(response.statusCode, 200);
    assert.ok(bodyText(response.body).length >= 500);
    assert.equal([...response.body.matchAll(new RegExp(`href="/${locale}/lol/champions/[0-9]+"`, "gu"))].length, 170);
    console.log(`SSR 챔피언 합성 캐시 /${locale}: ${[...bodyText(response.body)].length}자, 상세 링크 170개`);
  }
  const escaped = await get(handler({ dataDragon: { peekChampionMap: () => new Map([[1, { championId: 1, nameKo: '<script>"&' }]]) } }), "/ko/lol/champions");
  assert.match(escaped.body, /&lt;script&gt;&quot;&amp;/u);
});

test("Data Dragon의 최신 캐시가 준비되면 SSR에서 추가 요청 없이 같은 목록을 읽는다", async () => {
  let calls = 0;
  const dataDragon = new DataDragonService(async (url) => {
    calls++;
    return new Response(JSON.stringify(String(url).endsWith("versions.json") ? ["16.17.1"] : {
      data: { Ahri: { key: "103", id: "Ahri", name: "아리", stats: { hp: 590 } } }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  assert.equal(dataDragon.peekChampionMap(), undefined);
  const ready = await dataDragon.getChampionMap();
  const fetched = calls;
  assert.equal(dataDragon.peekChampionMap(), ready);
  const response = await get(handler({ dataDragon }), "/ko/lol/champions");
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /href="\/ko\/lol\/champions\/103">아리<\/a>/u);
  assert.equal(calls, fetched);
});


test("아이템 sitemap 표본은 200과 실데이터 본문·상세 링크를 제공한다", async () => {
  const handle = handler();
  const sitemap = await get(handle, "/sitemap-palworld-items.xml");
  assert.equal(sitemap.statusCode, 200);
  const paths = [...sitemap.body.matchAll(/<loc>https:\/\/yoro.gg([^<]+)<\/loc>/gu)].map((m) => m[1]);
  assert.ok(paths.length > 0);
  for (const path of sampledPaths(paths)) {
    const response = await get(handle, path);
    assert.equal(response.statusCode, 200, path);
    assert.ok([...bodyText(response.body)].length >= 200, `${path}: 실데이터 본문 부족`);
    assert.match(response.body, /href="\/(ko|ja|en)\/palworld\/(items|skills)\/[^"/]+"/u);
  }
});

test("챔피언 디렉터리 예열은 기동·버전 변경에만 조회하고 갱신 실패 시 이전 본문을 유지한다", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let version = "16.17.1";
  let fail = false;
  const calls = [];
  const errors = [];
  const dataDragon = new DataDragonService(async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("versions.json")) return Response.json([version]);
    if (fail) throw new Error("예열 실패 검증");
    return Response.json({ data: { Ahri: { key: "103", id: "Ahri", name: `아리 ${version}` } } });
  });
  await dataDragon.warmChampionDirectory((error) => errors.push(error));
  assert.equal(calls.length, 4);
  assert.match((await get(handler({ dataDragon }), "/ko/lol/champions")).body, /아리 16\.17\.1/u);
  await Promise.all([dataDragon.getLatestVersion(), dataDragon.getChampionMap()]);
  assert.equal(calls.length, 4);
  now += 6 * 60 * 60 * 1000 + 1;
  version = "16.18.1";
  await Promise.all([dataDragon.getVersions(), dataDragon.getVersions()]);
  assert.equal(calls.length, 8);
  assert.equal(dataDragon.peekChampionMap().get(103).nameKo, "아리 16.18.1");
  now += 6 * 60 * 60 * 1000 + 1;
  version = "16.19.1";
  fail = true;
  await dataDragon.getVersions();
  assert.equal(errors.length, 1);
  assert.equal(dataDragon.peekChampionMap().get(103).nameKo, "아리 16.18.1");
  await dataDragon.getVersions();
  assert.equal(calls.length, 12);

  const unavailable = new DataDragonService(async () => { throw new Error("기동 시 CDN 장애"); });
  await unavailable.warmChampionDirectory((error) => errors.push(error));
  assert.equal(errors.length, 2);
  assert.equal(unavailable.peekChampionMap(), undefined);
});

test("아이템·스킬 비교는 현재 항목의 이웃이며 설명 전문·빈 이름을 링크에 넣지 않는다", async () => {
  for (const kind of ["items", "skills"]) {
    const base = kind === "items" ? service.getItem("pal-sphere") : service.getSkill("passive-passive-legend-8ff382798f");
    const entries = Array.from({ length: 40 }, (_, index) => ({ ...base, id: `neighbor-${index}`, nameKo: `비교 항목 ${index}`, descriptionKo: "링크에 들어가면 안 되는 설명 전문" }));
    entries[11] = { ...entries[11], nameKo: "", nameJa: "", nameEn: "" };
    const data = Object.create(service);
    data[kind === "items" ? "getItem" : "getSkill"] = (id) => entries.find((entry) => entry.id === id);
    data[kind === "items" ? "listItems" : "listSkills"] = () => ({ items: entries });
    const handle = handler({ palworldDataService: data });
    const sections = [];
    for (const index of [10, 30]) {
      const response = await get(handle, `/ko/palworld/${kind}/neighbor-${index}`);
      assert.equal(response.statusCode, 200);
      const section = response.body.match(/<section><h2>같은 (?:분류의 아이템|종류의 스킬) 비교<\/h2>[\s\S]*?<\/section>/u)?.[0];
      assert.ok(section);
      assert.match(section, new RegExp(`/${kind}/neighbor-${index - 1}"`, "u"));
      assert.match(section, new RegExp(`/${kind}/neighbor-${index + 2}"`, "u"));
      assert.doesNotMatch(section, /설명 전문|neighbor-11"|<a[^>]*>\s*<\/a>/u);
      assert.ok(!section.includes(`/${kind}/neighbor-${index}"`));
      sections.push(section);
    }
    assert.notEqual(sections[0], sections[1]);
    data[kind === "items" ? "listItems" : "listSkills"] = () => { throw new Error("비교 조회 실패"); };
    const fallback = await get(handle, `/ko/palworld/${kind}/neighbor-10`);
    assert.equal(fallback.statusCode, 200);
    assert.ok(bodyText(fallback.body).length > 0);
  }
});
