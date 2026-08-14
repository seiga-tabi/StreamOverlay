import test from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { MinecraftCatalogService } = await import("../dist/services/minecraft-catalog.js");
const { requiredHttpPrincipal } = await import("../dist/security/auth.js");
const {
  validateMinecraftEnchantCatalogResponse,
  validateMinecraftItemCatalogResponse,
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

async function request(handler, url, method = "GET") {
  const response = createResponse();
  await handler(createRequest(method, url), response);
  return {
    response,
    body: response.body ? JSON.parse(response.body) : undefined
  };
}

test("Minecraft 공개 API는 GET exact prefix만 인증 없이 허용한다", () => {
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraft/items"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraft/recipes"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraft/enchants"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/minecraft/items"), "DASHBOARD_ADMIN");
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraft/future-admin"), "DASHBOARD_ADMIN");
  assert.equal(requiredHttpPrincipal("GET", "/api/minecraftish/items"), "DASHBOARD_ADMIN");
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
