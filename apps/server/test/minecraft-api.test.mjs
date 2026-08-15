import test from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { MinecraftCatalogService } = await import("../dist/services/minecraft-catalog.js");
const { MinecraftPatchNotesService } = await import("../dist/services/minecraft-patch-notes-service.js");
const { MINECRAFT_FEEDBACK_SECTION_IDS } = await import(
  "../dist/services/minecraft-patch-notes-feedback-source.js"
);
const { MINECRAFT_JAVA_VERSION_MANIFEST_URL } = await import(
  "../dist/services/minecraft-patch-notes-source.js"
);
const { requiredHttpPrincipal } = await import("../dist/security/auth.js");
const { publicMinecraftPatchNotesApiLimiter } = await import("../dist/security/rate-limit.js");
const {
  validateMinecraftEnchantCatalogResponse,
  validateMinecraftItemCatalogResponse,
  validateMinecraftPatchNotesResponse,
  validateMinecraftRecipeCatalogResponse
} = await import("@streamops/shared");
const catalog = MinecraftCatalogService.load();

function createRequest(method, url) {
  return {
    method,
    url,
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {}
  };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body = String(chunk);
    }
  };
}

function createHandler(minecraftCatalog = catalog) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    ...(minecraftCatalog ? { minecraftCatalog } : {})
  });
}

function sourceEntry(id, type, releaseTime) {
  return {
    id,
    type,
    url: `https://piston-meta.mojang.com/v1/packages/${"c".repeat(40)}/${id}.json`,
    time: releaseTime,
    releaseTime,
    sha1: "c".repeat(40),
    complianceLevel: 1
  };
}

function feedbackResponse(sectionId, articles) {
  return new Response(JSON.stringify({
    articles,
    count: articles.length,
    next_page: null,
    page: 1,
    page_count: 1,
    per_page: 100,
    previous_page: null,
    sort_by: "created_at",
    sort_order: "desc"
  }), { headers: { "content-type": "application/json" } });
}

function feedbackArticle(id, sectionId, title, createdAt) {
  return {
    id,
    section_id: sectionId,
    locale: "en-us",
    draft: false,
    title,
    created_at: createdAt,
    html_url: `https://feedback.minecraft.net/hc/en-us/articles/${id}-Minecraft-Changelog`
  };
}

function patchService() {
  return new MinecraftPatchNotesService({
    fetchImpl: async (input) => {
      const url = new URL(input);
      if (url.href === MINECRAFT_JAVA_VERSION_MANIFEST_URL) {
        return new Response(JSON.stringify({
          latest: { release: "26.2", snapshot: "26.3-snapshot-8" },
          versions: [
            sourceEntry("26.3-snapshot-8", "snapshot", "2026-08-12T09:39:37Z"),
            sourceEntry("26.2", "release", "2026-06-16T09:00:00Z")
          ]
        }), { headers: { "content-type": "application/json" } });
      }
      const sectionId = Number(/\/sections\/(\d+)\/articles\.json$/u.exec(url.pathname)?.[1]);
      const article = sectionId === MINECRAFT_FEEDBACK_SECTION_IDS.release
        ? feedbackArticle(201, sectionId, "Minecraft - 1.21.132 (Bedrock)", "2026-08-14T17:00:33Z")
        : sectionId === MINECRAFT_FEEDBACK_SECTION_IDS.bedrockPreview
          ? feedbackArticle(202, sectionId, "Minecraft Beta & Preview - 26.50.25", "2026-08-11T14:50:48Z")
          : feedbackArticle(203, sectionId, "Minecraft Java Edition - 26.3 Snapshot 8", "2026-08-12T11:40:16Z");
      return feedbackResponse(sectionId, [article]);
    },
    sleepImpl: async () => undefined
  });
}

function createPatchHandler(minecraftPatchNotes = patchService()) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    ...(minecraftPatchNotes ? { minecraftPatchNotes } : {})
  });
}

async function request(handler, url, method = "GET") {
  const response = createResponse();
  await handler(createRequest(method, url), response);
  return {
    response,
    body: response.body ? JSON.parse(response.body) : undefined
  };
}

async function rawRequest(handler, url, method = "GET") {
  const response = createResponse();
  await handler(createRequest(method, url), response);
  return response;
}

test("Minecraft 공개 API는 GET exact prefix만 인증 없이 허용한다", () => {
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraft/items"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraft/recipes"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraft/enchants"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraft/patch-notes"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/minecraft/items"), "DASHBOARD_ADMIN");
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraft/future-admin"), "DASHBOARD_ADMIN");
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraftish/items"), "DASHBOARD_ADMIN");
});

