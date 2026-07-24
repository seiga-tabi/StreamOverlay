import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import path from "node:path";
import yauzl, { type Entry, type ZipFile } from "yauzl";

const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ENTRY_COUNT = 10_000;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_MEMBER_BYTES = 64 * 1024 * 1024;
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 500;
const ALLOWED_FILE_EXTENSIONS = new Set([
  ".json",
  ".png",
  ".hdr",
  ".usmap",
  ".uasset",
  ".uexp",
  ".ubulk",
  ".uptnl"
]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:/u;
const KOREAN_CHARACTER_PATTERN = /[\uac00-\ud7a3]/u;
const JAPANESE_CHARACTER_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/u;
const ENGLISH_CHARACTER_PATTERN = /[A-Za-z]/u;

const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const REQUIRED_TABLES = [
  "Pal/DataTable/Character/DT_PalMonsterParameter_Common.json",
  "Pal/DataTable/Character/DT_PalBPClass_Common.json",
  "Pal/DataTable/Character/DT_PalCharacterIconDataTable_Common.json",
  "Pal/DataTable/Character/DT_PalDropItem_Common.json",
  "Pal/DataTable/Character/DT_PalCombiUnique.json",
  "Pal/DataTable/Item/DT_ItemDataTable_Common.json",
  "Pal/DataTable/Item/DT_ItemIconDataTable_Common.json",
  "Pal/DataTable/Item/DT_ItemRecipeDataTable_Common.json",
  "Pal/DataTable/Technology/DT_TechnologyRecipeUnlock_Common.json",
  "Pal/DataTable/Waza/DT_WazaDataTable_Common.json",
  "Pal/DataTable/Waza/DT_WazaMasterLevel_Common.json",
  "Pal/DataTable/Waza/DT_WazaMasterTamago.json",
  "Pal/DataTable/PassiveSkill/DT_PassiveSkill_Main_Common.json",
  "Pal/DataTable/PartnerSkill/DT_PartnerSkill.json",
  "Pal/DataTable/Text/DT_PalNameText_Common.json",
  "Pal/DataTable/Text/DT_PalLongDescriptionText.json",
  "Pal/DataTable/Text/DT_ItemNameText_Common.json",
  "Pal/DataTable/Text/DT_ItemDescriptionText_Common.json",
  "Pal/DataTable/Text/DT_SkillNameText_Common.json",
  "Pal/DataTable/Text/DT_SkillDescText_Common.json",
  "L10N/ko/Pal/DataTable/Text/DT_PalNameText_Common.json",
  "L10N/ko/Pal/DataTable/Text/DT_PalLongDescriptionText.json",
  "L10N/ko/Pal/DataTable/Text/DT_ItemNameText_Common.json",
  "L10N/ko/Pal/DataTable/Text/DT_ItemDescriptionText_Common.json",
  "L10N/ko/Pal/DataTable/Text/DT_SkillNameText_Common.json",
  "L10N/ko/Pal/DataTable/Text/DT_SkillDescText_Common.json",
  "L10N/en/Pal/DataTable/Text/DT_PalNameText_Common.json",
  "L10N/en/Pal/DataTable/Text/DT_PalLongDescriptionText.json",
  "L10N/en/Pal/DataTable/Text/DT_ItemNameText_Common.json",
  "L10N/en/Pal/DataTable/Text/DT_ItemDescriptionText_Common.json",
  "L10N/en/Pal/DataTable/Text/DT_SkillNameText_Common.json",
  "L10N/en/Pal/DataTable/Text/DT_SkillDescText_Common.json"
] as const;

const METADATA_MEMBERS = [
  "palworld-export-metadata.json",
  "metadata/palworld-export.json"
] as const;

type JsonRecord = Record<string, unknown>;

type IndexedZipEntry = {
  entry: Entry;
  isDirectory: boolean;
};

export type PalworldPakExportMetadata = {
  schemaVersion: 1;
  sourceType: "operator_pak_export";
  gameVersion: string;
  steamBuildId: string;
  fmodelVersion: string;
  exportedAt: string;
  mappingsSha256: string;
};

export type PalworldPakPreflightReport = {
  schemaVersion: 1;
  archive: {
    sha256: string;
    bytes: number;
    fileCount: number;
    directoryCount: number;
    uncompressedBytes: number;
    extensionCounts: Record<string, number>;
    crcVerifiedFiles: number;
    parsedJsonFiles: number;
    rawPackageCounts: {
      uasset: number;
      uexp: number;
      ubulk: number;
      uptnl: number;
    };
    missingRawPackageCompanions: string[];
  };
  metadata: {
    status: "provided" | "not_provided";
    sourceType: "operator_pak_export" | "not_provided";
    gameVersion: string;
    steamBuildId: string;
    fmodelVersion: string;
    exportedAt: string;
    mappingsSha256: string;
  };
  mappings: {
    status: "provided" | "not_provided";
    actualSha256: string;
    declaredSha256: string;
    matchesMetadata: boolean;
  };
  data: {
    rawPalRows: number;
    canonicalPals: number;
    normalPals: number;
    variantPals: number;
    duplicatePalRowsExcluded: number;
    totalItemRows: number;
    legalItems: number;
    activeSkillRows: number;
    passiveSkillRows: number;
    specialBreedingRows: number;
  };
  localization: {
    baseTextLanguage: "ja" | "unknown";
    koTextLanguage: "ko" | "unknown";
    enTextLanguage: "en" | "unknown";
    enRequirement: "required" | "optional";
    jaMembers: number;
    koMembers: number;
    enMembers: number;
  };
  assets: {
    palIcons: {
      referenced: number;
      exactMatches: number;
      missing: string[];
      sourceTableReferenced: number;
      sourceTableExactMatches: number;
      sourceTableMissing: string[];
    };
    itemIcons: {
      referenced: number;
      exactMatches: number;
      missingIconRows: number;
      missingRoots: Record<string, number>;
    };
    elementIcons: number;
    workIcons: number;
    skillIcons: number;
    worldMapImages: number;
  };
  requiredTables: {
    present: number;
    missing: string[];
  };
  gates: {
    archiveStructure: "passed";
    requiredTables: "passed" | "blocked";
    metadata: "passed" | "blocked";
    mappings: "passed" | "blocked";
    officialKo: "passed" | "blocked";
    officialJa: "passed" | "blocked";
    officialEn: "passed" | "blocked" | "not_required";
    palImages: "passed" | "blocked";
    itemImages: "passed" | "blocked";
    inputPrerequisitesSatisfied: boolean;
    activationValidationRequired: true;
    blockers: string[];
  };
};

export type PalworldPakPreflightPolicy = {
  /**
   * 공개 UI가 KO/JA만 제공하는 release에서 EN 원문을 필수 activation 조건에서 제외합니다.
   * 기본값은 기존 동작과 동일한 required입니다.
   */
  officialEnLocale?: "required" | "optional";
};

export class PalworldPakPreflightError extends Error {
  readonly code = "PALWORLD_PAK_PREFLIGHT_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "PalworldPakPreflightError";
  }
}

