import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { loadPalworldDataService } = await import(
  "../dist/services/palworld-data.js"
);
const {
  createPalworldMapLocationsProvider,
  loadPalworldMapLocationsArtifact,
  loadPalworldMapLocationsCompatibilityAuthorization,
  palworldMapLocationsCompatibilityEvidenceChecksum
} = await import("../dist/data/palworld-map-locations-artifact.js");
const { resetSecurityRateLimiters } = await import(
  "../dist/security/rate-limit.js"
);

const temporaryRoots = [];
const service = await loadPalworldDataService();
const metadata = service.meta().metadata;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function categoryCounts() {
  return {
    "fast-travel": 1,
    dungeon: 1,
    npc: 0,
    egg: 1,
    "skill-fruit": 0,
    treasure: 0,
    lifmunk: 0,
    journal: 0,
    resource: 0,
    enemy: 0,
    location: 0
  };
}

function artifact(activation = "active") {
  return {
    schemaVersion: 1,
    targetGameVersion: metadata.gameVersion,
    activation,
    source: {
      sourceType: "operator_pak_export",
      archiveSha256: "a".repeat(64),
      indexMember: "MainWorld_5/PL_MainWorld5.json",
      indexMemberSha256: "b".repeat(64),
      memberInventorySha256: "c".repeat(64),
      selectedMemberCount: 10,
      sourceGameVersion:
        activation === "active" ? metadata.gameVersion : null,
      sourceSteamBuildId: activation === "active" ? "123456" : null,
      rightsVerified: false,
      usageBasis: "operator_reference_use"
    },
    totalLocations: 3,
    worlds: [{
      world: "main",
      targetMapAssetSha256: "d".repeat(64),
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
      locationCount: 3,
      categoryCounts: categoryCounts(),
      locations: [
        {
          id: "dungeon-0001",
          sourceActorId: "DungeonActor_1",
          sourceClass: "BP_DungeonEntrance_C",
          sourceMemberPath: "MainWorld_5/Grid_A.json",
          sourceActorExportIndex: 10,
          sourceInstanceId: null,
          category: "dungeon",
          subtype: "entrance",
          normalizedX: 0.2,
          normalizedY: 0.3
        },
        {
          id: "egg-0001",
          sourceActorId: "EggActor_1",
          sourceClass: "BP_EggSpawner_C",
          sourceMemberPath: "MainWorld_5/Grid_A.json",
          sourceActorExportIndex: 20,
          sourceInstanceId: "shared-instance-is-not-an-identity",
          category: "egg",
          subtype: "wild-egg",
          normalizedX: 0.4,
          normalizedY: 0.5
        },
        {
          id: "fast-travel-0001",
          sourceActorId: "FastTravelActor_1",
          sourceClass: "BP_FastTravelPoint_C",
          sourceMemberPath: "MainWorld_5/Grid_B.json",
          sourceActorExportIndex: 10,
          sourceInstanceId: "shared-instance-is-not-an-identity",
          category: "fast-travel",
          subtype: "great-eagle-statue",
          normalizedX: 0.6,
          normalizedY: 0.7
        }
      ]
    }]
  };
}

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

function handler(provider) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    palworldDataService: service,
    ...(provider === undefined
      ? {}
      : { palworldMapLocationsProvider: provider })
  });
}

async function request(targetHandler, url) {
  const response = createResponse();
  await targetHandler(createRequest(url), response);
  return {
    response,
    body: response.body ? JSON.parse(response.body) : undefined
  };
}

async function writeArtifact(root, value) {
  const artifactText = `${JSON.stringify(value, null, 2)}\n`;
  const manifestText = `${JSON.stringify({
    schemaVersion: 1,
    targetGameVersion: value.targetGameVersion,
    artifactFile: "map-locations.json",
    artifactSha256: sha256(artifactText)
  }, null, 2)}\n`;
  await Promise.all([
    writeFile(path.join(root, "map-locations.json"), artifactText, "utf8"),
    writeFile(
      path.join(root, "map-locations-manifest.json"),
      manifestText,
      "utf8"
    )
  ]);
  return { artifactText, manifestText };
}

beforeEach(() => resetSecurityRateLimiters());

