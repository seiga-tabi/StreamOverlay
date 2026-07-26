import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PALWORLD_BREEDING_SOURCE_ALIAS_SCHEMA_VERSION = 1;
export const PALWORLD_BREEDING_SOURCE_ALIAS_RELEASE = "1.0.1";
export const PALWORLD_BREEDING_SOURCE_ALIAS_SHA256 =
  "dc39e4c8646eaa7f61573d832dcb854d31184713dfc815e0221dc83d947ae559";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const PALWORLD_BREEDING_SOURCE_ALIAS_FILE = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-mappings/breeding-source-aliases.json"
);

const INTERNAL_ID_PATTERN = /^[A-Za-z0-9_]+$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_ARTIFACT_BYTES = 64 * 1024;

export type PalworldBreedingSourceAliasArtifact = {
  schemaVersion: 1;
  release: "1.0.1";
  sourceRevision: "24181105";
  sourceMember: string;
  sourceSha256: string;
  entries: Array<{
    sourceInternalId: string;
    canonicalInternalId: string;
    reason: string;
    reviewStatus: "approved";
  }>;
};

type BreedingSourceAliasResolver = {
  resolve(sourceInternalId: string): string;
  has(sourceInternalId: string): boolean;
  entries: PalworldBreedingSourceAliasArtifact["entries"];
};

export function assertPalworldBreedingCatalogRuleConsistency(input: {
  sourceRuleKeys: ReadonlySet<string>;
  catalogRuleKeys: ReadonlySet<string>;
  aliasCorrectedRuleKeys: ReadonlySet<string>;
}): void {
  const unexpectedCatalogKeys = [...input.catalogRuleKeys]
    .filter((key) => !input.sourceRuleKeys.has(key));
  if (unexpectedCatalogKeys.length > 0) {
    fail(
      "catalog.specialBreedingPairs",
      "고정 Atlas source에 없는 조합이 포함되어 있습니다."
    );
  }

  const invalidAliasKeys = [...input.aliasCorrectedRuleKeys]
    .filter((key) => !input.sourceRuleKeys.has(key));
  if (invalidAliasKeys.length > 0) {
    fail(
      "breedingSourceAliases",
      "고정 Atlas source에 없는 교배 규칙을 catalog 예외로 허용할 수 없습니다."
    );
  }

  const missingCatalogKeys = [...input.sourceRuleKeys]
    .filter((key) => !input.catalogRuleKeys.has(key));
  if (missingCatalogKeys.length === 0) return;

  if (
    missingCatalogKeys.length !== input.aliasCorrectedRuleKeys.size
    || missingCatalogKeys.some((key) => !input.aliasCorrectedRuleKeys.has(key))
  ) {
    fail(
      "catalog.specialBreedingPairs",
      "고정 Atlas source의 exact non-self 조합과 다릅니다."
    );
  }
}

function fail(pathName: string, message: string): never {
  throw new TypeError(`${pathName}: ${message}`);
}

function exactObject(
  value: unknown,
  pathName: string,
  keys: readonly string[]
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(pathName, "객체여야 합니다.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  }
  return record;
}

function internalIdAt(value: unknown, pathName: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 128
    || !INTERNAL_ID_PATTERN.test(value)
  ) {
    fail(pathName, "영문·숫자·_로 구성된 128자 이하 ID여야 합니다.");
  }
  return value;
}