export type PalworldPakArchiveMember = {
  name: string;
  compressedBytes: number;
  uncompressedBytes: number;
};

export type PalworldPakArchiveReader = {
  archiveSha256: string;
  archiveBytes: number;
  sourceArchives: readonly {
    role: "primary" | "asset_overlay";
    sha256: string;
    bytes: number;
  }[];
  members: readonly PalworldPakArchiveMember[];
  has(memberName: string): boolean;
  readBytes(memberName: string, maxBytes?: number): Promise<Buffer>;
  readJson(memberName: string): Promise<unknown>;
  readDataTable(memberName: string): Promise<Record<string, unknown>>;
};

export type PalworldPakArchiveReadOptions = {
  expectedSha256?: string;
  /**
   * 기본 archive 제한은 그대로 유지합니다. 512 MiB를 넘는 운영자 asset overlay는
   * 고정 SHA-256이 제공된 경우에만 별도 profile로 열 수 있습니다.
   */
  profile?: "standard" | "fixed_asset_overlay";
};

export type PalworldPakArchiveOverlaySource = {
  archivePath: string;
  expectedSha256: string;
};

type ArchiveLimits = {
  maximumArchiveBytes: number;
  maximumEntryCount: number;
  maximumUncompressedBytes: number;
  maximumMemberBytes: number;
};

const STANDARD_ARCHIVE_LIMITS: ArchiveLimits = Object.freeze({
  maximumArchiveBytes: MAX_ARCHIVE_BYTES,
  maximumEntryCount: MAX_ENTRY_COUNT,
  maximumUncompressedBytes: MAX_UNCOMPRESSED_BYTES,
  maximumMemberBytes: MAX_MEMBER_BYTES
});

const FIXED_ASSET_OVERLAY_LIMITS: ArchiveLimits = Object.freeze({
  maximumArchiveBytes: 3 * 1024 * 1024 * 1024,
  maximumEntryCount: MAX_ENTRY_COUNT,
  maximumUncompressedBytes: 3 * 1024 * 1024 * 1024,
  maximumMemberBytes: MAX_MEMBER_BYTES
});

