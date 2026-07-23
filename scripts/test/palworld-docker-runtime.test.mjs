import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dockerfilePath = path.join(repositoryRoot, "apps/server/Dockerfile");
const activeManifestPath = path.join(
  repositoryRoot,
  "apps/server/data/palworld/runtime/active-manifest.json"
);

test("server runtime image는 active manifest allowlist bundle만 포함하고 smoke 검증을 실행한다", async () => {
  const [dockerfile, activeManifestSource] = await Promise.all([
    readFile(dockerfilePath, "utf8"),
    readFile(activeManifestPath, "utf8")
  ]);
  const activeManifest = JSON.parse(activeManifestSource);

  assert.match(
    dockerfile,
    /--prepare-runtime-bundle \/app\/\.palworld-runtime-bundle/u
  );
  assert.match(
    dockerfile,
    /COPY --from=build \/app\/\.palworld-runtime-bundle\/apps\/server\/data\/palworld \.\/apps\/server\/data\/palworld/u
  );
  assert.match(
    dockerfile,
    /COPY --from=build \/app\/\.palworld-runtime-bundle\/apps\/server\/src\/data\/palworld-mappings \.\/apps\/server\/src\/data\/palworld-mappings/u
  );
  assert.match(
    dockerfile,
    /RUN node apps\/server\/dist\/scripts\/smoke-palworld-runtime-artifacts\.js/u
  );
  assert.doesNotMatch(
    dockerfile,
    /COPY --from=build \/app\/apps\/server\/data\/palworld/u
  );
  assert.doesNotMatch(dockerfile, /palworld\/1\.0\.1/u);
  assert.doesNotMatch(dockerfile, /Atlas|pyPal/u);
  assert.doesNotMatch(
    dockerfile,
    /(?:runtime-manifest\.candidate\.json|Content\.zip|source-cache|streamoverlay-palworld-paldex)/u
  );

  assert.equal(activeManifest.schemaVersion, 1);
  assert.equal(
    ["legacy_release_v1", "operator_pak_v1"].includes(activeManifest.format),
    true
  );
  await access(path.join(
    repositoryRoot,
    "apps/server/data/palworld",
    ...activeManifest.releaseDirectory.split("/"),
    activeManifest.manifestFile
  ));
});
