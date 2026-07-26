import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import type { PalworldTranslationOfficialSourceField } from "@streamops/shared";
import {
  assertPalworldActiveSkillLocaleEvidenceArtifact,
  assertPalworldPassiveSkillLocaleEvidenceArtifact,
  assertPalworldOfficialLocaleCompatibilityArtifact,
  assertPalworldOfficialLocaleManifest,
  assertPalworldOfficialLocaleSourceFieldsArtifact,
  serializePalworldOfficialLocaleOverlayArtifact,
  type PalworldActiveSkillLocaleEvidence,
  type PalworldPassiveSkillLocaleEvidence,
  type PalworldOfficialLocaleCompatibilityArtifact,
  type PalworldOfficialLocaleSourceFieldsArtifact,
} from "./palworld-official-locale-overlay.js";

export const PALWORLD_OFFICIAL_LOCALE_SOURCE_FIELDS_FILE =
  "locales/official-source-fields.json";
export const PALWORLD_OFFICIAL_LOCALE_COMPATIBILITY_FILE =
  "locales/official-locale-compatibility.json";
export const PALWORLD_ACTIVE_SKILL_LOCALE_EVIDENCE_FILE =
  "locales/official-active-skill-evidence.json";
export const PALWORLD_PASSIVE_SKILL_LOCALE_EVIDENCE_FILE =
  "locales/official-passive-skill-evidence.json";

const OFFICIAL_LOCALE_FILES = {
  ko: "locales/ko.json",
  ja: "locales/ja.json",
  manifest: "locales/manifest.json",
} as const;

const MAX_OFFICIAL_SOURCE_FIELDS_BYTES = 64 * 1024 * 1024;
const MAX_COMPATIBILITY_BYTES = 512 * 1024;
const MAX_ACTIVE_SKILL_EVIDENCE_BYTES = 16 * 1024 * 1024;
const MAX_PASSIVE_SKILL_EVIDENCE_BYTES = 8 * 1024 * 1024;
const MAX_LOCALE_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 128 * 1024;

export type PalworldOfficialLocaleRuntimeOverlay = {
  officialSourceFields: readonly PalworldTranslationOfficialSourceField[];
  sourceArtifact: PalworldOfficialLocaleSourceFieldsArtifact;
  activeSkillEvidence?: PalworldActiveSkillLocaleEvidence;
  passiveSkillEvidence?: PalworldPassiveSkillLocaleEvidence;
  compatibility: PalworldOfficialLocaleCompatibilityArtifact;
};

export class PalworldOfficialLocaleRuntimeError extends Error {
  readonly code = "PALWORLD_OFFICIAL_LOCALE_RUNTIME_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldOfficialLocaleRuntimeError";
  }
}

function fail(pathName: string, message: string): never {
  throw new PalworldOfficialLocaleRuntimeError(`${pathName}: ${message}`);
}

function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseJson(bytes: Buffer, pathName: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    fail(pathName, "올바른 JSON이어야 합니다.");
  }
}