function stringAt(
  value: unknown,
  pathName: string,
  maximumLength: number
): string {
  if (
    typeof value !== "string"
    || value.trim().length < 1
    || value.length > maximumLength
    || value.includes("\0")
  ) {
    fail(pathName, `비어 있지 않은 ${maximumLength}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

export function assertPalworldBreedingSourceAliasArtifact(
  value: unknown
): PalworldBreedingSourceAliasArtifact {
  const root = exactObject(value, "breedingSourceAliases", [
    "schemaVersion",
    "release",
    "sourceRevision",
    "sourceMember",
    "sourceSha256",
    "entries"
  ]);
  if (root.schemaVersion !== PALWORLD_BREEDING_SOURCE_ALIAS_SCHEMA_VERSION) {
    fail("breedingSourceAliases.schemaVersion", "1이어야 합니다.");
  }
  if (root.release !== PALWORLD_BREEDING_SOURCE_ALIAS_RELEASE) {
    fail("breedingSourceAliases.release", "1.0.1이어야 합니다.");
  }
  if (root.sourceRevision !== "24181105") {
    fail("breedingSourceAliases.sourceRevision", "고정 Atlas revision 24181105여야 합니다.");
  }
  const sourceMember = stringAt(
    root.sourceMember,
    "breedingSourceAliases.sourceMember",
    256
  );
  if (
    sourceMember !==
    "palworld-atlas-data-main/published/v1/builds/24181105/breeding.json"
  ) {
    fail("breedingSourceAliases.sourceMember", "고정 Atlas breeding member여야 합니다.");
  }
  const sourceSha256 = stringAt(
    root.sourceSha256,
    "breedingSourceAliases.sourceSha256",
    64
  );
  if (
    !SHA256_PATTERN.test(sourceSha256)
    || sourceSha256 !== PALWORLD_BREEDING_SOURCE_ALIAS_SHA256
  ) {
    fail(
      "breedingSourceAliases.sourceSha256",
      "고정 Atlas breeding checksum과 일치해야 합니다."
    );
  }
  if (!Array.isArray(root.entries) || root.entries.length < 1 || root.entries.length > 32) {
    fail("breedingSourceAliases.entries", "1~32개 배열이어야 합니다.");
  }
  const entries = root.entries.map((value, index) => {
    const entry = exactObject(value, `breedingSourceAliases.entries[${index}]`, [
      "sourceInternalId",
      "canonicalInternalId",
      "reason",
      "reviewStatus"
    ]);
    const sourceInternalId = internalIdAt(
      entry.sourceInternalId,
      `breedingSourceAliases.entries[${index}].sourceInternalId`
    );
    const canonicalInternalId = internalIdAt(
      entry.canonicalInternalId,
      `breedingSourceAliases.entries[${index}].canonicalInternalId`
    );
    if (sourceInternalId === canonicalInternalId) {
      fail(
        `breedingSourceAliases.entries[${index}]`,
        "source와 canonical ID가 달라야 합니다."
      );
    }
    if (entry.reviewStatus !== "approved") {
      fail(
        `breedingSourceAliases.entries[${index}].reviewStatus`,
        "approved여야 합니다."
      );
    }
    return {
      sourceInternalId,
      canonicalInternalId,
      reason: stringAt(
        entry.reason,
        `breedingSourceAliases.entries[${index}].reason`,
        512
      ),
      reviewStatus: "approved" as const
    };
  });
  if (
    new Set(entries.map((entry) => entry.sourceInternalId)).size
    !== entries.length
  ) {
    fail("breedingSourceAliases.entries", "source ID가 중복됩니다.");
  }
  if (
    new Set(entries.map((entry) => entry.canonicalInternalId)).size
    !== entries.length
  ) {
    fail("breedingSourceAliases.entries", "canonical ID가 중복됩니다.");
  }
  return {
    schemaVersion: 1,
    release: PALWORLD_BREEDING_SOURCE_ALIAS_RELEASE,
    sourceRevision: "24181105",
    sourceMember,
    sourceSha256,
    entries
  };
}

export async function loadPalworldBreedingSourceAliasSource(): Promise<{
  artifact: PalworldBreedingSourceAliasArtifact;
  bytes: Buffer;
}> {
  const resolved = path.resolve(PALWORLD_BREEDING_SOURCE_ALIAS_FILE);
  const info = await lstat(resolved);
  if (
    info.isSymbolicLink()
    || !info.isFile()
    || info.size < 1
    || info.size > MAX_ARTIFACT_BYTES
    || await realpath(resolved) !== resolved
  ) {
    fail(
      "breedingSourceAliases",
      "mapping은 symlink가 아닌 canonical regular file이어야 합니다."
    );
  }
  const bytes = await readFile(resolved);
  return {
    artifact: assertPalworldBreedingSourceAliasArtifact(
      JSON.parse(bytes.toString("utf8")) as unknown
    ),
    bytes
  };
}

export async function loadPalworldBreedingSourceAliases(): Promise<
  PalworldBreedingSourceAliasArtifact
> {
  return (await loadPalworldBreedingSourceAliasSource()).artifact;
}

export function createPalworldBreedingSourceAliasResolver(input: {
  artifact: PalworldBreedingSourceAliasArtifact;
  sourceInternalIds: ReadonlySet<string>;
  canonicalInternalIds: ReadonlySet<string>;
}): BreedingSourceAliasResolver {
  const aliases = new Map<string, string>();
  for (const entry of input.artifact.entries) {
    if (!input.sourceInternalIds.has(entry.sourceInternalId)) {
      fail(
        `breedingSourceAliases.entries.${entry.sourceInternalId}`,
        "고정 breeding source에서 사용되지 않는 alias입니다."
      );
    }
    if (input.canonicalInternalIds.has(entry.sourceInternalId)) {
      fail(
        `breedingSourceAliases.entries.${entry.sourceInternalId}`,
        "이미 canonical인 source ID를 덮어쓸 수 없습니다."
      );
    }
    if (!input.canonicalInternalIds.has(entry.canonicalInternalId)) {
      fail(
        `breedingSourceAliases.entries.${entry.sourceInternalId}`,
        "존재하지 않는 canonical Pal을 참조합니다."
      );
    }
    aliases.set(entry.sourceInternalId, entry.canonicalInternalId);
  }
  return {
    resolve(sourceInternalId) {
      return aliases.get(sourceInternalId) ?? sourceInternalId;
    },
    has(sourceInternalId) {
      return aliases.has(sourceInternalId);
    },
    entries: input.artifact.entries
  };
}
