import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  link,
  lstat,
  open,
  realpath,
  unlink
} from "node:fs/promises";
import path from "node:path";
import {
  assertPalworldDataSnapshot,
  assertPalworldPakCandidateArtifact,
  assertPalworldSourceProvenance,
  PALWORLD_ELEMENTS,
  PALWORLD_WORK_SUITABILITY_TYPES,
  type PalworldBreedingDataSnapshot,
  type PalworldBreedingPair,
  type PalworldDataCoverage,
  type PalworldDataMetadata,
  type PalworldDataSnapshot,
  type PalworldDomainCoverageMap,
  type PalworldItemCategory,
  type PalworldItemDetail,
  type PalworldItemReference,
  type PalworldPalDetail,
  type PalworldPalReference,
  type PalworldRuntimeGates,
  type PalworldSkill,
  type PalworldSkillDetail,
  type PalworldTranslationDisplayState,
  type PalworldTranslationDisplayStatus
} from "@streamops/shared";
import {
  PalworldBreedingEngine,
  type PalworldBreedingEnginePair
} from "../services/palworld-breeding-engine.js";

const REQUIRED_ARTIFACT_FILES = [
  "paldex.json",
  "items.json",
  "skills.json",
  "breeding.json",
  "locales/ko.json",
  "locales/ja.json",
  "locales/en.json",
  "assets-manifest.json",
  "map-manifest.json",
  "source-lock.json"
] as const;

type RequiredArtifactFile = (typeof REQUIRED_ARTIFACT_FILES)[number];
type JsonRecord = Record<string, unknown>;
type CandidateLocale = "ko" | "ja" | "en";

type CandidateLocalizedValue = {
  messageKey: string;
  sourceField: string;
  ko: string | null;
  ja: string | null;
  en: string | null;
  koStatus: "source_provided" | "missing_source";
  jaStatus: "source_provided" | "missing_source";
  enStatus: "source_provided" | "missing_source";
  koRichTextStatus?: "resolved" | "unresolved" | "placeholder";
  jaRichTextStatus?: "resolved" | "unresolved" | "placeholder";
  enRichTextStatus?: "resolved" | "unresolved" | "placeholder";
  koRichText?: { unresolved: unknown[] };
  jaRichText?: { unresolved: unknown[] };
  enRichText?: { unresolved: unknown[] };
};

export type PalworldPakSnapshotAdapterInput = {
  identity: {
    candidateId: string;
    release: string;
    gameVersion: string;
    steamBuildId: string;
    importRevision: string;
    publicSourceUrl: string;
    verifiedAt: string;
  };
  artifacts: Readonly<Record<RequiredArtifactFile, string | Uint8Array>>;
  artifactSha256: Readonly<Record<RequiredArtifactFile, string>>;
};

export type PalworldPakSnapshotAdapterResult = {
  snapshot: PalworldDataSnapshot;
  domains: PalworldDomainCoverageMap;
  gates: PalworldRuntimeGates;
  coverage: PalworldDataCoverage;
  sourceInternalIds: Readonly<Record<string, string>>;
  breedingSource: PalworldBreedingDataSnapshot;
  report: Readonly<{
    resolvedActiveAssignments: number;
    excludedActiveAssignments: number;
    unresolvedActiveAssignments: 0;
    resolvedSpecialBreedingRules: number;
    excludedSpecialBreedingRows: number;
    duplicateSpecialBreedingRows: number;
    unresolvedSpecialBreedingRows: 0;
    technicalPalImages: number;
    technicalItemImages: number;
    technicalElementImages: number;
    technicalWorkImages: number;
    technicalSkillImages: number;
    technicalMapImages: number;
    publicPalImages: 0;
    publicItemImages: 0;
    fallbackPals: number;
    fallbackItems: number;
    fallbackElements: number;
    fallbackWorkSuitabilities: number;
    fallbackSkills: number;
    fallbackMap: 1;
  }>;
};

export type PalworldPakSnapshotWriteResult = {
  file: "snapshot.json";
  sha256: string;
  bytes: number;
};

export class PalworldPakSnapshotAdapterError extends Error {
  readonly code:
    | "PALWORLD_PAK_SNAPSHOT_ADAPTER_INVALID"
    | "PALWORLD_PAK_RELEASE_METADATA_REQUIRED"
    | "OFFICIAL_EN_LOCALE_NOT_PROVIDED";

  constructor(
    code: PalworldPakSnapshotAdapterError["code"],
    message: string
  ) {
    super(message);
    this.name = "PalworldPakSnapshotAdapterError";
    this.code = code;
  }
}

function fail(
  message: string,
  code: PalworldPakSnapshotAdapterError["code"] =
    "PALWORLD_PAK_SNAPSHOT_ADAPTER_INVALID"
): never {
  throw new PalworldPakSnapshotAdapterError(code, message);
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function asRecord(value: unknown, pathName: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${pathName}: 객체여야 합니다.`);
  }
  return value as JsonRecord;
}

function asRecords(value: unknown, pathName: string): JsonRecord[] {
  if (!Array.isArray(value)) fail(`${pathName}: 배열이어야 합니다.`);
  return value.map((entry, index) => asRecord(entry, `${pathName}[${index}]`));
}

function asString(value: unknown, pathName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${pathName}: 비어 있지 않은 문자열이어야 합니다.`);
  }
  return value;
}