async function readCanonicalFile(
  releaseRoot: string,
  relativeFile: string,
  maximumBytes: number,
): Promise<Buffer> {
  const filePath = path.resolve(releaseRoot, ...relativeFile.split("/"));
  if (!filePath.startsWith(`${releaseRoot}${path.sep}`)) {
    fail(relativeFile, "release root 밖으로 벗어났습니다.");
  }
  const before = await lstat(filePath);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size < 1
    || before.size > maximumBytes
    || await realpath(filePath) !== filePath
  ) {
    fail(
      relativeFile,
      "symlink가 아닌 안전한 크기의 canonical regular file이어야 합니다.",
    );
  }
  const handle = await open(
    filePath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== before.dev
      || opened.ino !== before.ino
      || opened.size !== before.size
    ) {
      fail(relativeFile, "검증 중 파일이 변경되었습니다.");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      !after.isFile()
      || after.dev !== opened.dev
      || after.ino !== opened.ino
      || after.size !== opened.size
    ) {
      fail(relativeFile, "검증 중 파일이 변경되었습니다.");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function assertCanonicalJsonBytes(
  actual: Buffer,
  serialized: string,
  pathName: string,
): void {
  if (actual.toString("utf8") !== serialized) {
    fail(pathName, "결정적 JSON 직렬화 bytes와 일치해야 합니다.");
  }
}

/**
 * legacy composite schema v4에 checksum으로 고정된 공식 KO/JA overlay만
 * Shared 번역 validator context로 변환합니다.
 *
 * candidate 전체 activation은 허용하지 않으며, exact ID/message key join으로
 * 생성된 `source_provided` 필드만 공개 runtime에 전달합니다.
 */
export async function loadPalworldOfficialLocaleRuntimeOverlay(input: {
  releaseRoot: string;
  expectedRelease: string;
  expectedCatalogSha256: string;
  expectedPaldexSha256: string;
  expectedSourceRevision: string;
}): Promise<PalworldOfficialLocaleRuntimeOverlay> {
  const releaseRoot = path.resolve(input.releaseRoot);
  const [
    sourceFieldsBytes,
    compatibilityBytes,
    koBytes,
    jaBytes,
    manifestBytes,
  ] = await Promise.all([
    readCanonicalFile(
      releaseRoot,
      PALWORLD_OFFICIAL_LOCALE_SOURCE_FIELDS_FILE,
      MAX_OFFICIAL_SOURCE_FIELDS_BYTES,
    ),
    readCanonicalFile(
      releaseRoot,
      PALWORLD_OFFICIAL_LOCALE_COMPATIBILITY_FILE,
      MAX_COMPATIBILITY_BYTES,
    ),
    readCanonicalFile(
      releaseRoot,
      OFFICIAL_LOCALE_FILES.ko,
      MAX_LOCALE_BYTES,
    ),
    readCanonicalFile(
      releaseRoot,
      OFFICIAL_LOCALE_FILES.ja,
      MAX_LOCALE_BYTES,
    ),
    readCanonicalFile(
      releaseRoot,
      OFFICIAL_LOCALE_FILES.manifest,
      MAX_MANIFEST_BYTES,
    ),
  ]);

  const sourceArtifact = assertPalworldOfficialLocaleSourceFieldsArtifact(
    parseJson(sourceFieldsBytes, PALWORLD_OFFICIAL_LOCALE_SOURCE_FIELDS_FILE),
  );
  assertCanonicalJsonBytes(
    sourceFieldsBytes,
    serializePalworldOfficialLocaleOverlayArtifact(sourceArtifact),
    PALWORLD_OFFICIAL_LOCALE_SOURCE_FIELDS_FILE,
  );

  const manifest = assertPalworldOfficialLocaleManifest(
    parseJson(manifestBytes, OFFICIAL_LOCALE_FILES.manifest),
  );
  assertCanonicalJsonBytes(
    manifestBytes,
    serializePalworldOfficialLocaleOverlayArtifact(manifest),
    OFFICIAL_LOCALE_FILES.manifest,
  );

  const compatibilityValue = parseJson(
    compatibilityBytes,
    PALWORLD_OFFICIAL_LOCALE_COMPATIBILITY_FILE,
  );
  const compatibilityIdentity =
    assertPalworldOfficialLocaleCompatibilityArtifact(compatibilityValue);
  let activeSkillEvidence:
    | PalworldActiveSkillLocaleEvidence
    | undefined;
  let activeSkillEvidenceBytes: Buffer | undefined;
  if (
    compatibilityIdentity.outputs.activeSkillEvidenceSha256 !== undefined
  ) {
    activeSkillEvidenceBytes = await readCanonicalFile(
      releaseRoot,
      PALWORLD_ACTIVE_SKILL_LOCALE_EVIDENCE_FILE,
      MAX_ACTIVE_SKILL_EVIDENCE_BYTES,
    );
    activeSkillEvidence = assertPalworldActiveSkillLocaleEvidenceArtifact(
      parseJson(
        activeSkillEvidenceBytes,
        PALWORLD_ACTIVE_SKILL_LOCALE_EVIDENCE_FILE,
      ),
    );
    assertCanonicalJsonBytes(
      activeSkillEvidenceBytes,
      serializePalworldOfficialLocaleOverlayArtifact(activeSkillEvidence),
      PALWORLD_ACTIVE_SKILL_LOCALE_EVIDENCE_FILE,
    );
  }
  let passiveSkillEvidence:
    | PalworldPassiveSkillLocaleEvidence
    | undefined;
  let passiveSkillEvidenceBytes: Buffer | undefined;
  if (
    compatibilityIdentity.outputs.passiveSkillEvidenceSha256 !== undefined
  ) {
    passiveSkillEvidenceBytes = await readCanonicalFile(
      releaseRoot,
      PALWORLD_PASSIVE_SKILL_LOCALE_EVIDENCE_FILE,
      MAX_PASSIVE_SKILL_EVIDENCE_BYTES,
    );
    passiveSkillEvidence = assertPalworldPassiveSkillLocaleEvidenceArtifact(
      parseJson(
        passiveSkillEvidenceBytes,
        PALWORLD_PASSIVE_SKILL_LOCALE_EVIDENCE_FILE,
      ),
    );
    assertCanonicalJsonBytes(
      passiveSkillEvidenceBytes,
      serializePalworldOfficialLocaleOverlayArtifact(passiveSkillEvidence),
      PALWORLD_PASSIVE_SKILL_LOCALE_EVIDENCE_FILE,
    );
  }
  const compatibility =
    assertPalworldOfficialLocaleCompatibilityArtifact(
      compatibilityValue,
      {
        officialSourceFields: sourceFieldsBytes,
        ...(activeSkillEvidenceBytes === undefined
          ? {}
          : { activeSkillEvidence: activeSkillEvidenceBytes }),
        ...(passiveSkillEvidenceBytes === undefined
          ? {}
          : { passiveSkillEvidence: passiveSkillEvidenceBytes }),
        ko: koBytes,
        ja: jaBytes,
        manifest: manifestBytes,
      },
    );
  assertCanonicalJsonBytes(
    compatibilityBytes,
    serializePalworldOfficialLocaleOverlayArtifact(compatibility),
    PALWORLD_OFFICIAL_LOCALE_COMPATIBILITY_FILE,
  );

  if (
    sourceArtifact.release !== input.expectedRelease
    || compatibility.release !== input.expectedRelease
    || manifest.release !== input.expectedRelease
  ) {
    fail("release", "active legacy release와 일치해야 합니다.");
  }
  if (
    sourceArtifact.sourceCatalogSha256 !== input.expectedCatalogSha256
    || compatibility.inputs.active.catalogSha256
      !== input.expectedCatalogSha256
    || manifest.sourceCatalogSha256 !== input.expectedCatalogSha256
  ) {
    fail("sourceCatalogSha256", "active catalog checksum과 일치해야 합니다.");
  }
  if (
    sourceArtifact.sourcePaldexSha256 !== input.expectedPaldexSha256
    || compatibility.inputs.active.paldexSha256 !== input.expectedPaldexSha256
    || manifest.sourcePaldexSha256 !== input.expectedPaldexSha256
  ) {
    fail("sourcePaldexSha256", "active Paldex checksum과 일치해야 합니다.");
  }
  if (
    compatibility.inputs.active.sourceRevision
      !== input.expectedSourceRevision
    || manifest.sourceRevision !== input.expectedSourceRevision
  ) {
    fail("sourceRevision", "active catalog source revision과 일치해야 합니다.");
  }
  if (
    sourceArtifact.candidateId !== compatibility.inputs.candidate.candidateId
  ) {
    fail("candidateId", "공식 source field와 compatibility candidate가 다릅니다.");
  }
  if (
    sourceArtifact.candidateLocaleSha256.ko
      !== compatibility.inputs.candidate.artifactSha256.localeKo
    || sourceArtifact.candidateLocaleSha256.ja
      !== compatibility.inputs.candidate.artifactSha256.localeJa
  ) {
    fail(
      "candidateLocaleSha256",
      "공식 source field와 candidate locale checksum이 일치해야 합니다.",
    );
  }
  if (
    manifest.glossarySha256
      !== compatibility.inputs.active.glossarySha256
  ) {
    fail("glossarySha256", "검증된 active glossary checksum과 일치해야 합니다.");
  }
  if (activeSkillEvidence !== undefined) {
    const evidenceSkillIds = activeSkillEvidence.entries.map(
      (entry) => entry.legacySkillId,
    );
    const sourceSkillIds = [...new Set(
      sourceArtifact.records
        .filter((record) =>
          record.kind === "skill" && record.id.startsWith("active-"))
        .map((record) => record.id),
    )].sort((left, right) => left.localeCompare(right, "en"));
    if (
      activeSkillEvidence.release !== input.expectedRelease
      || activeSkillEvidence.candidateId
        !== compatibility.inputs.candidate.candidateId
      || activeSkillEvidence.inputs.activeCatalogSha256
        !== input.expectedCatalogSha256
      || activeSkillEvidence.inputs.candidateSkillsSha256
        !== compatibility.inputs.candidate.artifactSha256.skills
      || activeSkillEvidence.inputs.candidateImportReportSha256
        !== compatibility.inputs.candidate.artifactSha256.importReport
      || activeSkillEvidence.inputs.sourceArchiveSha256
        !== compatibility.inputs.candidate.archive.sha256
      || activeSkillEvidence.inputs.mappingSha256
        !== compatibility.inputs.candidate.activeSkillLocaleMapSha256
      || JSON.stringify(evidenceSkillIds) !== JSON.stringify(sourceSkillIds)
    ) {
      fail(
        "activeSkillEvidence",
        "공식 액티브 스킬 evidence와 active/candidate 입력이 일치해야 합니다.",
      );
    }
  }
  if (passiveSkillEvidence !== undefined) {
    const evidenceSkillIds = passiveSkillEvidence.entries.map(
      (entry) => entry.legacySkillId,
    );
    const sourceSkillIds = [...new Set(
      sourceArtifact.records
        .filter((record) =>
          record.kind === "skill"
          && record.id.startsWith("passive-")
          && record.field === "name")
        .map((record) => record.id),
    )].sort((left, right) => left.localeCompare(right, "en"));
    if (
      passiveSkillEvidence.release !== input.expectedRelease
      || passiveSkillEvidence.candidateId
        !== compatibility.inputs.candidate.candidateId
      || passiveSkillEvidence.inputs.activeCatalogSha256
        !== input.expectedCatalogSha256
      || passiveSkillEvidence.inputs.candidateSkillsSha256
        !== compatibility.inputs.candidate.artifactSha256.skills
      || passiveSkillEvidence.inputs.candidateImportReportSha256
        !== compatibility.inputs.candidate.artifactSha256.importReport
      || passiveSkillEvidence.inputs.sourceArchiveSha256
        !== compatibility.inputs.candidate.archive.sha256
      || passiveSkillEvidence.inputs.mappingSha256
        !== compatibility.inputs.candidate.passiveSkillLocaleMapSha256
      || JSON.stringify(evidenceSkillIds) !== JSON.stringify(sourceSkillIds)
    ) {
      fail(
        "passiveSkillEvidence",
        "공식 패시브 스킬 evidence와 active/candidate 입력이 일치해야 합니다.",
      );
    }
  }
  if (
    manifest.translationRevision
      !== compatibility.outputs.translationRevision
    || manifest.generatedAt !== compatibility.reviewedAt
  ) {
    fail(
      "translationRevision",
      "compatibility의 revision·검수 시각과 locale manifest가 일치해야 합니다.",
    );
  }
  if (
    manifest.locales.ko.file !== "ko.json"
    || manifest.locales.ja.file !== "ja.json"
    || manifest.locales.ko.sha256 !== sha256(koBytes)
    || manifest.locales.ja.sha256 !== sha256(jaBytes)
    || manifest.locales.ko.sha256
      !== compatibility.outputs.localeSha256.ko
    || manifest.locales.ja.sha256
      !== compatibility.outputs.localeSha256.ja
    || compatibility.outputs.officialSourceFieldsSha256
      !== sha256(sourceFieldsBytes)
    || compatibility.outputs.manifestSha256 !== sha256(manifestBytes)
  ) {
    fail(
      "outputs",
      "locale manifest와 compatibility output checksum이 실제 bytes와 일치해야 합니다.",
    );
  }

  const officialSourceFields = sourceArtifact.records.map(
    (record): PalworldTranslationOfficialSourceField => ({
      locale: record.locale,
      kind: record.kind,
      id: record.id,
      field: record.field,
      messageKey: record.messageKey,
      text: record.text,
      textSha256: record.textSha256,
      sourceMember: record.sourceMember,
      sourceMemberSha256: record.sourceMemberSha256,
    }),
  );

  return Object.freeze({
    officialSourceFields: Object.freeze(officialSourceFields),
    sourceArtifact,
    ...(activeSkillEvidence === undefined ? {} : { activeSkillEvidence }),
    ...(passiveSkillEvidence === undefined ? {} : { passiveSkillEvidence }),
    compatibility,
  });
}
