import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { loadPalworldDataService } = await import("../dist/services/palworld-data.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");

const releaseSource = fileURLToPath(new URL("../data/palworld/1.0.1/", import.meta.url));
const mappingSource = fileURLToPath(new URL("../src/data/palworld-mappings/", import.meta.url));
const temporaryRoots = [];

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

async function request(handler, url) {
  const res = createResponse();
  await handler(createRequest("GET", url), res);
  return { res, body: res.body ? JSON.parse(res.body) : undefined };
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "streamops-palworld-runtime-"));
  temporaryRoots.push(root);
  const releaseRoot = path.join(root, "release");
  const mappingRoot = path.join(root, "mappings");
  cpSync(releaseSource, releaseRoot, { recursive: true });
  cpSync(mappingSource, mappingRoot, { recursive: true });
  return {
    releaseRoot,
    mappingRoot,
    imageRoot: path.join(root, "images-not-present")
  };
}

function unavailableHandler() {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    readiness: () => ({ ok: true, checks: { runtime: true }, errors: [] })
  });
}

beforeEach(() => resetSecurityRateLimiters());

test.after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

test("artifact 누락·JSON 손상·paldex 및 mapping checksum 오류는 service load를 fail-closed 처리한다", async () => {
  const missingRoot = mkdtempSync(path.join(tmpdir(), "streamops-palworld-runtime-missing-"));
  temporaryRoots.push(missingRoot);
  const missing = {
    releaseRoot: path.join(missingRoot, "release-not-present"),
    mappingRoot: path.join(missingRoot, "mappings-not-present"),
    imageRoot: path.join(missingRoot, "images-not-present")
  };

  const invalidJson = fixture();
  writeFileSync(path.join(invalidJson.releaseRoot, "paldex.json"), "{손상된 JSON", "utf8");

  const paldexChecksum = fixture();
  appendFileSync(path.join(paldexChecksum.releaseRoot, "paldex.json"), "\n", "utf8");

  const mappingChecksum = fixture();
  appendFileSync(path.join(mappingChecksum.mappingRoot, "elements.json"), "\n", "utf8");

  const failures = [
    [missing, /ENOENT/u],
    [invalidJson, /JSON/u],
    [paldexChecksum, /manifest\.paldexSha256/u],
    [mappingChecksum, /manifest\.mappingSha256\.elements/u]
  ];
  for (const [options, expected] of failures) {
    await assert.rejects(loadPalworldDataService(options), expected);
    const handler = unavailableHandler();
    const unavailable = await request(handler, "/api/palworld/meta");
    assert.equal(unavailable.res.statusCode, 503);
    assert.deepEqual(unavailable.body, {
      error: "PALWORLD_DATA_UNAVAILABLE",
      message: "Palworld 데이터를 사용할 수 없습니다."
    });
    const ready = await request(handler, "/health/ready");
    assert.equal(ready.res.statusCode, 200);
    assert.equal(ready.body.ok, true);
  }
});

test("policy·image manifest 오류는 Pal 텍스트를 유지하고 이미지 gate만 fallback으로 낮춘다", async () => {
  const missingPolicy = fixture();
  rmSync(path.join(missingPolicy.releaseRoot, "image-use-policy.json"));

  const invalidPolicy = fixture();
  writeFileSync(path.join(invalidPolicy.releaseRoot, "image-use-policy.json"), "{손상된 policy", "utf8");

  const invalidImages = fixture();
  writeFileSync(path.join(invalidImages.releaseRoot, "images-manifest.json"), "{손상된 image manifest", "utf8");

  const imageChecksum = fixture();
  appendFileSync(path.join(imageChecksum.releaseRoot, "images-manifest.json"), "\n", "utf8");

  const missingImageOverride = fixture();
  rmSync(path.join(missingImageOverride.mappingRoot, "image-overrides.json"));

  for (const [options, expectedPolicyStatus] of [
    [missingPolicy, "missing"],
    [invalidPolicy, "missing"],
    [invalidImages, "operator_acknowledged"],
    [imageChecksum, "operator_acknowledged"],
    [missingImageOverride, "operator_acknowledged"]
  ]) {
    const service = await loadPalworldDataService(options);
    const meta = service.meta();
    assert.equal(meta.counts.pals, 287);
    assert.equal(meta.gates.dataIntegrity.status, "ready");
    assert.equal(meta.gates.imageAssets.status, "blocked_by_license");
    assert.equal(meta.gates.imageAssets.policyStatus, expectedPolicyStatus);
    assert.equal(meta.gates.imageAssets.readyImages, 0);
    assert.equal(meta.gates.imageAssets.fallbackPals, 287);
    assert.equal(service.getPal("lamball").imageUrl, undefined);
  }
});

test("Palworld 데이터가 없으면 Palworld GET API만 고정 503이고 health와 public API는 정상이다", async () => {
  const handler = unavailableHandler();
  const paths = [
    "/api/palworld/meta",
    "/api/palworld/search?q=anubis",
    "/api/palworld/pals",
    "/api/palworld/pals/lamball",
    "/api/palworld/items",
    "/api/palworld/items/pal-sphere",
    "/api/palworld/map/markers?world=main",
    "/api/palworld/map/spawns?world=main&pal=anubis",
    "/api/palworld/breeding?parentA=penking&parentB=bushi",
    "/api/palworld/breeding/parents?child=anubis"
  ];
  for (const pathname of paths) {
    const response = await request(handler, pathname);
    assert.equal(response.res.statusCode, 503);
    assert.deepEqual(response.body, {
      error: "PALWORLD_DATA_UNAVAILABLE",
      message: "Palworld 데이터를 사용할 수 없습니다."
    });
    assert.equal(response.res.headers["Cache-Control"], "no-store");
    assert.equal(JSON.stringify(response.body).includes("/"), false);
    assert.equal("stack" in response.body, false);
  }

  const ready = await request(handler, "/health/ready");
  assert.equal(ready.res.statusCode, 200);
  assert.equal(ready.body.ok, true);

  const locale = await request(handler, "/api/public/locale");
  assert.equal(locale.res.statusCode, 200);
  assert.equal(locale.body.locale, "ko");
});