test("Minecraft 패치 노트 API는 shared schema·공개 캐시·전용 rate limit 그룹을 사용한다", async () => {
  const { response, body } = await request(
    createPatchHandler(),
    "/api/minecraft/patch-notes?edition=java&type=snapshot&page=1"
  );
  assert.equal(response.statusCode, 200);
  assert.equal(validateMinecraftPatchNotesResponse(body).ok, true);
  assert.equal(body.state, "ready");
  assert.equal(body.entries.length, 1);
  assert.equal(body.entries[0].version, "26.3-snapshot-8");
  assert.equal(body.entries[0].title, undefined);
  assert.match(response.headers["Cache-Control"], /^public, max-age=300/u);
  assert.equal(publicMinecraftPatchNotesApiLimiter.requestLimit, 120);
});

test("Minecraft 패치 노트 API는 unknown·중복·잘못된 query를 400으로 거부한다", async () => {
  for (const url of [
    "/api/minecraft/patch-notes",
    "/api/minecraft/patch-notes?edition=java&edition=bedrock",
    "/api/minecraft/patch-notes?edition=java&type=beta",
    "/api/minecraft/patch-notes?edition=java&page=0",
    "/api/minecraft/patch-notes?edition=java&limit=100"
  ]) {
    const { response, body } = await request(createPatchHandler(), url);
    assert.equal(response.statusCode, 400, url);
    assert.equal(response.headers["Cache-Control"], "no-store", url);
    assert.equal(body.code, "MINECRAFT_PATCH_NOTES_QUERY_INVALID", url);
  }
});

test("Bedrock preview API는 shared schema와 공개 캐시 정책으로 정상 응답한다", async () => {
  const { response, body } = await request(
    createPatchHandler(),
    "/api/minecraft/patch-notes?edition=bedrock&type=preview"
  );
  assert.equal(response.statusCode, 200);
  assert.equal(validateMinecraftPatchNotesResponse(body).ok, true);
  assert.equal(body.state, "ready");
  assert.equal(body.entries[0].version, "26.50.25");
  assert.equal(body.entries[0].type, "preview");
  assert.match(response.headers["Cache-Control"], /^public, max-age=300/u);
});

test("수집기 미연결 상태는 오류 대신 data_unavailable을 반환한다", async () => {
  const { response, body } = await request(
    createPatchHandler(null),
    "/api/minecraft/patch-notes?edition=java"
  );
  assert.equal(response.statusCode, 200);
  assert.deepEqual(body, { state: "data_unavailable" });
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("Minecraft 패치 snapshot이 실제 준비된 뒤에만 sitemap에 패치 노트를 추가한다", async () => {
  const service = patchService();
  const handler = createPatchHandler(service);
  const before = await rawRequest(handler, "/sitemap-static.xml");
  assert.doesNotMatch(before.body, /\/minecraft\/patch-notes/u);
  await request(handler, "/api/minecraft/patch-notes?edition=java");
  const after = await rawRequest(handler, "/sitemap-static.xml");
  assert.match(after.body, /\/ko\/minecraft\/patch-notes/u);
  assert.match(after.body, /\/ja\/minecraft\/patch-notes/u);
});

test("Minecraft item·recipe·enchant API는 검증된 pagination과 동일 캐시 정책을 반환한다", async () => {
  const cases = [
    ["/api/minecraft/items?limit=2", validateMinecraftItemCatalogResponse],
    ["/api/minecraft/recipes?type=crafting&limit=2", validateMinecraftRecipeCatalogResponse],
    ["/api/minecraft/enchants?limit=2", validateMinecraftEnchantCatalogResponse]
  ];
  for (const [url, validate] of cases) {
    const { response, body } = await request(createHandler(), url);
    assert.equal(response.statusCode, 200, url);
    assert.equal(validate(body).ok, true, url);
    assert.match(response.headers["Cache-Control"], /^public,/u, url);
    assert.equal(response.headers["X-Minecraft-Data-Version"], "1.21.11", url);
    assert.match(response.headers["X-Minecraft-Data-Revision"], /^[a-f0-9]{64}$/u, url);
  }
});

test("Minecraft query 오류와 artifact 미로딩 상태는 no-store로 fail-closed한다", async () => {
  const invalid = await request(createHandler(), "/api/minecraft/items?page=0");
  assert.equal(invalid.response.statusCode, 400);
  assert.equal(invalid.response.headers["Cache-Control"], "no-store");
  assert.equal(invalid.body.code, "MINECRAFT_QUERY_INVALID");

  const unavailable = await request(createHandler(null), "/api/minecraft/items");
  assert.equal(unavailable.response.statusCode, 200);
  assert.equal(unavailable.response.headers["Cache-Control"], "no-store");
  assert.deepEqual(unavailable.body, { state: "data_unavailable" });
});
