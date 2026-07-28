import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { loadPalworldDataService } = await import("../dist/services/palworld-data.js");
const {
  createPalworldMapMarkerArtifact,
  createPalworldMapMarkerProvider,
  loadPalworldMapMarkerArtifact,
  loadPalworldMapMarkerProvider
} = await import("../dist/data/palworld-map-marker-artifact.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");

const service = await loadPalworldDataService();
const metadata = service.meta().metadata;
const sourceInternalId = service.sourceInternalIdForPal("anubis");
const temporaryRoots = [];
const activeReleaseRoot = fileURLToPath(
  new URL("../data/palworld/1.0.1/", import.meta.url)
);
const activeRuntimeManifest = JSON.parse(
  await readFile(
    fileURLToPath(
      new URL("../data/palworld/runtime/active-manifest.json", import.meta.url)
    ),
    "utf8"
  )
);
const compatibilityApprovalSha256 =
  activeRuntimeManifest.composite.artifacts.find(
    (entry) => entry.kind === "map-markers-compatibility"
  )?.sha256;
assert.match(compatibilityApprovalSha256, /^[a-f0-9]{64}$/u);
const dashboardStaticRoot = fileURLToPath(
  new URL("../../dashboard/public/", import.meta.url)
);

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
      sourceGameVersion: activation === "active" ? metadata.gameVersion : null,
      sourceSteamBuildId: activation === "active" ? "fixture-build-001" : null,
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
  assert.deepEqual(main.body.coordinateTransform, artifact().worlds[0].transform);
  assert.equal(main.body.overlay.sourceGameVersion, metadata.gameVersion);
  assert.equal(main.body.overlay.sourceSteamBuildId, "fixture-build-001");
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
    /candidate 단독/u
  );
  assert.throws(
    () => createPalworldMapMarkerArtifact({
      ...artifact(),
      source: {
        ...artifact().source,
        sourceGameVersion: null,
        sourceSteamBuildId: null
      }
    }),
    /sourceGameVersion과 sourceSteamBuildId/u
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
      worlds: [
        artifact().worlds[0],
        {
          ...artifact().worlds[0],
          world: "tree",
          targetMapAssetSha256: "d".repeat(64),
          markers: [{
            ...artifact().worlds[0].markers[0],
            id: "tree-anubis-001"
          }]
        }
      ]
    }),
    /다른 world와 중복된 source row ID/u
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

test("checksum compatibility approval이 있는 고정 candidate는 실제 보스 marker를 공개한다", async () => {
  const provider = await loadPalworldMapMarkerProvider({
    releaseRoot: activeReleaseRoot,
    dashboardStaticRoot,
    palworldDataService: service,
    compatibilityApprovalSha256
  });
  const main = await request(
    handler(provider),
    "/api/palworld/map/markers?world=main"
  );
  assert.equal(main.res.statusCode, 200);
  assert.equal(main.body.state, "ready");
  assert.equal(main.body.markers.length, 83);
  assert.equal(main.body.coordinateTransform.status, "verified");
  assert.equal(main.body.coordinateTransform.horizontalAxis, "world_y");
  assert.equal(main.body.coordinateTransform.verticalAxis, "world_x");
  assert.equal(
    main.body.overlay.activationBasis,
    "versioned_compatibility_approval"
  );
  assert.equal(main.body.overlay.sourceGameVersion, null);
  assert.equal(main.body.overlay.sourceSteamBuildId, null);
  assert.equal(
    main.body.overlay.compatibilityApprovalSha256,
    compatibilityApprovalSha256
  );
  assert.equal(main.body.overlay.rightsVerified, false);
  const tree = await request(
    handler(provider),
    "/api/palworld/map/markers?world=tree"
  );
  assert.equal(tree.res.statusCode, 200);
  assert.equal(tree.body.state, "ready");
  assert.equal(tree.body.markers.length, 7);
  assert.deepEqual(
    tree.body.markers.map((marker) => marker.pal.id),
    [
      "dualith",
      "celesdir-noct",
      "whalaska-ignis",
      "mycora",
      "moldron-cryst",
      "renjishi",
      "aegidron"
    ]
  );
  assert.equal(
    tree.body.overlay.targetMapAssetSha256,
    "c49b2a18bf1512019f0e18c592c20d74cd491b10394ab8121581cc294f74a2cf"
  );
  assert.equal(
    tree.body.overlay.transformRevision,
    "tree-map-fmodel-bounds-v1"
  );
});

test("compatibility approval 누락과 변조는 candidate marker 공개를 fail-closed 처리한다", async () => {
  await assert.rejects(
    loadPalworldMapMarkerProvider({
      releaseRoot: activeReleaseRoot,
      palworldDataService: service
    }),
    /candidate 단독/u
  );

  const files = [
    "map-markers.json",
    "map-markers-manifest.json",
    "paldex.json",
    "map-images-manifest.json"
  ];
  const tamperedRoot = await mkdtemp(
    path.join(tmpdir(), "streamops-palworld-marker-approval-tampered-")
  );
  temporaryRoots.push(tamperedRoot);
  await Promise.all(files.map((file) =>
    copyFile(path.join(activeReleaseRoot, file), path.join(tamperedRoot, file))
  ));
  const approval = JSON.parse(
    await readFile(
      path.join(activeReleaseRoot, "map-markers-compatibility.json"),
      "utf8"
    )
  );
  approval.reviewer = "streamoverlay-data-maintenance-tampered";
  await writeFile(
    path.join(tamperedRoot, "map-markers-compatibility.json"),
    `${JSON.stringify(approval, null, 2)}\n`,
    "utf8"
  );
  const tamperedApprovalSha256 = createHash("sha256")
    .update(
      await readFile(
        path.join(tamperedRoot, "map-markers-compatibility.json")
      )
    )
    .digest("hex");
  await assert.rejects(
    loadPalworldMapMarkerProvider({
      releaseRoot: tamperedRoot,
      palworldDataService: service,
      compatibilityApprovalSha256: tamperedApprovalSha256
    }),
    /evidenceChecksum/u
  );
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