function asNumber(value: unknown, pathName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${pathName}: 유한 숫자여야 합니다.`);
  }
  return value;
}

function bytesOf(value: string | Uint8Array): Buffer {
  return typeof value === "string"
    ? Buffer.from(value, "utf8")
    : Buffer.from(value);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(bytesOf(value)).digest("hex");
}

function parseArtifact(
  file: RequiredArtifactFile,
  input: PalworldPakSnapshotAdapterInput
): Readonly<JsonRecord> {
  const bytes = bytesOf(input.artifacts[file]);
  if (sha256(bytes) !== input.artifactSha256[file]) {
    fail(`${file}: 선언된 SHA-256과 실제 artifact bytes가 일치하지 않습니다.`);
  }
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    fail(`${file}: 올바른 JSON이어야 합니다.`);
  }
  if (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  ) {
    const root = value as JsonRecord;
    const metadata = root.metadata;
    if (
      root.release === null
      || (
        metadata !== null
        && typeof metadata === "object"
        && !Array.isArray(metadata)
        && [
          "gameVersion",
          "steamBuildId",
          "fmodelVersion",
          "exportedAt",
          "mappingsSha256"
        ].some((key) => (metadata as JsonRecord)[key] === null)
      )
    ) {
      fail(
        `${file}: candidate에 고정 release metadata가 없습니다.`,
        "PALWORLD_PAK_RELEASE_METADATA_REQUIRED"
      );
    }
  }
  try {
    return assertPalworldPakCandidateArtifact(file, value, {
      candidateId: input.identity.candidateId,
      release: input.identity.release
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "artifact 검증에 실패했습니다.";
    fail(`${file}: ${message}`);
  }
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim();
  return normalized.length === 0
    || normalized === "-"
    || /^(?:ko|ja|en)[ _]Text$/iu.test(normalized);
}

function candidateSkillId(type: string, sourceInternalId: string): string {
  const id = `${type}-${sourceInternalId.replaceAll("_", "-").toLowerCase()}`;
  if (
    id.length > 80
    || !/^[a-z0-9][a-z0-9-]*$/u.test(id)
  ) {
    fail(`skills.records: 공개 skill ID로 안전하게 정규화할 수 없습니다: ${sourceInternalId}`);
  }
  return id;
}

function itemCategory(typeA: string, typeB: string): PalworldItemCategory {
  if (typeB === "SPWeaponCaptureBall") return "sphere";
  if (typeA === "Material") return "material";
  if (typeA === "Weapon" || typeA === "SpecialWeapon") return "weapon";
  if (typeA === "Armor") return "armor";
  if (typeA === "Accessory") return "accessory";
  if (typeA === "Ammo" || typeB === "ConsumeBullet") return "ammo";
  if (typeA === "Essential" || typeA === "Blueprint") return "key_item";
  if (typeB.startsWith("Food")) return "food";
  if (typeB === "Drug" || typeB === "Medicine") return "medicine";
  if (typeA === "Consume") return "consumable";
  return "other";
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => codePointCompare(left, right))
        .map(([key, nested]) => [key, canonicalJsonValue(nested)])
    );
  }
  return value;
}

export function deterministicPalworldPakSnapshotJson(value: unknown): string {
  const snapshot = assertPalworldDataSnapshot(value);
  return `${JSON.stringify(canonicalJsonValue(snapshot), null, 2)}\n`;
}

function coverageCount(available: number, total: number): {
  available: number;
  missing: number;
  total: number;
} {
  if (
    !Number.isInteger(available)
    || !Number.isInteger(total)
    || available < 0
    || total < available
  ) {
    fail("coverage: 집계가 올바르지 않습니다.");
  }
  return { available, missing: total - available, total };
}

function localizationState(
  hasKo: boolean,
  hasJa: boolean
): {
  sourceLanguage: "en";
  ko: "localized" | "source_language_fallback";
  ja: "localized" | "source_language_fallback";
} {
  return {
    sourceLanguage: "en",
    ko: hasKo ? "localized" : "source_language_fallback",
    ja: hasJa ? "localized" : "source_language_fallback"
  };
}

function translationStatus(
  available: boolean
): PalworldTranslationDisplayStatus {
  return available ? "source_provided" : "source_language_fallback";
}

function palReference(pal: Pick<
  PalworldPalDetail,
  | "id"
  | "number"
  | "nameKo"
  | "nameJa"
  | "nameEn"
  | "elements"
  | "translation"
>): PalworldPalReference {
  return {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    elements: [...pal.elements],
    ...(pal.translation?.name === undefined
      ? {}
      : { translation: { name: { ...pal.translation.name } } })
  };
}

function itemReference(item: Pick<
  PalworldItemDetail,
  "id" | "nameKo" | "nameJa" | "nameEn" | "localization" | "translation"
>): PalworldItemReference {
  return {
    id: item.id,
    nameEn: item.nameEn,
    ...(item.nameKo === undefined ? {} : { nameKo: item.nameKo }),
    ...(item.nameJa === undefined ? {} : { nameJa: item.nameJa }),
    ...(item.localization === undefined
      ? {}
      : { localization: { ...item.localization } }),
    ...(item.translation?.name === undefined
      ? {}
      : { translation: { name: { ...item.translation.name } } })
  };
}

function skillValue(skill: PalworldSkillDetail, unlockLevel?: number): PalworldSkill {
  return {
    id: skill.id,
    ...(skill.sourceInternalId === undefined
      ? {}
      : { sourceInternalId: skill.sourceInternalId }),
    type: skill.type,
    nameEn: skill.nameEn,
    ...(skill.nameKo === undefined ? {} : { nameKo: skill.nameKo }),
    ...(skill.nameJa === undefined ? {} : { nameJa: skill.nameJa }),
    ...(skill.descriptionKo === undefined
      ? {}
      : { descriptionKo: skill.descriptionKo }),
    ...(skill.descriptionJa === undefined
      ? {}
      : { descriptionJa: skill.descriptionJa }),
    ...(skill.descriptionEn === undefined
      ? {}
      : { descriptionEn: skill.descriptionEn }),
    ...(skill.element === undefined ? {} : { element: skill.element }),
    ...(skill.power === undefined ? {} : { power: skill.power }),
    ...(skill.cooldownSeconds === undefined
      ? {}
      : { cooldownSeconds: skill.cooldownSeconds }),
    ...(unlockLevel === undefined ? {} : { unlockLevel }),
    ...(skill.passiveTier === undefined
      ? {}
      : { passiveTier: skill.passiveTier }),
    ...(skill.localization === undefined
      ? {}
      : { localization: { ...skill.localization } }),
    ...(skill.translation === undefined
      ? {}
      : { translation: structuredClone(skill.translation) })
  };
}

function breedingPairId(pair: PalworldBreedingEnginePair): string {
  return `breeding-${createHash("sha256")
    .update(pair.parentAId)
    .update("\0")
    .update(pair.parentBId)
    .update("\0")
    .update(pair.childId)
    .update("\0")
    .update(pair.parentAGender ?? "")
    .update("\0")
    .update(pair.parentBGender ?? "")
    .digest("hex")
    .slice(0, 24)}`;
}

function pairOrder(
  left: PalworldBreedingEnginePair,
  right: PalworldBreedingEnginePair
): number {
  return codePointCompare(left.parentAId, right.parentAId)
    || codePointCompare(left.parentBId, right.parentBId)
    || codePointCompare(left.parentAGender ?? "", right.parentAGender ?? "")
    || codePointCompare(left.parentBGender ?? "", right.parentBGender ?? "")
    || codePointCompare(left.childId, right.childId);
}

export function adaptPalworldPakCandidateToSnapshot(
  input: PalworldPakSnapshotAdapterInput
): PalworldPakSnapshotAdapterResult {
  if (
    input.identity.release !== input.identity.gameVersion
    || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(
      input.identity.release
    )
    || !/^[1-9]\d{0,19}$/u.test(input.identity.steamBuildId)
  ) {
    fail(
      "고정 release, gameVersion, Steam Build ID가 모두 필요합니다.",
      "PALWORLD_PAK_RELEASE_METADATA_REQUIRED"
    );
  }

  const artifacts = new Map<RequiredArtifactFile, Readonly<JsonRecord>>();
  for (const file of REQUIRED_ARTIFACT_FILES) {
    artifacts.set(file, parseArtifact(file, input));
  }
  const paldex = artifacts.get("paldex.json")!;
  const itemsArtifact = artifacts.get("items.json")!;
  const skillsArtifact = artifacts.get("skills.json")!;
  const breedingArtifact = artifacts.get("breeding.json")!;
  const assetsArtifact = artifacts.get("assets-manifest.json")!;
  const mapArtifact = artifacts.get("map-manifest.json")!;
  const sourceLock = artifacts.get("source-lock.json")!;

  const provenance = assertPalworldSourceProvenance(paldex.provenance);
  if (
    provenance.gameVersion !== input.identity.gameVersion
    || provenance.steamBuildId !== input.identity.steamBuildId
    || provenance.exportedAt === null
    || provenance.mappingsSha256 === null
  ) {
    fail(
      "candidate provenance에 고정 release metadata가 없습니다.",
      "PALWORLD_PAK_RELEASE_METADATA_REQUIRED"
    );
  }
  for (const [file, artifact] of artifacts) {
    if (
      JSON.stringify(canonicalJsonValue(artifact.provenance))
      !== JSON.stringify(canonicalJsonValue(provenance))
    ) {
      fail(`${file}.provenance: 모든 artifact가 동일한 고정 원본을 사용해야 합니다.`);
    }
  }

  const sourceLockArchive = asRecord(
    sourceLock.archive,
    "source-lock.archive"
  );
  if (
    sourceLockArchive.sha256 !== provenance.archiveSha256
    || sourceLockArchive.sha256 !== artifacts.get("locales/ko.json")!.sourceArchiveSha256
    || sourceLockArchive.sha256 !== artifacts.get("locales/ja.json")!.sourceArchiveSha256
    || sourceLockArchive.sha256 !== artifacts.get("locales/en.json")!.sourceArchiveSha256
  ) {
    fail("source-lock.archive: provenance와 locale source archive checksum이 일치해야 합니다.");
  }
  const sourceFiles = new Map(
    asRecords(sourceLock.includedFiles, "source-lock.includedFiles").map(
      (entry) => [
        asString(entry.member, "source-lock.includedFiles.member"),
        asString(entry.sha256, "source-lock.includedFiles.sha256")
      ]
    )
  );
  if (
    provenance.includedFiles === undefined
    || JSON.stringify(
      [...provenance.includedFiles]
        .sort((left, right) => codePointCompare(left.member, right.member))
    ) !== JSON.stringify(
      asRecords(sourceLock.includedFiles, "source-lock.includedFiles")
        .map((entry) => ({
          member: asString(entry.member, "source-lock.includedFiles.member"),
          sha256: asString(entry.sha256, "source-lock.includedFiles.sha256"),
          bytes: asNumber(entry.bytes, "source-lock.includedFiles.bytes")
        }))
        .sort((left, right) => codePointCompare(left.member, right.member))
    )
  ) {
    fail("source-lock.includedFiles: provenance의 고정 source 목록과 일치해야 합니다.");
  }
  const localeMaps = new Map<
    CandidateLocale,
    Map<string, JsonRecord>
  >();
  for (const locale of ["ko", "ja", "en"] as const) {
    const localeArtifact = artifacts.get(`locales/${locale}.json`)!;
    if (
      localeArtifact.status !== "source_provided"
      || localeArtifact.languageVerified !== true
    ) {
      fail(
        locale === "en"
          ? "공식 EN locale이 없어 필수 nameEn을 PAK 원본으로 검증할 수 없습니다."
          : `공식 ${locale.toUpperCase()} locale이 준비되지 않았습니다.`,
        locale === "en"
          ? "OFFICIAL_EN_LOCALE_NOT_PROVIDED"
          : "PALWORLD_PAK_SNAPSHOT_ADAPTER_INVALID"
      );
    }
    const records = new Map<string, JsonRecord>();
    for (const [index, record] of asRecords(
      localeArtifact.records,
      `locales/${locale}.json.records`
    ).entries()) {
      const text = asString(record.text, `locales.${locale}.records[${index}].text`);
      if (isPlaceholder(text)) {
        fail(`locales.${locale}.records[${index}]: placeholder를 공식 locale로 사용할 수 없습니다.`);
      }
      if (
        sha256(text) !== record.valueSha256
        || sourceFiles.get(asString(record.sourceMember, "locale.sourceMember"))
          !== record.sourceMemberSha256
      ) {
        fail(`locales.${locale}.records[${index}]: stale locale checksum입니다.`);
      }
      const key = `${String(record.field)}\0${String(record.messageKey)}`;
      if (records.has(key)) fail(`locales.${locale}.records: locale key가 중복됩니다.`);
      records.set(key, record);
    }
    localeMaps.set(locale, records);
  }

  const localized = (
    value: CandidateLocalizedValue,
    pathName: string,
    options: {
      requireKo?: boolean;
      requireJa?: boolean;
      requireEn?: boolean;
      richText?: boolean;
    } = {}
  ): { ko?: string; ja?: string; en?: string } => {
    const result: { ko?: string; ja?: string; en?: string } = {};
    for (const locale of ["ko", "ja", "en"] as const) {
      const text = value[locale];
      const status = value[`${locale}Status`];
      const official = localeMaps
        .get(locale)!
        .get(`${value.sourceField}\0${value.messageKey}`);
      const required = options[
        `require${locale[0]!.toUpperCase()}${locale.slice(1)}` as
          "requireKo" | "requireJa" | "requireEn"
      ] === true;
      if (status === "missing_source") {
        if (text !== null || official !== undefined) {
          fail(`${pathName}.${locale}: missing_source 상태와 공식 locale이 충돌합니다.`);
        }
        if (required) {
          fail(
            `${pathName}.${locale}: 필수 공식 locale이 없습니다.`,
            locale === "en"
              ? "OFFICIAL_EN_LOCALE_NOT_PROVIDED"
              : "PALWORLD_PAK_SNAPSHOT_ADAPTER_INVALID"
          );
        }
        continue;
      }
      if (
        status !== "source_provided"
        || typeof text !== "string"
        || isPlaceholder(text)
        || official === undefined
      ) {
        fail(`${pathName}.${locale}: exact 공식 locale 참조가 아닙니다.`);
      }
      if (!options.richText && official.text !== text) {
        fail(`${pathName}.${locale}: 공식 locale 원문과 정확히 일치해야 합니다.`);
      }
      if (options.richText) {
        const richStatus = value[`${locale}RichTextStatus`];
        const rich = value[`${locale}RichText`];
        if (
          richStatus !== "resolved"
          || rich === undefined
          || !Array.isArray(rich.unresolved)
          || rich.unresolved.length !== 0
        ) {
          fail(`${pathName}.${locale}: rich text가 완전히 해결되지 않았습니다.`);
        }
      }
      result[locale] = text;
    }
    return result;
  };

  const palRecords = asRecords(paldex.records, "paldex.records");
  const itemRecords = asRecords(itemsArtifact.records, "items.records");
  const skillRecords = asRecords(skillsArtifact.records, "skills.records");
  const palIds = new Set(palRecords.map((record) => String(record.id)));
  const itemIds = new Set(itemRecords.map((record) => String(record.id)));

  const skillIdMap = new Map<string, string>();
  const publicSkillIds = new Set<string>();
  for (const record of skillRecords) {
    const sourceId = asString(record.sourceInternalId, "skills.records.sourceInternalId");
    const id = candidateSkillId(asString(record.type, "skills.records.type"), sourceId);
    if (publicSkillIds.has(id)) {
      fail(`skills.records: 공개 skill ID가 충돌합니다: ${id}`);
    }
    publicSkillIds.add(id);
    skillIdMap.set(asString(record.id, "skills.records.id"), id);
  }
  const technicalAssets = asRecords(assetsArtifact.images, "assets.images");
  const candidateSkillIds = new Set(skillIdMap.keys());
  for (const [index, asset] of technicalAssets.entries()) {
    const kind = asString(asset.kind, `assets.images[${index}].kind`);
    const id = asString(asset.id, `assets.images[${index}].id`);
    const known = kind === "pal"
      ? palIds.has(id)
      : kind === "item"
        ? itemIds.has(id)
        : kind === "element"
          ? (PALWORLD_ELEMENTS as readonly string[]).includes(id)
          : kind === "work"
            ? (PALWORLD_WORK_SUITABILITY_TYPES as readonly string[]).includes(id)
            : kind === "skill"
              ? candidateSkillIds.has(id)
              : kind === "map";
    if (!known) {
      fail(`assets.images[${index}]: 공개 domain에 없는 ${kind} asset ID입니다: ${id}`);
    }
  }
  const technicalMapAssets = technicalAssets.filter((asset) => asset.kind === "map");
  const mapVariants = asRecords(mapArtifact.variants, "map.variants");
  if (
    JSON.stringify(canonicalJsonValue(technicalMapAssets))
    !== JSON.stringify(canonicalJsonValue(mapVariants))
  ) {
    fail("map.variants: assets manifest의 map asset과 정확히 일치해야 합니다.");
  }

  const palBase = new Map<string, {
    record: JsonRecord;
    name: { ko: string; ja: string; en: string };
    description: { ko?: string; ja?: string; en?: string };
    translation: PalworldTranslationDisplayState;
  }>();
  for (const [index, record] of palRecords.entries()) {
    const name = localized(
      record.name as CandidateLocalizedValue,
      `paldex.records[${index}].name`,
      { requireKo: true, requireJa: true, requireEn: true }
    ) as { ko: string; ja: string; en: string };
    const description = localized(
      record.description as CandidateLocalizedValue,
      `paldex.records[${index}].description`,
      { richText: true }
    );
    palBase.set(String(record.id), {
      record,
      name,
      description,
      translation: {
        name: { ko: "source_provided", ja: "source_provided" },
        ...(description.ko === undefined
          && description.ja === undefined
          && description.en === undefined
          ? {}
          : {
              description: {
                ko: translationStatus(description.ko !== undefined),
                ja: translationStatus(description.ja !== undefined)
              }
            })
      }
    });
  }

  const itemBase = new Map<string, {
    record: JsonRecord;
    detail: PalworldItemDetail;
  }>();
  for (const [index, record] of itemRecords.entries()) {
    const name = localized(
      record.name as CandidateLocalizedValue,
      `items.records[${index}].name`,
      { requireEn: true }
    );
    const description = localized(
      record.description as CandidateLocalizedValue,
      `items.records[${index}].description`,
      { richText: true }
    );
    if (
      description.ko === undefined
      && description.ja === undefined
      && description.en === undefined
    ) {
      fail(`items.records[${index}].description: 하나 이상의 공식 설명이 필요합니다.`);
    }
    const nameTranslation = {
      ko: translationStatus(name.ko !== undefined),
      ja: translationStatus(name.ja !== undefined)
    } as const;
    const descriptionTranslation = {
      ko: translationStatus(description.ko !== undefined),
      ja: translationStatus(description.ja !== undefined)
    } as const;
    const technology = asRecords(
      record.technology,
      `items.records[${index}].technology`
    );
    const detail = {
      id: asString(record.id, `items.records[${index}].id`),
      sourceInternalId: asString(
        record.sourceInternalId,
        `items.records[${index}].sourceInternalId`
      ),
      nameEn: name.en!,
      ...(name.ko === undefined ? {} : { nameKo: name.ko }),
      ...(name.ja === undefined ? {} : { nameJa: name.ja }),
      category: itemCategory(String(record.typeA), String(record.typeB)),
      rarity: asNumber(record.rarity, `items.records[${index}].rarity`),
      ...(description.ko === undefined ? {} : { descriptionKo: description.ko }),
      ...(description.ja === undefined ? {} : { descriptionJa: description.ja }),
      ...(description.en === undefined ? {} : { descriptionEn: description.en }),
      sellPrice: asNumber(record.price, `items.records[${index}].price`),
      ...(technology.length === 0
        ? {}
        : {
            technologyLevel: Math.min(
              ...technology.map((entry) =>
                asNumber(entry.unlockLevel, "items.technology.unlockLevel")
              )
            )
          }),
      weight: asNumber(record.weight, `items.records[${index}].weight`),
      maxStack: asNumber(record.maxStack, `items.records[${index}].maxStack`),
      durability: asNumber(record.durability, `items.records[${index}].durability`),
      localization: localizationState(
        name.ko !== undefined && description.ko !== undefined,
        name.ja !== undefined && description.ja !== undefined
      ),
      craftingMaterials: [],
      recipes: [],
      technologyUnlocks: technology.map((entry) => ({
        sourceRowId: asString(entry.sourceRowId, "items.technology.sourceRowId"),
        unlockLevel: asNumber(entry.unlockLevel, "items.technology.unlockLevel"),
        tier: asNumber(entry.tier, "items.technology.tier"),
        cost: asNumber(entry.cost, "items.technology.cost")
      })),
      dropPals: [],
      acquisitionMethods: [],
      relatedItems: [],
      metadata: {} as PalworldDataMetadata,
      translation: {
        name: nameTranslation,
        description: descriptionTranslation
      }
    } satisfies PalworldItemDetail;
    itemBase.set(detail.id, { record, detail });
  }

  const palReferences = new Map<string, PalworldPalReference>();
  for (const [id, base] of palBase) {
    palReferences.set(id, {
      id,
      number: asNumber(base.record.number, `paldex.${id}.number`),
      nameKo: base.name.ko,
      nameJa: base.name.ja,
      nameEn: base.name.en,
      elements: [...(base.record.elements as PalworldPalReference["elements"])],
      translation: { name: { ko: "source_provided", ja: "source_provided" } }
    });
  }
  const itemReferences = new Map<string, PalworldItemReference>();
  for (const [id, base] of itemBase) {
    itemReferences.set(id, itemReference(base.detail));
  }

  const resolvedAssignments = asRecords(
    skillsArtifact.assignments,
    "skills.assignments"
  ).filter((assignment) => assignment.status === "resolved");
  const unresolvedAssignments = asRecords(
    skillsArtifact.assignments,
    "skills.assignments"
  ).filter((assignment) =>
    assignment.status === "pal_reference_unresolved"
    || assignment.status === "skill_reference_unresolved"
  );
  if (unresolvedAssignments.length > 0) {
    fail("skills.assignments: 공개 relation에 미해결 참조가 남아 있습니다.");
  }
  const assignmentsBySkill = new Map<string, JsonRecord[]>();
  const assignmentByPalAndSkill = new Map<string, JsonRecord>();
  for (const assignment of resolvedAssignments) {
    const candidateSkill = asString(
      assignment.activeSkillId,
      "skills.assignments.activeSkillId"
    );
    const skillId = skillIdMap.get(candidateSkill);
    const palId = asString(assignment.palId, "skills.assignments.palId");
    if (skillId === undefined || !palIds.has(palId)) {
      fail("skills.assignments: canonical 공개 참조가 아닙니다.");
    }
    const key = `${palId}\0${skillId}`;
    if (assignmentByPalAndSkill.has(key)) {
      fail(`skills.assignments: 중복 공개 배정입니다: ${key}`);
    }
    assignmentByPalAndSkill.set(key, assignment);
    assignmentsBySkill.set(skillId, [
      ...(assignmentsBySkill.get(skillId) ?? []),
      assignment
    ]);
  }

  const skillDetails = new Map<string, PalworldSkillDetail>();
  for (const [index, record] of skillRecords.entries()) {
    const candidateId = asString(record.id, `skills.records[${index}].id`);
    const id = skillIdMap.get(candidateId)!;
    const name = localized(
      record.name as CandidateLocalizedValue,
      `skills.records[${index}].name`,
      { requireEn: true }
    );
    const description = localized(
      record.description as CandidateLocalizedValue,
      `skills.records[${index}].description`,
      { richText: true }
    );
    const type = asString(record.type, `skills.records[${index}].type`) as
      "active" | "passive" | "partner";
    const relatedIds = type === "active"
      ? (assignmentsBySkill.get(id) ?? [])
          .map((assignment) => String(assignment.palId))
      : type === "partner"
        ? (record.relatedPalIds as string[])
        : [];
    const declaredRelated = type === "passive"
      ? []
      : [...(record.relatedPalIds as string[])].sort(codePointCompare);
    if (
      JSON.stringify([...new Set(relatedIds)].sort(codePointCompare))
      !== JSON.stringify(declaredRelated)
    ) {
      fail(`skills.records[${index}].relatedPalIds: resolved assignment와 일치하지 않습니다.`);
    }
    const relatedPals = [...new Set(relatedIds)]
      .sort(codePointCompare)
      .map((palId) => {
        const pal = palReferences.get(palId);
        if (pal === undefined) fail(`skills.records[${index}]: 고아 Pal 참조입니다.`);
        const assignment = assignmentByPalAndSkill.get(`${palId}\0${id}`);
        return {
          pal: structuredClone(pal),
          ...(assignment?.level === null || assignment?.level === undefined
            ? {}
            : { unlockLevel: asNumber(assignment.level, "skills.assignments.level") })
        };
      });
    const localization = localizationState(
      name.ko !== undefined
        && (description.en === undefined || description.ko !== undefined),
      name.ja !== undefined
        && (description.en === undefined || description.ja !== undefined)
    );
    const detail = {
      id,
      sourceInternalId: asString(
        record.sourceInternalId,
        `skills.records[${index}].sourceInternalId`
      ),
      type,
      nameEn: name.en!,
      ...(name.ko === undefined ? {} : { nameKo: name.ko }),
      ...(name.ja === undefined ? {} : { nameJa: name.ja }),
      ...(description.ko === undefined ? {} : { descriptionKo: description.ko }),
      ...(description.ja === undefined ? {} : { descriptionJa: description.ja }),
      ...(description.en === undefined ? {} : { descriptionEn: description.en }),
      ...(record.element === null || record.element === undefined
        ? {}
        : { element: record.element as PalworldSkill["element"] }),
      ...(record.power === undefined
        ? {}
        : { power: asNumber(record.power, `skills.records[${index}].power`) }),
      ...(record.cooldownSeconds === undefined
        ? {}
        : {
            cooldownSeconds: asNumber(
              record.cooldownSeconds,
              `skills.records[${index}].cooldownSeconds`
            )
          }),
      ...(record.rank === undefined
        ? {}
        : {
            passiveTier: asNumber(
              record.rank,
              `skills.records[${index}].rank`
            )
          }),
      localization,
      translation: {
        name: {
          ko: translationStatus(name.ko !== undefined),
          ja: translationStatus(name.ja !== undefined)
        },
        ...(description.ko === undefined
          && description.ja === undefined
          && description.en === undefined
          ? {}
          : {
              description: {
                ko: translationStatus(description.ko !== undefined),
                ja: translationStatus(description.ja !== undefined)
              }
            })
      },
      relatedPalCount: relatedPals.length,
      relatedPals,
      metadata: {} as PalworldDataMetadata
    } satisfies PalworldSkillDetail;
    skillDetails.set(id, detail);
  }

  const archiveSha256 = provenance.archiveSha256;
  const metadata: PalworldDataMetadata = {
    gameVersion: input.identity.gameVersion,
    release: input.identity.release,
    steamBuildId: input.identity.steamBuildId,
    sourceName: "operator_provided_pak_export",
    sourceUrl: input.identity.publicSourceUrl,
    sourceRevision: input.identity.importRevision,
    sourceChecksum: archiveSha256,
    extractedAt: provenance.exportedAt,
    verifiedAt: input.identity.verifiedAt,
    license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
    rightsVerified: false
  };
  for (const base of itemBase.values()) base.detail.metadata = { ...metadata };
  for (const skill of skillDetails.values()) skill.metadata = { ...metadata };

  for (const [id, base] of itemBase) {
    const recipes = asRecords(base.record.recipes, `items.${id}.recipes`).map(
      (recipe) => ({
        sourceRowId: asString(recipe.sourceRowId, `items.${id}.recipes.sourceRowId`),
        resultCount: asNumber(recipe.resultCount, `items.${id}.recipes.resultCount`),
        workAmount: asNumber(recipe.workAmount, `items.${id}.recipes.workAmount`),
        materials: asRecords(
          recipe.materials,
          `items.${id}.recipes.materials`
        ).map((material) => {
          const materialId = asString(
            material.itemId,
            `items.${id}.recipes.materials.itemId`
          );
          const reference = itemReferences.get(materialId);
          if (reference === undefined) {
            fail(`items.${id}.recipes: 고아 item 참조입니다: ${materialId}`);
          }
          return {
            item: structuredClone(reference),
            quantity: asNumber(material.count, `items.${id}.recipes.materials.count`)
          };
        })
      })
    );
    base.detail.recipes = recipes;
    base.detail.craftingMaterials = recipes.length === 1
      ? recipes[0]!.materials.map((material) => structuredClone(material))
      : [];
    const dropPalIds = (base.record.dropPalIds as string[]);
    base.detail.dropPals = dropPalIds.map((palId) => {
      const reference = palReferences.get(palId);
      if (reference === undefined) fail(`items.${id}.dropPalIds: 고아 Pal 참조입니다.`);
      return structuredClone(reference);
    });
  }

  const breedingParameters = asRecords(
    breedingArtifact.parameters,
    "breeding.parameters"
  );
  const breedingRules = asRecords(
    breedingArtifact.specialRules,
    "breeding.specialRules"
  );
  const unresolvedSpecial = asRecords(
    breedingArtifact.unresolvedSourceRows,
    "breeding.unresolvedSourceRows"
  );
  const sourceMissingSpecial = Array.isArray(breedingArtifact.sourceMissingSourceRows)
    ? asRecords(
        breedingArtifact.sourceMissingSourceRows,
        "breeding.sourceMissingSourceRows"
      )
    : [];
  if (unresolvedSpecial.length > 0 || sourceMissingSpecial.length > 0) {
    fail("breeding: 공개 특수 교배에 미해결 source row가 남아 있습니다.");
  }
  const breedingSource = {
    schemaVersion: 1,
    release: input.identity.release,
    metadata: {
      gameVersion: input.identity.gameVersion,
      steamBuildId: input.identity.steamBuildId,
      sourceRevision: input.identity.importRevision,
      sourceType: "operator_pak_export",
      sourceChecksums: {
        archive: archiveSha256,
        breedingArtifact: input.artifactSha256["breeding.json"]
      }
    },
    parameters: breedingParameters
      .map((entry) => ({
        palId: asString(entry.palId, "breeding.parameters.palId"),
        sourceRowId: asString(entry.sourceRowId, "breeding.parameters.sourceRowId"),
        sourceInternalId: asString(
          entry.sourceInternalId,
          "breeding.parameters.sourceInternalId"
        ),
        tribe: asString(entry.tribe, "breeding.parameters.tribe"),
        bpClass: asString(entry.bpClass, "breeding.parameters.bpClass"),
        combiRank: asNumber(entry.combiRank, "breeding.parameters.combiRank"),
        combiDuplicatePriority: asNumber(
          entry.combiDuplicatePriority,
          "breeding.parameters.combiDuplicatePriority"
        ),
        ignoreCombi: entry.ignoreCombi === true,
        maleProbability:
          asNumber(entry.maleProbability, "breeding.parameters.maleProbability") / 100,
        variantType: entry.variantType as "normal" | "variant"
      }))
      .sort((left, right) => codePointCompare(left.palId, right.palId)),
    specialRules: breedingRules
      .map((entry) => ({
        parentAId: asString(entry.parentAId, "breeding.specialRules.parentAId"),
        parentASourceInternalId: asString(
          entry.parentASourceInternalId,
          "breeding.specialRules.parentASourceInternalId"
        ),
        parentBId: asString(entry.parentBId, "breeding.specialRules.parentBId"),
        parentBSourceInternalId: asString(
          entry.parentBSourceInternalId,
          "breeding.specialRules.parentBSourceInternalId"
        ),
        childId: asString(entry.childId, "breeding.specialRules.childId"),
        childSourceInternalId: asString(
          entry.childSourceInternalId,
          "breeding.specialRules.childSourceInternalId"
        ),
        ...(entry.parentAGender === undefined
          ? {}
          : { parentAGender: entry.parentAGender as "male" | "female" }),
        ...(entry.parentBGender === undefined
          ? {}
          : { parentBGender: entry.parentBGender as "male" | "female" })
      }))
      .sort((left, right) =>
        codePointCompare(left.childId, right.childId)
        || codePointCompare(left.parentAId, right.parentAId)
        || codePointCompare(left.parentBId, right.parentBId)
        || codePointCompare(left.parentAGender ?? "", right.parentAGender ?? "")
        || codePointCompare(left.parentBGender ?? "", right.parentBGender ?? "")
      )
  } satisfies PalworldBreedingDataSnapshot;
  const breedingEngine = new PalworldBreedingEngine(breedingSource);
  if (
    breedingEngine.pairCount
    !== asNumber(breedingArtifact.computedResultCount, "breeding.computedResultCount")
  ) {
    fail("breeding.computedResultCount: IgnoreCombi를 반영한 실제 계산 결과와 일치하지 않습니다.");
  }

  const specialByChild = new Map<string, typeof breedingSource.specialRules>();
  for (const rule of breedingSource.specialRules) {
    specialByChild.set(rule.childId, [
      ...(specialByChild.get(rule.childId) ?? []),
      rule
    ]);
  }
  const sourceInternalIds: Record<string, string> = {};
  const pals: PalworldPalDetail[] = [];
  for (const [id, base] of [...palBase.entries()].sort(([left], [right]) =>
    codePointCompare(left, right)
  )) {
    sourceInternalIds[id] = asString(
      base.record.sourceInternalId,
      `paldex.${id}.sourceInternalId`
    );
    const stats = asRecord(base.record.stats, `paldex.${id}.stats`);
    const activeSkills = (base.record.activeSkillAssignmentIds as string[])
      .map((candidateId) => {
        const skillId = skillIdMap.get(candidateId);
        if (skillId === undefined) fail(`paldex.${id}: 고아 active skill 참조입니다.`);
        const skill = skillDetails.get(skillId)!;
        const assignment = assignmentByPalAndSkill.get(`${id}\0${skillId}`);
        if (assignment === undefined) fail(`paldex.${id}: active skill 배정이 없습니다.`);
        return skillValue(
          skill,
          assignment.level === null
            ? undefined
            : asNumber(assignment.level, "skills.assignments.level")
        );
      });
    const partner = asRecord(base.record.partnerSkill, `paldex.${id}.partnerSkill`);
    const partnerSkillId = skillIdMap.get(
      asString(partner.id, `paldex.${id}.partnerSkill.id`)
    );
    if (partnerSkillId === undefined) fail(`paldex.${id}: 고아 partner skill 참조입니다.`);
    const partnerSkill = skillDetails.get(partnerSkillId)!;
    const dropGroups = new Map<string, JsonRecord[]>();
    for (const drop of asRecords(base.record.drops, `paldex.${id}.drops`)) {
      const itemId = asString(drop.itemId, `paldex.${id}.drops.itemId`);
      if (!itemIds.has(itemId)) fail(`paldex.${id}: 고아 drop item 참조입니다.`);
      dropGroups.set(itemId, [...(dropGroups.get(itemId) ?? []), drop]);
    }
    const drops = [...dropGroups.keys()]
      .sort(codePointCompare)
      .map((itemId) => structuredClone(itemReferences.get(itemId)!));
    const dropDetails = [...dropGroups.entries()]
      .sort(([left], [right]) => codePointCompare(left, right))
      .map(([itemId, entries]) => {
        const conditions = new Set(entries.map((entry) =>
          JSON.stringify({
            min: asNumber(entry.min, `paldex.${id}.drops.min`),
            max: asNumber(entry.max, `paldex.${id}.drops.max`),
            rate: asNumber(entry.rate, `paldex.${id}.drops.rate`)
          })
        ));
        if (conditions.size !== 1) {
          fail(
            `paldex.${id}.drops: ${itemId}에 공개 조건으로 구분할 수 없는 서로 다른 drop 값이 있습니다.`
          );
        }
        return {
          item: structuredClone(itemReferences.get(itemId)!),
          minQuantity: asNumber(entries[0]!.min, `paldex.${id}.drops.min`),
          maxQuantity: asNumber(entries[0]!.max, `paldex.${id}.drops.max`),
          dropRatePercent: asNumber(entries[0]!.rate, `paldex.${id}.drops.rate`)
        };
      });
    const breeding = asRecord(base.record.breeding, `paldex.${id}.breeding`);
    pals.push({
      id,
      number: asNumber(base.record.number, `paldex.${id}.number`),
      nameKo: base.name.ko,
      nameJa: base.name.ja,
      nameEn: base.name.en,
      elements: [...(base.record.elements as PalworldPalDetail["elements"])],
      rarity: asNumber(base.record.rarity, `paldex.${id}.rarity`),
      variantType: base.record.variantType as "normal" | "variant",
      workSuitabilities: structuredClone(
        base.record.workSuitabilities as PalworldPalDetail["workSuitabilities"]
      ),
      ...(base.description.ko === undefined
        ? {}
        : { descriptionKo: base.description.ko }),
      ...(base.description.ja === undefined
        ? {}
        : { descriptionJa: base.description.ja }),
      ...(base.description.en === undefined
        ? {}
        : { descriptionEn: base.description.en }),
      ...(base.description.ko === undefined
        && base.description.ja === undefined
        && base.description.en === undefined
        ? {}
        : {
            localization: localizationState(
              base.description.ko !== undefined,
              base.description.ja !== undefined
            )
          }),
      translation: structuredClone(base.translation),
      stats: {
        hp: asNumber(stats.hp, `paldex.${id}.stats.hp`),
        attack: asNumber(stats.shotAttack, `paldex.${id}.stats.shotAttack`),
        defense: asNumber(stats.defense, `paldex.${id}.stats.defense`),
        moveSpeed: asNumber(stats.runSpeed, `paldex.${id}.stats.runSpeed`),
        stamina: asNumber(stats.stamina, `paldex.${id}.stats.stamina`),
        meleeAttack: asNumber(stats.meleeAttack, `paldex.${id}.stats.meleeAttack`),
        shotAttack: asNumber(stats.shotAttack, `paldex.${id}.stats.shotAttack`),
        walkSpeed: asNumber(stats.walkSpeed, `paldex.${id}.stats.walkSpeed`),
        runSpeed: asNumber(stats.runSpeed, `paldex.${id}.stats.runSpeed`),
        rideSprintSpeed: asNumber(
          stats.rideSprintSpeed,
          `paldex.${id}.stats.rideSprintSpeed`
        ),
        food: asNumber(stats.food, `paldex.${id}.stats.food`)
      },
      nocturnal: base.record.nocturnal === true,
      partnerSkill: skillValue(partnerSkill),
      activeSkills,
      drops,
      dropDetails,
      breeding: {
        breedingPower: asNumber(breeding.combiRank, `paldex.${id}.breeding.combiRank`),
        specialParentPairs: (specialByChild.get(id) ?? []).map((rule) => ({
          parentAId: rule.parentAId,
          parentBId: rule.parentBId,
          ...(rule.parentAGender === undefined
            ? {}
            : { parentAGender: rule.parentAGender }),
          ...(rule.parentBGender === undefined
            ? {}
            : { parentBGender: rule.parentBGender }),
          parentA: structuredClone(palReferences.get(rule.parentAId)!),
          parentB: structuredClone(palReferences.get(rule.parentBId)!)
        }))
      },
      metadata: { ...metadata }
    });
  }

  for (const [itemId, base] of itemBase) {
    const expectedPairs = new Set(
      (base.record.dropPalIds as string[]).map((palId) => `${palId}\0${itemId}`)
    );
    const actualPairs = new Set(
      pals
        .filter((pal) => pal.drops.some((drop) => drop.id === itemId))
        .map((pal) => `${pal.id}\0${itemId}`)
    );
    if (
      JSON.stringify([...expectedPairs].sort(codePointCompare))
      !== JSON.stringify([...actualPairs].sort(codePointCompare))
    ) {
      fail(`items.${itemId}.dropPalIds: Pal drop 역참조와 일치하지 않습니다.`);
    }
  }

  const allEnginePairs = pals
    .flatMap((pal) => breedingEngine.parents(pal.id))
    .sort(pairOrder);
  const breedingPairs: PalworldBreedingPair[] = allEnginePairs.map((pair) => {
    const parentA = palReferences.get(pair.parentAId);
    const parentB = palReferences.get(pair.parentBId);
    const child = palReferences.get(pair.childId);
    if (parentA === undefined || parentB === undefined || child === undefined) {
      fail("breedingPairs: 고아 Pal 참조가 있습니다.");
    }
    const hasGender = pair.parentAGender !== undefined
      || pair.parentBGender !== undefined;
    return {
      id: breedingPairId(pair),
      parentA: structuredClone(parentA),
      parentB: structuredClone(parentB),
      child: structuredClone(child),
      isSpecial: pair.isSpecial,
      ...(hasGender
        ? {
            genderCondition: {
              parentA: pair.parentAGender ?? "any",
              parentB: pair.parentBGender ?? "any"
            }
          }
        : {})
    };
  });

  const items = [...itemBase.values()]
    .map((entry) => entry.detail)
    .sort((left, right) => codePointCompare(left.id, right.id));
  const skills = [...skillDetails.values()]
    .sort((left, right) => codePointCompare(left.id, right.id));
  const snapshot = assertPalworldDataSnapshot({
    metadata,
    pals,
    items,
    breedingPairs,
    skills
  });

  const localizedTotal = pals.length + items.length + skills.length;
  const translationCoverage = (locale: "ko" | "ja") => {
    const statuses = [
      ...pals.flatMap((pal) => [
        pal.translation?.name?.[locale],
        pal.translation?.description?.[locale]
      ]),
      ...items.flatMap((item) => [
        item.translation?.name?.[locale],
        item.translation?.description?.[locale]
      ]),
      ...skills.flatMap((skill) => [
        skill.translation?.name?.[locale],
        skill.translation?.description?.[locale]
      ])
    ].filter((status): status is PalworldTranslationDisplayStatus =>
      status !== undefined
    );
    return {
      palNames: coverageCount(
        pals.filter((pal) => pal.translation?.name?.[locale] === "source_provided").length,
        pals.length
      ),
      palDescriptions: coverageCount(
        pals.filter((pal) =>
          pal.translation?.description?.[locale] === "source_provided"
        ).length,
        pals.length
      ),
      itemNames: coverageCount(
        items.filter((item) =>
          item.translation?.name?.[locale] === "source_provided"
        ).length,
        items.length
      ),
      itemDescriptions: coverageCount(
        items.filter((item) =>
          item.translation?.description?.[locale] === "source_provided"
        ).length,
        items.length
      ),
      skillNames: coverageCount(
        skills.filter((skill) =>
          skill.translation?.name?.[locale] === "source_provided"
        ).length,
        skills.length
      ),
      skillDescriptions: coverageCount(
        skills.filter((skill) =>
          skill.translation?.description?.[locale] === "source_provided"
        ).length,
        skills.length
      ),
      skillPassiveAbilities: coverageCount(0, skills.length),
      sourceProvided: statuses.filter((status) => status === "source_provided").length,
      humanReviewed: 0,
      machineAssisted: 0,
      sourceLanguageFallback: statuses.filter(
        (status) => status === "source_language_fallback"
      ).length,
      missingSource: statuses.filter((status) => status === "missing_source").length,
      placeholderExcluded: 0,
      unresolvedRichText: 0,
      staleSourceHash: 0
    };
  };
  const coverage: PalworldDataCoverage = {
    palDetails: coverageCount(pals.length, pals.length),
    itemDetails: coverageCount(items.length, items.length),
    skillDetails: coverageCount(skills.length, skills.length),
    palDescriptions: coverageCount(
      pals.filter((pal) =>
        pal.descriptionKo !== undefined
        || pal.descriptionJa !== undefined
        || pal.descriptionEn !== undefined
      ).length,
      pals.length
    ),
    palStats: coverageCount(pals.length, pals.length),
    partnerSkills: coverageCount(
      pals.filter((pal) => pal.partnerSkill !== undefined).length,
      pals.length
    ),
    activeSkills: coverageCount(
      pals.filter((pal) => pal.activeSkills.length > 0).length,
      pals.length
    ),
    palDrops: coverageCount(
      pals.filter((pal) => pal.drops.length > 0).length,
      pals.length
    ),
    breedingFields: coverageCount(pals.length, pals.length),
    itemDescriptions: coverageCount(
      items.filter((item) =>
        item.descriptionKo !== undefined
        || item.descriptionJa !== undefined
        || item.descriptionEn !== undefined
      ).length,
      items.length
    ),
    craftingRecipes: coverageCount(
      items.filter((item) => (item.recipes?.length ?? 0) > 0).length,
      items.length
    ),
    craftingFacilities: coverageCount(0, items.length),
    dropPals: coverageCount(
      items.filter((item) => item.dropPals.length > 0).length,
      items.length
    ),
    technologyLevels: coverageCount(
      items.filter((item) => item.technologyLevel !== undefined).length,
      items.length
    ),
    prices: coverageCount(
      items.filter((item) => item.sellPrice !== undefined).length,
      items.length
    ),
    durability: coverageCount(
      items.filter((item) => item.durability !== undefined).length,
      items.length
    ),
    acquisitionMethods: coverageCount(0, items.length),
    skillDescriptions: coverageCount(
      skills.filter((skill) =>
        skill.descriptionKo !== undefined
        || skill.descriptionJa !== undefined
        || skill.descriptionEn !== undefined
      ).length,
      skills.length
    ),
    relatedPals: coverageCount(
      skills.filter((skill) => skill.relatedPals.length > 0).length,
      skills.length
    ),
    palImages: coverageCount(0, pals.length),
    itemImages: coverageCount(0, items.length),
    elementImages: coverageCount(0, PALWORLD_ELEMENTS.length),
    localization: {
      ko: coverageCount(
        pals.filter((pal) => pal.nameKo !== undefined).length
          + items.filter((item) => item.nameKo !== undefined).length
          + skills.filter((skill) => skill.nameKo !== undefined).length,
        localizedTotal
      ),
      ja: coverageCount(
        pals.filter((pal) => pal.nameJa !== undefined).length
          + items.filter((item) => item.nameJa !== undefined).length
          + skills.filter((skill) => skill.nameJa !== undefined).length,
        localizedTotal
      ),
      en: coverageCount(localizedTotal, localizedTotal)
    },
    translations: {
      ko: translationCoverage("ko"),
      ja: translationCoverage("ja")
    }
  };
  const domains: PalworldDomainCoverageMap = {
    pals: { status: "ready", recordCount: pals.length, metadata: { ...metadata } },
    items: { status: "ready", recordCount: items.length, metadata: { ...metadata } },
    breeding: {
      status: "ready",
      recordCount: breedingPairs.length,
      metadata: { ...metadata }
    },
    skills: { status: "ready", recordCount: skills.length, metadata: { ...metadata } }
  };
  const technicalImageCount = (kind: string): number =>
    technicalAssets.filter((asset) => asset.kind === kind).length;
  const technicalPalImages = technicalImageCount("pal");
  const technicalItemImages = technicalImageCount("item");
  const technicalElementImages = technicalImageCount("element");
  const technicalWorkImages = technicalImageCount("work");
  const technicalSkillImages = technicalImageCount("skill");
  const technicalMapImages = technicalMapAssets.length;
  const gates: PalworldRuntimeGates = {
    dataIntegrity: { passed: true, status: "ready" },
    imageAssets: {
      status: "blocked_by_license",
      policyStatus: "missing",
      technicalPassed: false,
      publicActivationAllowed: false,
      rightsVerified: false,
      usageBasis: "none",
      readyImages: 0,
      fallbackPals: pals.length,
      publicNoticeRequired: true
    }
  };
  const excludedAssignments = asRecords(
    skillsArtifact.assignments,
    "skills.assignments"
  ).filter((assignment) => assignment.status !== "resolved").length;
  const excludedSpecial = Array.isArray(breedingArtifact.excludedSourceRows)
    ? asRecords(
        breedingArtifact.excludedSourceRows,
        "breeding.excludedSourceRows"
      ).length
    : 0;
  const duplicateSpecial = asRecords(
    breedingArtifact.duplicateSourceRows,
    "breeding.duplicateSourceRows"
  ).length;
  return {
    snapshot,
    domains,
    gates,
    coverage,
    sourceInternalIds: Object.freeze({ ...sourceInternalIds }),
    breedingSource,
    report: Object.freeze({
      resolvedActiveAssignments: resolvedAssignments.length,
      excludedActiveAssignments: excludedAssignments,
      unresolvedActiveAssignments: 0,
      resolvedSpecialBreedingRules: breedingRules.length,
      excludedSpecialBreedingRows: excludedSpecial,
      duplicateSpecialBreedingRows: duplicateSpecial,
      unresolvedSpecialBreedingRows: 0,
      technicalPalImages,
      technicalItemImages,
      technicalElementImages,
      technicalWorkImages,
      technicalSkillImages,
      technicalMapImages,
      publicPalImages: 0,
      publicItemImages: 0,
      fallbackPals: pals.length,
      fallbackItems: items.length,
      fallbackElements: PALWORLD_ELEMENTS.length,
      fallbackWorkSuitabilities: PALWORLD_WORK_SUITABILITY_TYPES.length,
      fallbackSkills: skills.length,
      fallbackMap: 1
    })
  };
}

export async function writePalworldPakSnapshotArtifact(input: {
  outputRoot: string;
  snapshot: unknown;
}): Promise<PalworldPakSnapshotWriteResult> {
  const requestedOutputRoot = path.resolve(input.outputRoot);
  const info = await lstat(requestedOutputRoot);
  if (
    info.isSymbolicLink()
    || !info.isDirectory()
  ) {
    fail("outputRoot: symlink가 아닌 directory여야 합니다.");
  }
  const outputRoot = await realpath(requestedOutputRoot);
  const bytes = Buffer.from(
    deterministicPalworldPakSnapshotJson(input.snapshot),
    "utf8"
  );
  const target = path.join(outputRoot, "snapshot.json");
  const temporary = path.join(
    outputRoot,
    `.snapshot-${process.pid}-${randomBytes(8).toString("hex")}.tmp`
  );
  const handle = await open(
    temporary,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o644
  );
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      fail("snapshot.json: 기존 artifact를 덮어쓰지 않습니다.");
    }
    throw error;
  }
  await unlink(temporary);
  return {
    file: "snapshot.json",
    sha256: sha256(bytes),
    bytes: bytes.length
  };
}
