import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { loadPalworldDataService } = await import("../dist/services/palworld-data.js");
const {
  createPalworldSpawnArtifact,
  createPalworldSpawnProvider,
  loadPalworldSpawnArtifact
} = await import("../dist/data/palworld-spawn-artifact.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");

const service = await loadPalworldDataService();
const metadata = service.meta().metadata;
const sourceInternalId = service.sourceInternalIdForPal("anubis");
const temporaryRoots = [];

function createRequest(url) {
  return {
    method: "GET",
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
  await handler(createRequest(url), res);
  return { res, body: res.body ? JSON.parse(res.body) : undefined };
}

function artifact(activation = "active") {
  return {
    schemaVersion: 1,
    targetGameVersion: metadata.gameVersion,
    activation,
    source: {
      sourceType: "operator_pak_export",
      archiveSha256: "a".repeat(64),
      placementTableMember: "Pal/DataTable/Spawner/DT_PalSpawnerPlacement.json",
      placementTableSha256: "b".repeat(64),
      wildSpawnerTableMember: "Pal/DataTable/Spawner/DT_PalWildSpawner.json",
      wildSpawnerTableSha256: "c".repeat(64),
      palTableMember: "Pal/DataTable/Character/DT_PalMonsterParameter.json",
      palTableSha256: "d".repeat(64),
      sourceGameVersion: metadata.gameVersion,
      sourceSteamBuildId: "24181105",
      compatibilityBasis: "exact_active_paldex_join_and_map_geometry",
      rightsVerified: false,
      usageBasis: "operator_reference_use"
    },
    gridSize: 32,
    worlds: [{
      world: "main",
      targetMapAssetSha256: "e".repeat(64),
      transform: {
        status: "verified",
        revision: "main-map-transform-v1",
        horizontalAxis: "world_y",
        verticalAxis: "world_x",
        invertHorizontal: false,
        invertVertical: true,
        sourceBounds: {
          minX: -1_099_400,
          maxX: 349_400,
          minY: -724_400,
          maxY: 724_400
        }
      },
      pals: [{
        palId: "anubis",
        sourceInternalId,
        totalPlacements: 7,
        points: [{
          id: "main-anubis-16-16",
          cellX: 16,
          cellY: 16,
          normalizedX: 0.5,
          normalizedY: 0.5,
          placementCount: 7,
          minimumLevel: 20,
          maximumLevel: 22,
          daytime: true,
          nighttime: false
        }]
      }]
    }]
  };
}

function handler(provider) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    palworldDataService: service,
    ...(provider === undefined ? {} : { palworldSpawnProvider: provider })
  });
}

beforeEach(() => resetSecurityRateLimiters());

test.after(async () => {
  for (const root of temporaryRoots) await rm(root, { recursive: true, force: true });
});

test("일반 스폰 artifact가 없으면 다른 Palworld API를 중단하지 않는다", async () => {
  const spawn = await request(handler(), "/api/palworld/map/spawns?world=main&pal=anubis");
  assert.equal(spawn.res.statusCode, 200);
  assert.equal(spawn.body.state, "data_unavailable");
  assert.equal(spawn.body.palId, "anubis");
  assert.equal(spawn.body.points.length, 0);
  assert.equal(spawn.res.headers["X-Palworld-Data-Version"], metadata.gameVersion);

  const pals = await request(handler(), "/api/palworld/pals?limit=1");
  assert.equal(pals.res.statusCode, 200);
  assert.equal(pals.body.items.length, 1);
});

test("일반 스폰 query는 canonical Pal, world와 unknown field를 검증한다", async () => {
  for (const url of [
    "/api/palworld/map/spawns?world=unknown&pal=anubis",
    "/api/palworld/map/spawns?world=main",
    "/api/palworld/map/spawns?world=main&pal=..%2Fsecret",
    "/api/palworld/map/spawns?world=main&pal=anubis&target=https%3A%2F%2Fexample.com"
  ]) {
    const response = await request(handler(), url);
    assert.equal(response.res.statusCode, 400);
    assert.equal(response.body.code, "PALWORLD_INVALID_QUERY");
  }
  const unknown = await request(
    handler(),
    "/api/palworld/map/spawns?world=main&pal=not-a-real-pal"
  );
  assert.equal(unknown.res.statusCode, 404);
  assert.equal(unknown.body.code, "PALWORLD_NOT_FOUND");
});

test("active spawn provider는 Pal을 exact join하고 빈 위치 상태를 구분한다", async () => {
  const provider = createPalworldSpawnProvider({
    artifact: createPalworldSpawnArtifact(artifact()),
    palworldDataService: service
  });
  const ready = await request(
    handler(provider),
    "/api/palworld/map/spawns?world=main&pal=anubis"
  );
  assert.equal(ready.res.statusCode, 200);
  assert.equal(ready.body.state, "ready");
  assert.equal(ready.body.totalPlacements, 7);
  assert.equal(ready.body.points[0].minimumLevel, 20);
  assert.equal(ready.body.overlay.sourceMember, artifact().source.placementTableMember);
  assert.equal(
    ready.body.overlay.compatibilityBasis,
    "exact_active_paldex_join_and_map_geometry"
  );
  assert.equal(ready.body.overlay.rightsVerified, false);

  const empty = await request(
    handler(provider),
    "/api/palworld/map/spawns?world=main&pal=lamball"
  );
  assert.equal(empty.res.statusCode, 200);
  assert.equal(empty.body.state, "confirmed_empty");
  assert.equal(empty.body.points.length, 0);
  assert.ok(empty.body.overlay);

  const tree = await request(
    handler(provider),
    "/api/palworld/map/spawns?world=tree&pal=anubis"
  );
  assert.equal(tree.res.statusCode, 200);
  assert.equal(tree.body.state, "data_unavailable");

  assert.throws(
    () => createPalworldSpawnProvider({
      artifact: createPalworldSpawnArtifact(artifact("candidate")),
      palworldDataService: service
    }),
    /active/u
  );
  assert.throws(
    () => createPalworldSpawnArtifact({
      ...artifact(),
      source: {
        ...artifact().source,
        sourceGameVersion: null,
        sourceSteamBuildId: null
      }
    }),
    /gameVersion과 Steam build ID/u
  );
  assert.throws(
    () => createPalworldSpawnProvider({
      artifact: createPalworldSpawnArtifact({
        ...artifact(),
        worlds: [{
          ...artifact().worlds[0],
          pals: [{
            ...artifact().worlds[0].pals[0],
            sourceInternalId: "WrongPal"
          }]
        }]
      }),
      palworldDataService: service
    }),
    /sourceInternalId/u
  );
});

test("spawn manifest SHA-256 변조는 artifact 로드를 fail-closed 처리한다", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "streamops-palworld-spawns-"));
  temporaryRoots.push(root);
  const artifactBytes = `${JSON.stringify(createPalworldSpawnArtifact(artifact()))}\n`;
  await writeFile(path.join(root, "map-spawns.json"), artifactBytes, "utf8");
  await writeFile(path.join(root, "map-spawns-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    targetGameVersion: metadata.gameVersion,
    artifactFile: "map-spawns.json",
    artifactSha256: createHash("sha256").update(artifactBytes).digest("hex")
  })}\n`, "utf8");

  const loaded = await loadPalworldSpawnArtifact(root);
  assert.equal(loaded.activation, "active");
  await writeFile(path.join(root, "map-spawns.json"), `${artifactBytes} `, "utf8");
  await assert.rejects(loadPalworldSpawnArtifact(root), /SHA-256/u);
});
