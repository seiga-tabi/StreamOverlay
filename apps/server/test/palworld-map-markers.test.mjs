import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { loadPalworldDataService } = await import("../dist/services/palworld-data.js");
const {
  createPalworldMapMarkerArtifact,
  createPalworldMapMarkerProvider,
  loadPalworldMapMarkerArtifact
} = await import("../dist/data/palworld-map-marker-artifact.js");
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
      sourceMember: "Pal/DataTable/UI/DT_BossSpawnerLoactionData.json",
      sourceMemberSha256: "b".repeat(64),
      sourceGameVersion: null,
      sourceSteamBuildId: null,
      rightsVerified: false,
      usageBasis: "operator_reference_use"
    },
    worlds: [{
      world: "main",
      targetMapAssetSha256: "c".repeat(64),
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
      markers: [{
        id: "main-anubis-001",
        sourceRowId: "Boss_Anubis",
        sourceInternalId,
        palId: "anubis",
        level: 47,
        normalizedX: 0.5,
        normalizedY: 0.5
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
    ...(provider === undefined ? {} : { palworldMapMarkerProvider: provider })
  });
}

beforeEach(() => resetSecurityRateLimiters());

test.after(async () => {
  for (const root of temporaryRoots) await rm(root, { recursive: true, force: true });
});

test("지도 overlay artifact가 없으면 다른 Palworld API를 중단하지 않고 data_unavailable을 반환한다", async () => {
  const map = await request(handler(), "/api/palworld/map/markers?world=main");
  assert.equal(map.res.statusCode, 200);
  assert.deepEqual(map.body, {
    state: "data_unavailable",
    world: "main",
    markers: [],
    metadata
  });
  assert.equal(map.res.headers["X-Palworld-Data-Version"], metadata.gameVersion);

  const pals = await request(handler(), "/api/palworld/pals?limit=1");
  assert.equal(pals.res.statusCode, 200);
  assert.equal(pals.body.items.length, 1);
});

test("지도 marker query는 world allowlist와 unknown field를 검증한다", async () => {
  for (const url of [
    "/api/palworld/map/markers?world=unknown",
    "/api/palworld/map/markers?world=main&target=https%3A%2F%2Fexample.com"
  ]) {
    const response = await request(handler(), url);
    assert.equal(response.res.statusCode, 400);
    assert.equal(response.body.code, "PALWORLD_INVALID_QUERY");
  }
});

test("active overlay만 Pal 참조를 exact join하여 ready marker로 반환한다", async () => {
  const provider = createPalworldMapMarkerProvider({
    artifact: createPalworldMapMarkerArtifact(artifact()),
    palworldDataService: service
  });
  const main = await request(handler(provider), "/api/palworld/map/markers?world=main");
  assert.equal(main.res.statusCode, 200);
  assert.equal(main.body.state, "ready");
  assert.equal(main.body.markers[0].pal.nameKo, "아누비스");
  assert.equal(main.body.overlay.sourceGameVersion, null);
  assert.equal(main.body.overlay.sourceSteamBuildId, null);
  assert.equal(
    main.body.overlay.compatibilityBasis,
    "exact_map_geometry_and_coordinate_transform"
  );
  assert.equal(main.body.overlay.rightsVerified, false);

  const tree = await request(handler(provider), "/api/palworld/map/markers?world=tree");
  assert.equal(tree.res.statusCode, 200);
  assert.equal(tree.body.state, "data_unavailable");

  assert.throws(
    () => createPalworldMapMarkerProvider({
      artifact: createPalworldMapMarkerArtifact(artifact("candidate")),
      palworldDataService: service
    }),
    /active/u
  );
  assert.throws(
    () => createPalworldMapMarkerProvider({
      artifact: createPalworldMapMarkerArtifact({
        ...artifact(),
        worlds: [{
          ...artifact().worlds[0],
          markers: [{
            ...artifact().worlds[0].markers[0],
            sourceInternalId: "WrongPal"
          }]
        }]
      }),
      palworldDataService: service
    }),
    /sourceInternalId/u
  );
  assert.throws(
    () => createPalworldMapMarkerArtifact({
      ...artifact(),
      worlds: [{
        ...artifact().worlds[0],
        transform: {
          ...artifact().worlds[0].transform,
          status: "pending"
        }
      }]
    }),
    /verified/u
  );
  assert.equal(createPalworldMapMarkerArtifact({
    ...artifact("candidate"),
    worlds: [{
      ...artifact("candidate").worlds[0],
      transform: {
        ...artifact("candidate").worlds[0].transform,
        status: "pending"
      }
    }]
  }).activation, "candidate");
});

test("manifest SHA-256 변조는 overlay artifact 로드를 fail-closed 처리한다", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "streamops-palworld-map-markers-"));
  temporaryRoots.push(root);
  const artifactBytes = `${JSON.stringify(createPalworldMapMarkerArtifact(artifact()))}\n`;
  await writeFile(path.join(root, "map-markers.json"), artifactBytes, "utf8");
  await writeFile(path.join(root, "map-markers-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    targetGameVersion: metadata.gameVersion,
    artifactFile: "map-markers.json",
    artifactSha256: createHash("sha256").update(artifactBytes).digest("hex")
  })}\n`, "utf8");

  const loaded = await loadPalworldMapMarkerArtifact(root);
  assert.equal(loaded.activation, "active");
  await writeFile(path.join(root, "map-markers.json"), `${artifactBytes} `, "utf8");
  await assert.rejects(loadPalworldMapMarkerArtifact(root), /SHA-256/u);
});