test.after(async () => {
  for (const root of temporaryRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

test("지도 위치 provider가 없으면 API만 data_unavailable·no-store로 응답한다", async () => {
  const locations = await request(
    handler(),
    "/api/palworld/map/locations?world=main&layers=egg"
  );
  assert.equal(locations.response.statusCode, 200);
  assert.equal(locations.body.state, "data_unavailable");
  assert.equal(locations.response.headers["Cache-Control"], "no-store");
  assert.equal(locations.body.metadata.gameVersion, metadata.gameVersion);

  const pals = await request(handler(), "/api/palworld/pals?limit=1");
  assert.equal(pals.response.statusCode, 200);
  assert.equal(pals.body.items.length, 1);
});

test("지도 위치 API는 레이어 filtering·pagination·active metadata를 유지한다", async () => {
  const provider = createPalworldMapLocationsProvider({
    artifact: artifact()
  });
  const first = await request(
    handler(provider),
    "/api/palworld/map/locations?layers=fast-travel,egg&offset=0&limit=1"
  );
  assert.equal(first.response.statusCode, 200);
  assert.equal(first.body.state, "ready");
  assert.equal(first.body.total, 2);
  assert.equal(first.body.returned, 1);
  assert.equal(first.body.hasMore, true);
  assert.equal(first.body.locations[0].id, "egg-0001");
  assert.equal(Object.hasOwn(first.body.locations[0], "sourceActorId"), false);
  assert.equal(
    first.response.headers["X-Palworld-Data-Version"],
    metadata.gameVersion
  );
  assert.equal(first.body.metadata.gameVersion, metadata.gameVersion);
  assert.equal(first.body.overlay.activationBasis, "source_metadata");
  assert.equal(first.body.overlay.rightsVerified, false);

  const last = await request(
    handler(provider),
    "/api/palworld/map/locations?layers=fast-travel,egg&offset=1&limit=1"
  );
  assert.equal(last.body.locations[0].id, "fast-travel-0001");
  assert.equal(last.body.hasMore, false);
  assert.deepEqual(provider.diagnostics(), {
    state: "ready",
    total: 3,
    categoryCounts: categoryCounts()
  });
});

test("지도 위치 query는 unknown field와 비정상 pagination을 400으로 거부한다", async () => {
  for (const url of [
    "/api/palworld/map/locations?layers=egg,egg",
    "/api/palworld/map/locations?layers=unknown",
    "/api/palworld/map/locations?offset=-1",
    "/api/palworld/map/locations?limit=5001",
    "/api/palworld/map/locations?target=https%3A%2F%2Fexample.com"
  ]) {
    const result = await request(handler(), url);
    assert.equal(result.response.statusCode, 400);
    assert.equal(result.body.code, "PALWORLD_INVALID_QUERY");
  }
});

test("artifact manifest checksum 변조를 fail-closed 처리한다", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "streamops-palworld-map-locations-")
  );
  temporaryRoots.push(root);
  const { artifactText } = await writeArtifact(root, artifact());
  assert.equal(
    (await loadPalworldMapLocationsArtifact(root)).totalLocations,
    3
  );
  await writeFile(
    path.join(root, "map-locations.json"),
    `${artifactText} `,
    "utf8"
  );
  await assert.rejects(
    loadPalworldMapLocationsArtifact(root),
    /실제 artifact SHA-256/u
  );
});

test("candidate는 composite가 고정한 exact-checksum approval 없이는 공개되지 않는다", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "streamops-palworld-map-locations-approval-")
  );
  temporaryRoots.push(root);
  const candidate = artifact("candidate");
  const { artifactText, manifestText } = await writeArtifact(root, candidate);
  assert.throws(
    () => createPalworldMapLocationsProvider({ artifact: candidate }),
    /candidate 단독/u
  );

  const approvalPayload = {
    schemaVersion: 1,
    release: candidate.targetGameVersion,
    status: "operator_acknowledged",
    decision: "allow_exact_checksum_compatibility_display",
    sourceVersionVerified: false,
    compatibilityBasis: "exact_world_actor_join_and_map_geometry",
    sourceArchiveSha256: candidate.source.archiveSha256,
    indexMemberSha256: candidate.source.indexMemberSha256,
    memberInventorySha256: candidate.source.memberInventorySha256,
    mapLocationsArtifactSha256: sha256(artifactText),
    mapLocationsManifestSha256: sha256(manifestText),
    selectedMemberCount: candidate.source.selectedMemberCount,
    totalLocations: candidate.totalLocations,
    categoryCounts: categoryCounts(),
    worlds: [{
      world: "main",
      targetMapAssetSha256:
        candidate.worlds[0].targetMapAssetSha256,
      transformRevision: candidate.worlds[0].transform.revision
    }],
    importAudit: {
      sourceRawExact: 4,
      mainIncluded: 3,
      treeExcluded: 1,
      outOfBoundsExcluded: 0,
      exactDuplicates: 0,
      taxonomyMappingSha256: "e".repeat(64),
      transformMappingSha256: "f".repeat(64)
    },
    reviewedAt: "2026-07-26T00:00:00.000Z",
    reviewer: "streamoverlay-data-maintenance",
    rightsVerified: false,
    usageBasis: "operator_reference_use"
  };
  const approval = {
    ...approvalPayload,
    evidenceChecksum:
      palworldMapLocationsCompatibilityEvidenceChecksum(approvalPayload)
  };
  const approvalText = `${JSON.stringify(approval, null, 2)}\n`;
  const approvalSha256 = sha256(approvalText);
  await writeFile(
    path.join(root, "map-locations-compatibility.json"),
    approvalText,
    "utf8"
  );
  const authorization =
    await loadPalworldMapLocationsCompatibilityAuthorization({
      releaseRoot: root,
      artifact: candidate,
      expectedApprovalSha256: approvalSha256
    });
  const provider = createPalworldMapLocationsProvider({
    artifact: candidate,
    compatibilityAuthorization: authorization
  });
  const result = provider.response(
    "main",
    ["egg"],
    0,
    100,
    metadata
  );
  assert.equal(result.state, "ready");
  assert.equal(
    result.overlay?.activationBasis,
    "versioned_compatibility_approval"
  );
  assert.equal(
    result.overlay?.compatibilityApprovalSha256,
    approvalSha256
  );
  assert.equal(result.overlay?.sourceGameVersion, null);
  assert.equal(result.overlay?.rightsVerified, false);
});