function fail(message: string): never {
  throw new PalworldPakPreflightError(message);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, maxLength = 256): string {
  if (
    typeof value !== "string"
    || value.trim().length === 0
    || value.trim() !== value
    || value.length > maxLength
    || CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    fail(`${field}: 비어 있지 않은 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function requiredIsoDate(value: unknown, field: string): string {
  const text = requiredString(value, field, 64);
  if (Number.isNaN(Date.parse(text))) fail(`${field}: 올바른 ISO 날짜여야 합니다.`);
  return text;
}

function requiredSha256(value: unknown, field: string): string {
  const text = requiredString(value, field, 64);
  if (!/^[a-f0-9]{64}$/u.test(text)) fail(`${field}: 소문자 64자리 SHA-256이어야 합니다.`);
  return text;
}

export function validatePalworldPakMemberName(memberName: string): string {
  if (
    memberName.length === 0
    || memberName.length > 1_024
    || memberName.startsWith("/")
    || memberName.startsWith("\\")
    || memberName.includes("\\")
    || WINDOWS_DRIVE_PATTERN.test(memberName)
    || CONTROL_CHARACTER_PATTERN.test(memberName)
  ) {
    fail(`ZIP member 경로가 안전하지 않습니다: ${JSON.stringify(memberName)}`);
  }
  const normalized = path.posix.normalize(memberName);
  if (
    normalized !== memberName
    || memberName.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    fail(`ZIP member path traversal이 감지되었습니다: ${JSON.stringify(memberName)}`);
  }
  return memberName;
}

function zipEntryMode(entry: Entry): number {
  return (entry.externalFileAttributes >>> 16) & 0xffff;
}

function zipEntryKind(entry: Entry): number {
  return zipEntryMode(entry) & 0o170000;
}

function assertSafeEntry(entry: Entry, limits: ArchiveLimits): boolean {
  const name = validatePalworldPakMemberName(entry.fileName);
  const isDirectory = name.endsWith("/");
  if ((entry.generalPurposeBitFlag & 0x1) !== 0) fail(`암호화 ZIP member는 허용하지 않습니다: ${name}`);
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
    fail(`허용되지 않은 ZIP 압축 방식입니다: ${name}`);
  }
  const kind = zipEntryKind(entry);
  if (kind === 0o120000) fail(`symlink ZIP member는 허용하지 않습니다: ${name}`);
  if (kind !== 0 && kind !== 0o100000 && kind !== 0o040000) {
    fail(`일반 파일·디렉터리가 아닌 ZIP member는 허용하지 않습니다: ${name}`);
  }
  if (entry.uncompressedSize > limits.maximumMemberBytes) {
    fail(`ZIP member가 너무 큽니다: ${name}`);
  }
  if (
    entry.compressedSize > 0
    && entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO
  ) {
    fail(`ZIP member 압축률이 안전 제한을 초과합니다: ${name}`);
  }
  if (!isDirectory) {
    const extension = path.posix.extname(name).toLocaleLowerCase("en-US");
    if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
      fail(`허용되지 않은 ZIP member 확장자입니다: ${name}`);
    }
  }
  return isDirectory;
}

function openZip(fileDescriptor: number): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromFd(
      fileDescriptor,
      {
        autoClose: false,
        decodeStrings: true,
        lazyEntries: true,
        strictFileNames: true,
        validateEntrySizes: true
      },
      (error, zipFile) => {
        if (error || !zipFile) reject(error ?? new Error("ZIP을 열 수 없습니다."));
        else resolve(zipFile);
      }
    );
  });
}

type SecureArchiveHandle = {
  handle: FileHandle;
  zipFile: ZipFile;
  bytes: number;
  sha256: string;
};

async function sha256FileHandle(handle: FileHandle, bytes: number): Promise<string> {
  const hash = createHash("sha256");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  let offset = 0;
  while (offset < bytes) {
    const result = await handle.read(
      chunk,
      0,
      Math.min(chunk.length, bytes - offset),
      offset
    );
    if (result.bytesRead <= 0) fail("PAK export ZIP을 checksum 계산 중 끝까지 읽지 못했습니다.");
    hash.update(chunk.subarray(0, result.bytesRead));
    offset += result.bytesRead;
  }
  return hash.digest("hex");
}

async function openSecureArchive(
  archivePath: string,
  limits: ArchiveLimits
): Promise<SecureArchiveHandle> {
  const resolvedArchive = path.resolve(archivePath);
  const before = await lstat(resolvedArchive);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size <= 0
    || before.size > limits.maximumArchiveBytes
    || await realpath(resolvedArchive) !== resolvedArchive
  ) {
    fail("PAK export ZIP은 symlink가 아닌 안전한 canonical regular file이어야 합니다.");
  }
  const handle = await open(
    resolvedArchive,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== before.dev
      || opened.ino !== before.ino
      || opened.size !== before.size
    ) {
      fail("PAK export ZIP이 검증 중 변경되었습니다.");
    }
    const archiveSha256 = await sha256FileHandle(handle, opened.size);
    const afterHash = await handle.stat();
    if (
      afterHash.dev !== opened.dev
      || afterHash.ino !== opened.ino
      || afterHash.size !== opened.size
      || afterHash.mtimeMs !== opened.mtimeMs
    ) {
      fail("PAK export ZIP이 checksum 검증 중 변경되었습니다.");
    }
    const zipFile = await openZip(handle.fd);
    return {
      handle,
      zipFile,
      bytes: opened.size,
      sha256: archiveSha256
    };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function closeSecureArchive(archive: SecureArchiveHandle): Promise<void> {
  archive.zipFile.close();
  try {
    await archive.handle.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EBADF") throw error;
  }
}

async function indexArchive(
  zipFile: ZipFile,
  limits: ArchiveLimits
): Promise<Map<string, IndexedZipEntry>> {
  return await new Promise((resolve, reject) => {
    const indexed = new Map<string, IndexedZipEntry>();
    const collisionKeys = new Map<string, string>();
    let uncompressedBytes = 0;
    let entryCount = 0;
    const closeWithError = (error: unknown): void => {
      try {
        zipFile.close();
      } catch {
        // 원본 오류를 유지한다.
      }
      reject(error);
    };
    zipFile.on("error", closeWithError);
    zipFile.on("entry", (entry: Entry) => {
      try {
        entryCount += 1;
        if (entryCount > limits.maximumEntryCount) {
          fail("ZIP 파일 수가 안전 제한을 초과합니다.");
        }
        const isDirectory = assertSafeEntry(entry, limits);
        uncompressedBytes += entry.uncompressedSize;
        if (uncompressedBytes > limits.maximumUncompressedBytes) {
          fail("ZIP 전체 압축 해제 크기가 안전 제한을 초과합니다.");
        }
        const collisionKey = entry.fileName.normalize("NFC").toLocaleLowerCase("en-US");
        const collision = collisionKeys.get(collisionKey);
        if (collision !== undefined) {
          fail(`ZIP 경로가 중복되거나 대소문자·Unicode 정규화 충돌이 있습니다: ${collision}, ${entry.fileName}`);
        }
        collisionKeys.set(collisionKey, entry.fileName);
        indexed.set(entry.fileName, { entry, isDirectory });
        zipFile.readEntry();
      } catch (error) {
        closeWithError(error);
      }
    });
    zipFile.on("end", () => resolve(indexed));
    zipFile.readEntry();
  });
}

function readEntry(zipFile: ZipFile, indexed: IndexedZipEntry, maxBytes: number): Promise<Buffer> {
  if (indexed.isDirectory) fail("디렉터리 ZIP member를 파일로 읽을 수 없습니다.");
  if (indexed.entry.uncompressedSize > maxBytes) fail(`${indexed.entry.fileName}: 읽기 제한을 초과합니다.`);
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(indexed.entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error("ZIP member stream을 열 수 없습니다."));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      let runningCrc = 0xffffffff;
      stream.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.destroy(new PalworldPakPreflightError(`${indexed.entry.fileName}: 읽기 제한을 초과했습니다.`));
          return;
        }
        for (const byte of chunk) {
          runningCrc = ZIP_CRC_TABLE[(runningCrc ^ byte) & 0xff]! ^ (runningCrc >>> 8);
        }
        chunks.push(chunk);
      });
      stream.on("error", reject);
      stream.on("end", () => {
        const actualCrc = (runningCrc ^ 0xffffffff) >>> 0;
        if (actualCrc !== (indexed.entry.crc32 >>> 0)) {
          reject(new PalworldPakPreflightError(`${indexed.entry.fileName}: ZIP CRC가 일치하지 않습니다.`));
          return;
        }
        resolve(Buffer.concat(chunks, total));
      });
    });
  });
}

function parseJson(buffer: Buffer, memberName: string): unknown {
  try {
    return JSON.parse(buffer.toString("utf8")) as unknown;
  } catch {
    fail(`${memberName}: JSON을 파싱할 수 없습니다.`);
  }
}

function dataTableRows(value: unknown, memberName: string): JsonRecord {
  if (!Array.isArray(value)) fail(`${memberName}: FModel export 최상위 값은 배열이어야 합니다.`);
  const table = value.find((entry) => isRecord(entry) && isRecord(entry.Rows));
  if (!isRecord(table) || !isRecord(table.Rows)) fail(`${memberName}: DataTable Rows를 찾을 수 없습니다.`);
  return table.Rows;
}

async function readTable(
  zipFile: ZipFile,
  entries: Map<string, IndexedZipEntry>,
  memberName: string
): Promise<JsonRecord> {
  const entry = entries.get(memberName);
  if (!entry) fail(`${memberName}: 필수 DataTable이 없습니다.`);
  return dataTableRows(parseJson(await readEntry(zipFile, entry, MAX_JSON_BYTES), memberName), memberName);
}

function textValue(row: unknown): string | undefined {
  if (!isRecord(row) || !isRecord(row.TextData)) return undefined;
  const candidate = typeof row.TextData.LocalizedString === "string"
    ? row.TextData.LocalizedString
    : row.TextData.SourceString;
  if (
    typeof candidate !== "string"
    || candidate.trim().length === 0
    || candidate.trim() === "-"
    || /^(?:en|ja|ko)_Text$/iu.test(candidate.trim())
  ) {
    return undefined;
  }
  return candidate.trim();
}

function dominantLanguage(rows: JsonRecord, pattern: RegExp): boolean {
  const values = Object.values(rows).flatMap((row) => {
    const value = textValue(row);
    return value === undefined ? [] : [value];
  });
  if (values.length === 0) return false;
  return values.filter((value) => pattern.test(value)).length / values.length >= 0.9;
}

function enumSuffix(value: unknown, field: string): string {
  const text = requiredString(value, field, 128);
  const suffix = text.includes("::") ? text.slice(text.lastIndexOf("::") + 2) : text;
  if (!/^[A-Za-z0-9_]+$/u.test(suffix)) fail(`${field}: 허용되지 않은 enum/internal ID입니다.`);
  return suffix;
}

function assetMember(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.AssetPathName !== "string") return undefined;
  const assetPath = value.AssetPathName;
  if (!assetPath.startsWith("/Game/") || assetPath.includes("\\") || assetPath.includes("..")) return undefined;
  const packagePath = assetPath.slice("/Game/".length).split(".", 1)[0];
  if (!packagePath || !/^[A-Za-z0-9_/-]+$/u.test(packagePath)) return undefined;
  return `${packagePath}.png`;
}

function canonicalPalRows(rows: JsonRecord): {
  raw: Array<{ rowName: string; tribe: string; value: JsonRecord }>;
  canonical: Array<{ rowName: string; tribe: string; value: JsonRecord }>;
} {
  const raw = Object.entries(rows).flatMap(([rowName, value]) => {
    if (!isRecord(value) || value.IsPal !== true || typeof value.ZukanIndex !== "number" || value.ZukanIndex <= 0) {
      return [];
    }
    return [{ rowName, tribe: enumSuffix(value.Tribe, `${rowName}.Tribe`), value }];
  });
  const grouped = new Map<string, typeof raw>();
  for (const row of raw) grouped.set(row.tribe, [...(grouped.get(row.tribe) ?? []), row]);
  const canonical = [...grouped.entries()].map(([tribe, candidates]) => {
    const exact = candidates.find((candidate) => candidate.rowName === tribe);
    const bpClassMatches = candidates.filter((candidate) =>
      typeof candidate.value.BPClass === "string"
      && candidate.rowName === candidate.value.BPClass
    );
    if (exact) return exact;
    if (bpClassMatches.length === 1) return bpClassMatches[0]!;
    fail(`${tribe}: canonical Pal row를 exact ID로 결정할 수 없습니다.`);
  });
  canonical.sort((left, right) => {
    const numberDelta = Number(left.value.ZukanIndex) - Number(right.value.ZukanIndex);
    if (numberDelta !== 0) return numberDelta;
    const leftSuffix = String(left.value.ZukanIndexSuffix ?? "");
    const rightSuffix = String(right.value.ZukanIndexSuffix ?? "");
    return leftSuffix.localeCompare(rightSuffix, "en") || left.rowName.localeCompare(right.rowName, "en");
  });
  return { raw, canonical };
}

function countExtensions(entries: Map<string, IndexedZipEntry>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { entry, isDirectory } of entries.values()) {
    if (isDirectory) continue;
    const extension = path.posix.extname(entry.fileName).toLocaleLowerCase("en-US") || "(none)";
    counts[extension] = (counts[extension] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, "en")));
}

function rawPackageCompanionReport(entries: Map<string, IndexedZipEntry>): {
  counts: PalworldPakPreflightReport["archive"]["rawPackageCounts"];
  missing: string[];
} {
  const counts = { uasset: 0, uexp: 0, ubulk: 0, uptnl: 0 };
  const packages = new Map<string, Set<string>>();
  for (const { entry, isDirectory } of entries.values()) {
    if (isDirectory) continue;
    const extension = path.posix.extname(entry.fileName).slice(1).toLocaleLowerCase("en-US");
    if (!(extension in counts)) continue;
    counts[extension as keyof typeof counts] += 1;
    const base = entry.fileName.slice(0, -(`.${extension}`.length));
    packages.set(base, new Set([...(packages.get(base) ?? []), extension]));
  }
  const missing = [...packages.entries()].flatMap(([base, extensions]) =>
    extensions.has("uasset") && !extensions.has("uexp") ? [`${base}.uexp`] : []
  ).sort((left, right) => left.localeCompare(right, "en"));
  return { counts, missing };
}

function archiveLimitsFor(options: PalworldPakArchiveReadOptions): ArchiveLimits {
  const profile = options.profile ?? "standard";
  if (profile === "fixed_asset_overlay") {
    if (options.expectedSha256 === undefined) {
      fail("대용량 asset overlay는 고정 expectedSha256이 반드시 필요합니다.");
    }
    requiredSha256(options.expectedSha256, "expectedSha256");
    return FIXED_ASSET_OVERLAY_LIMITS;
  }
  return STANDARD_ARCHIVE_LIMITS;
}

/**
 * preflight와 candidate importer가 같은 ZIP 경계 검증을 사용하도록 하는 읽기 전용 진입점입니다.
 * callback이 끝나면 ZIP handle을 항상 닫으며 파일을 압축 해제하거나 실행하지 않습니다.
 */
export async function withPalworldPakArchive<T>(
  archivePath: string,
  options: PalworldPakArchiveReadOptions,
  callback: (reader: PalworldPakArchiveReader) => Promise<T>
): Promise<T> {
  const limits = archiveLimitsFor(options);
  const archive = await openSecureArchive(archivePath, limits);
  const archiveSha256 = archive.sha256;
  if (
    options.expectedSha256 !== undefined
    && requiredSha256(options.expectedSha256, "expectedSha256") !== archiveSha256
  ) {
    await closeSecureArchive(archive);
    fail("PAK export ZIP SHA-256이 고정 입력과 일치하지 않습니다.");
  }

  const zipFile = archive.zipFile;
  try {
    const entries = await indexArchive(zipFile, limits);
    const members = [...entries.values()]
      .filter((indexed) => !indexed.isDirectory)
      .map((indexed) => ({
        name: indexed.entry.fileName,
        compressedBytes: indexed.entry.compressedSize,
        uncompressedBytes: indexed.entry.uncompressedSize
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    const readJsonMember = async (memberName: string): Promise<unknown> => {
      if (path.posix.extname(memberName).toLocaleLowerCase("en-US") !== ".json") {
        fail(`${memberName}: JSON member가 아닙니다.`);
      }
      const indexed = entries.get(memberName);
      if (!indexed || indexed.isDirectory) fail(`${memberName}: JSON member가 없습니다.`);
      return parseJson(await readEntry(zipFile, indexed, MAX_JSON_BYTES), memberName);
    };
    const reader: PalworldPakArchiveReader = {
      archiveSha256,
      archiveBytes: archive.bytes,
      sourceArchives: Object.freeze([{
        role: "primary" as const,
        sha256: archiveSha256,
        bytes: archive.bytes
      }]),
      members,
      has(memberName) {
        validatePalworldPakMemberName(memberName);
        return entries.get(memberName)?.isDirectory === false;
      },
      async readBytes(memberName, maxBytes = MAX_MEMBER_BYTES) {
        validatePalworldPakMemberName(memberName);
        if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_MEMBER_BYTES) {
          fail("ZIP member 읽기 제한이 올바르지 않습니다.");
        }
        const indexed = entries.get(memberName);
        if (!indexed || indexed.isDirectory) fail(`${memberName}: ZIP member 파일이 없습니다.`);
        return await readEntry(zipFile, indexed, maxBytes);
      },
      readJson: readJsonMember,
      async readDataTable(memberName) {
        const value = await readJsonMember(memberName);
        return dataTableRows(value, memberName);
      }
    };
    return await callback(reader);
  } finally {
    await closeSecureArchive(archive);
  }
}

/**
 * 데이터 archive와 별도의 대용량 asset archive를 하나의 read-only view로 결합합니다.
 *
 * 각 overlay는 고정 SHA-256을 필수로 요구합니다. 같은 경로가 여러 archive에 있으면
 * 두 파일의 실제 bytes가 완전히 동일할 때만 허용하므로, delta가 DataTable이나 locale을
 * 조용히 덮어쓸 수 없습니다. 신규 경로만 overlay에서 공급할 수 있습니다.
 */
export async function withPalworldPakArchiveOverlay<T>(
  primary: PalworldPakArchiveOverlaySource,
  overlays: readonly PalworldPakArchiveOverlaySource[],
  callback: (reader: PalworldPakArchiveReader) => Promise<T>
): Promise<T> {
  requiredSha256(primary.expectedSha256, "primary.expectedSha256");
  if (overlays.length > 8) fail("asset overlay archive는 최대 8개까지 허용합니다.");
  const sourceHashes = new Set([primary.expectedSha256]);
  for (const [index, overlay] of overlays.entries()) {
    const hash = requiredSha256(
      overlay.expectedSha256,
      `overlays[${index}].expectedSha256`
    );
    if (sourceHashes.has(hash)) fail("같은 SHA-256 archive를 중복 지정할 수 없습니다.");
    sourceHashes.add(hash);
  }

  const openOverlay = async (
    index: number,
    readers: readonly PalworldPakArchiveReader[]
  ): Promise<T> => {
    if (index >= overlays.length) {
      const providers = new Map<string, PalworldPakArchiveReader>();
      const memberMetadata = new Map<string, PalworldPakArchiveMember>();
      for (const reader of readers) {
        for (const member of reader.members) {
          const previous = providers.get(member.name);
          if (previous !== undefined) {
            const previousMember = memberMetadata.get(member.name)!;
            if (previousMember.uncompressedBytes !== member.uncompressedBytes) {
              fail(`${member.name}: overlay가 기존 member와 다른 크기로 충돌합니다.`);
            }
            const [previousBytes, overlayBytes] = await Promise.all([
              previous.readBytes(member.name),
              reader.readBytes(member.name)
            ]);
            if (!previousBytes.equals(overlayBytes)) {
              fail(`${member.name}: overlay가 기존 member와 다른 내용으로 충돌합니다.`);
            }
          }
          providers.set(member.name, reader);
          memberMetadata.set(member.name, member);
        }
      }
      const members = [...memberMetadata.values()]
        .sort((left, right) => left.name.localeCompare(right.name, "en"));
      const primaryReader = readers[0]!;
      const sourceArchives = readers.map((reader, readerIndex) => ({
        role: readerIndex === 0 ? "primary" as const : "asset_overlay" as const,
        sha256: reader.archiveSha256,
        bytes: reader.archiveBytes
      }));
      const compositeReader: PalworldPakArchiveReader = {
        archiveSha256: primaryReader.archiveSha256,
        archiveBytes: primaryReader.archiveBytes,
        sourceArchives: Object.freeze(sourceArchives),
        members,
        has(memberName) {
          validatePalworldPakMemberName(memberName);
          return providers.has(memberName);
        },
        async readBytes(memberName, maxBytes = MAX_MEMBER_BYTES) {
          validatePalworldPakMemberName(memberName);
          const provider = providers.get(memberName);
          if (provider === undefined) fail(`${memberName}: ZIP member 파일이 없습니다.`);
          return await provider.readBytes(memberName, maxBytes);
        },
        async readJson(memberName) {
          const bytes = await this.readBytes(memberName, MAX_JSON_BYTES);
          return parseJson(bytes, memberName);
        },
        async readDataTable(memberName) {
          return dataTableRows(await this.readJson(memberName), memberName);
        }
      };
      return await callback(compositeReader);
    }
    const overlay = overlays[index]!;
    return await withPalworldPakArchive(
      overlay.archivePath,
      {
        expectedSha256: overlay.expectedSha256,
        profile: "fixed_asset_overlay"
      },
      async (reader) => await openOverlay(index + 1, [...readers, reader])
    );
  };

  return await withPalworldPakArchive(
    primary.archivePath,
    { expectedSha256: primary.expectedSha256 },
    async (reader) => await openOverlay(0, [reader])
  );
}

function parseExportMetadata(value: unknown): PalworldPakExportMetadata {
  if (!isRecord(value)) fail("export metadata는 객체여야 합니다.");
  const allowed = new Set([
    "schemaVersion",
    "sourceType",
    "gameVersion",
    "steamBuildId",
    "fmodelVersion",
    "exportedAt",
    "mappingsSha256"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`export metadata.${key}: 허용되지 않은 필드입니다.`);
  }
  if (value.schemaVersion !== 1) fail("export metadata.schemaVersion: 1이어야 합니다.");
  if (value.sourceType !== "operator_pak_export") {
    fail("export metadata.sourceType: operator_pak_export여야 합니다.");
  }
  const gameVersion = requiredString(value.gameVersion, "export metadata.gameVersion", 64);
  const steamBuildId = requiredString(value.steamBuildId, "export metadata.steamBuildId", 20);
  const fmodelVersion = requiredString(value.fmodelVersion, "export metadata.fmodelVersion", 64);
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/u.test(gameVersion)) {
    fail("export metadata.gameVersion: 고정 semantic version 형식이 아닙니다.");
  }
  if (!/^[1-9][0-9]{0,19}$/u.test(steamBuildId)) {
    fail("export metadata.steamBuildId: 0으로 시작하지 않는 숫자여야 합니다.");
  }
  if (!/^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){1,3}(?:[-+][0-9A-Za-z.-]+)?$/u.test(fmodelVersion)) {
    fail("export metadata.fmodelVersion: 숫자 기반 고정 버전 형식이 아닙니다.");
  }
  return {
    schemaVersion: 1,
    sourceType: "operator_pak_export",
    gameVersion,
    steamBuildId,
    fmodelVersion,
    exportedAt: requiredIsoDate(value.exportedAt, "export metadata.exportedAt"),
    mappingsSha256: requiredSha256(value.mappingsSha256, "export metadata.mappingsSha256")
  };
}

export function assertPalworldPakExportMetadata(value: unknown): PalworldPakExportMetadata {
  return Object.freeze(parseExportMetadata(value));
}

export async function inspectPalworldPakArchive(
  archivePath: string,
  policy: PalworldPakPreflightPolicy = {}
): Promise<PalworldPakPreflightReport> {
  const officialEnRequired = (policy.officialEnLocale ?? "required") === "required";
  const archive = await openSecureArchive(archivePath, STANDARD_ARCHIVE_LIMITS);
  const archiveSha256 = archive.sha256;
  const zipFile = archive.zipFile;
  try {
    const entries = await indexArchive(zipFile, STANDARD_ARCHIVE_LIMITS);
    const files = [...entries.values()].filter((entry) => !entry.isDirectory);
    const directories = entries.size - files.length;
    const uncompressedBytes = files.reduce((total, entry) => total + entry.entry.uncompressedSize, 0);
    let crcVerifiedFiles = 0;
    let parsedJsonFiles = 0;
    for (const indexed of files) {
      const bytes = await readEntry(zipFile, indexed, MAX_MEMBER_BYTES);
      crcVerifiedFiles += 1;
      if (path.posix.extname(indexed.entry.fileName).toLocaleLowerCase("en-US") === ".json") {
        parseJson(bytes, indexed.entry.fileName);
        parsedJsonFiles += 1;
      }
    }
    const requiredTables = officialEnRequired
      ? REQUIRED_TABLES
      : REQUIRED_TABLES.filter((member) => !member.startsWith("L10N/en/"));
    const requiredMissing = requiredTables.filter((member) => !entries.has(member));
    const rawPackages = rawPackageCompanionReport(entries);

    const palRows = await readTable(
      zipFile,
      entries,
      "Pal/DataTable/Character/DT_PalMonsterParameter_Common.json"
    );
    const canonicalPals = canonicalPalRows(palRows);
    const palIconRows = await readTable(
      zipFile,
      entries,
      "Pal/DataTable/Character/DT_PalCharacterIconDataTable_Common.json"
    );
    const itemRows = await readTable(zipFile, entries, "Pal/DataTable/Item/DT_ItemDataTable_Common.json");
    const itemIconRows = await readTable(
      zipFile,
      entries,
      "Pal/DataTable/Item/DT_ItemIconDataTable_Common.json"
    );
    const activeSkillRows = await readTable(
      zipFile,
      entries,
      "Pal/DataTable/Waza/DT_WazaDataTable_Common.json"
    );
    const passiveSkillRows = await readTable(
      zipFile,
      entries,
      "Pal/DataTable/PassiveSkill/DT_PassiveSkill_Main_Common.json"
    );
    const specialBreedingRows = await readTable(
      zipFile,
      entries,
      "Pal/DataTable/Character/DT_PalCombiUnique.json"
    );
    const basePalNameRows = await readTable(
      zipFile,
      entries,
      "Pal/DataTable/Text/DT_PalNameText_Common.json"
    );
    const koPalNameRows = await readTable(
      zipFile,
      entries,
      "L10N/ko/Pal/DataTable/Text/DT_PalNameText_Common.json"
    );

    const palMissing: string[] = [];
    let exactPalIcons = 0;
    for (const pal of canonicalPals.canonical) {
      const iconRow = palIconRows[pal.tribe] ?? palIconRows[pal.rowName];
      const member = isRecord(iconRow) ? assetMember(iconRow.Icon) : undefined;
      if (member !== undefined && entries.has(member)) exactPalIcons += 1;
      else palMissing.push(pal.rowName);
    }
    const palIconSourceTableMissing: string[] = [];
    let palIconSourceTableReferenced = 0;
    let palIconSourceTableExactMatches = 0;
    for (const [sourceRowId, rawIconRow] of Object.entries(palIconRows)) {
      if (!isRecord(rawIconRow)) continue;
      const member = assetMember(rawIconRow.Icon);
      if (member === undefined) continue;
      palIconSourceTableReferenced += 1;
      if (entries.has(member)) palIconSourceTableExactMatches += 1;
      else palIconSourceTableMissing.push(sourceRowId);
    }

    let legalItems = 0;
    let referencedItemIcons = 0;
    let exactItemIcons = 0;
    let missingItemIconRows = 0;
    const missingItemRoots = new Map<string, number>();
    for (const value of Object.values(itemRows)) {
      if (!isRecord(value) || value.bLegalInGame !== true) continue;
      legalItems += 1;
      if (typeof value.IconName !== "string") {
        missingItemIconRows += 1;
        continue;
      }
      const iconRow = itemIconRows[value.IconName];
      if (!isRecord(iconRow)) {
        missingItemIconRows += 1;
        continue;
      }
      const member = assetMember(iconRow.Icon);
      if (!member) {
        missingItemIconRows += 1;
        continue;
      }
      referencedItemIcons += 1;
      if (entries.has(member)) {
        exactItemIcons += 1;
      } else {
        const root = member.split("/").slice(0, 3).join("/");
        missingItemRoots.set(root, (missingItemRoots.get(root) ?? 0) + 1);
      }
    }

    const baseTextLanguage = dominantLanguage(basePalNameRows, JAPANESE_CHARACTER_PATTERN)
      ? "ja"
      : "unknown";
    const koTextLanguage = dominantLanguage(koPalNameRows, KOREAN_CHARACTER_PATTERN)
      ? "ko"
      : "unknown";
    const fileMembers = [...entries.values()]
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.entry.fileName);
    const jaMembers = fileMembers.filter((member) => member.startsWith("L10N/ja/")).length;
    const koMembers = fileMembers.filter((member) => member.startsWith("L10N/ko/")).length;
    const enMembers = fileMembers.filter((member) => member.startsWith("L10N/en/")).length;
    const enPalNameMember = "L10N/en/Pal/DataTable/Text/DT_PalNameText_Common.json";
    const enTextLanguage = entries.has(enPalNameMember)
      ? dominantLanguage(
        await readTable(zipFile, entries, enPalNameMember),
        ENGLISH_CHARACTER_PATTERN
      )
        ? "en"
        : "unknown"
      : "unknown";

    const metadataEntryName = METADATA_MEMBERS.find((member) => entries.has(member));
    const exportMetadata = metadataEntryName === undefined
      ? undefined
      : parseExportMetadata(parseJson(
        await readEntry(zipFile, entries.get(metadataEntryName)!, MAX_JSON_BYTES),
        metadataEntryName
      ));
    const mappingsMemberName = "Mappings.usmap";
    const mappingsEntry = entries.get(mappingsMemberName);
    const actualMappingsSha256 = mappingsEntry === undefined
      ? undefined
      : createHash("sha256")
        .update(await readEntry(zipFile, mappingsEntry, MAX_MEMBER_BYTES))
        .digest("hex");
    const metadata = exportMetadata === undefined
      ? {
          status: "not_provided" as const,
          sourceType: "not_provided" as const,
          gameVersion: "not_provided",
          steamBuildId: "not_provided",
          fmodelVersion: "not_provided",
          exportedAt: "not_provided",
          mappingsSha256: "not_provided"
        }
      : {
          status: "provided" as const,
          sourceType: exportMetadata.sourceType,
          gameVersion: exportMetadata.gameVersion,
          steamBuildId: exportMetadata.steamBuildId,
          fmodelVersion: exportMetadata.fmodelVersion,
          exportedAt: exportMetadata.exportedAt,
          mappingsSha256: exportMetadata.mappingsSha256
        };
    const mappings = {
      status: actualMappingsSha256 === undefined ? "not_provided" as const : "provided" as const,
      actualSha256: actualMappingsSha256 ?? "not_provided",
      declaredSha256: exportMetadata?.mappingsSha256 ?? "not_provided",
      matchesMetadata: actualMappingsSha256 !== undefined
        && exportMetadata !== undefined
        && actualMappingsSha256 === exportMetadata.mappingsSha256
    };

    const blockers: string[] = [];
    if (requiredMissing.length > 0) blockers.push("REQUIRED_DATATABLE_MISSING");
    if (metadata.status !== "provided") blockers.push("EXPORT_METADATA_NOT_PROVIDED");
    if (mappings.status !== "provided") blockers.push("MAPPINGS_USMAP_NOT_PROVIDED");
    else if (!mappings.matchesMetadata) blockers.push("MAPPINGS_CHECKSUM_MISMATCH");
    if (koTextLanguage !== "ko") blockers.push("OFFICIAL_KO_LOCALE_NOT_VERIFIED");
    if (baseTextLanguage !== "ja") blockers.push("BASE_JA_LOCALE_NOT_VERIFIED");
    if (officialEnRequired && enTextLanguage !== "en") {
      blockers.push("OFFICIAL_EN_LOCALE_NOT_PROVIDED");
    }
    if (
      exactPalIcons !== canonicalPals.canonical.length
      || palIconSourceTableMissing.length > 0
    ) {
      blockers.push("PAL_ICON_EXPORT_INCOMPLETE");
    }
    if (
      exactItemIcons !== referencedItemIcons
      || referencedItemIcons === 0
      || missingItemIconRows > 0
    ) {
      blockers.push("ITEM_ICON_EXPORT_INCOMPLETE");
    }
    if (rawPackages.missing.length > 0) blockers.push("RAW_PACKAGE_COMPANION_INCOMPLETE");

    const extensionCounts = countExtensions(entries);
    const normalPals = canonicalPals.canonical.filter((pal) =>
      String(pal.value.ZukanIndexSuffix ?? "").length === 0
    ).length;
    const variantPals = canonicalPals.canonical.length - normalPals;
    const activeSkills = Object.values(activeSkillRows).filter((value) =>
      isRecord(value) && value.DisabledData !== true
    ).length;
    const elementIcons = [...entries.keys()].filter((member) =>
      /^Pal\/Texture\/UI\/InGame\/T_Icon_element_s_\d+\.png$/u.test(member)
    ).length;
    const workIcons = [...entries.keys()].filter((member) =>
      /^Pal\/Texture\/UI\/InGame\/T_icon_palwork_\d+\.png$/u.test(member)
    ).length;
    const skillIcons = [...entries.keys()].filter((member) =>
      /\/T_icon_skill_pal_[A-Za-z0-9_]+\.png$/u.test(member)
    ).length;
    const worldMapImages = [...entries.keys()].filter((member) =>
      /^Pal\/Texture\/UI\/Map\/.*WorldMap.*\.png$/iu.test(member)
    ).length;

    return {
      schemaVersion: 1,
      archive: {
        sha256: archiveSha256,
        bytes: archive.bytes,
        fileCount: files.length,
        directoryCount: directories,
        uncompressedBytes,
        extensionCounts,
        crcVerifiedFiles,
        parsedJsonFiles,
        rawPackageCounts: rawPackages.counts,
        missingRawPackageCompanions: rawPackages.missing
      },
      metadata,
      mappings,
      data: {
        rawPalRows: canonicalPals.raw.length,
        canonicalPals: canonicalPals.canonical.length,
        normalPals,
        variantPals,
        duplicatePalRowsExcluded: canonicalPals.raw.length - canonicalPals.canonical.length,
        totalItemRows: Object.keys(itemRows).length,
        legalItems,
        activeSkillRows: activeSkills,
        passiveSkillRows: Object.keys(passiveSkillRows).length,
        specialBreedingRows: Object.keys(specialBreedingRows).length
      },
      localization: {
        baseTextLanguage,
        koTextLanguage,
        enTextLanguage,
        enRequirement: officialEnRequired ? "required" : "optional",
        jaMembers,
        koMembers,
        enMembers
      },
      assets: {
        palIcons: {
          referenced: canonicalPals.canonical.length,
          exactMatches: exactPalIcons,
          missing: palMissing.sort((left, right) => left.localeCompare(right, "en")),
          sourceTableReferenced: palIconSourceTableReferenced,
          sourceTableExactMatches: palIconSourceTableExactMatches,
          sourceTableMissing: palIconSourceTableMissing
            .sort((left, right) => left.localeCompare(right, "en"))
        },
        itemIcons: {
          referenced: referencedItemIcons,
          exactMatches: exactItemIcons,
          missingIconRows: missingItemIconRows,
          missingRoots: Object.fromEntries(
            [...missingItemRoots.entries()].sort(([left], [right]) => left.localeCompare(right, "en"))
          )
        },
        elementIcons,
        workIcons,
        skillIcons,
        worldMapImages
      },
      requiredTables: {
        present: requiredTables.length - requiredMissing.length,
        missing: [...requiredMissing]
      },
      gates: {
        archiveStructure: "passed",
        requiredTables: requiredMissing.length === 0 ? "passed" : "blocked",
        metadata: metadata.status === "provided" ? "passed" : "blocked",
        mappings: mappings.status === "provided" && mappings.matchesMetadata ? "passed" : "blocked",
        officialKo: koTextLanguage === "ko" ? "passed" : "blocked",
        officialJa: baseTextLanguage === "ja" ? "passed" : "blocked",
        officialEn: !officialEnRequired && enTextLanguage !== "en"
          ? "not_required"
          : enTextLanguage === "en"
            ? "passed"
            : "blocked",
        palImages: exactPalIcons === canonicalPals.canonical.length
          && palIconSourceTableMissing.length === 0
          ? "passed"
          : "blocked",
        itemImages: exactItemIcons === referencedItemIcons
          && referencedItemIcons > 0
          && missingItemIconRows === 0
          ? "passed"
          : "blocked",
        inputPrerequisitesSatisfied: blockers.length === 0,
        activationValidationRequired: true,
        blockers
      }
    };
  } finally {
    await closeSecureArchive(archive);
  }
}
