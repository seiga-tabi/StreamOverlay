import {
  PALWORLD_PUBLIC_NOTICE_JA,
  PALWORLD_PUBLIC_NOTICE_KO
} from "@streamops/shared";
import {
  PALWORLD_PALDEX_EXPECTED_COUNT,
  PALWORLD_PALDEX_RELEASE,
  PalworldPaldexValidationError,
  type PalworldPaldexArtifact
} from "./palworld-paldex-artifact.js";

export { PALWORLD_PUBLIC_NOTICE_JA, PALWORLD_PUBLIC_NOTICE_KO };

export const PALWORLD_IMAGE_POLICY_FILE_NAME = "image-use-policy.json";
export const PALWORLD_IMAGE_SOURCE_MAP_FILE_NAME = "image-source-map.json";
export const PALWORLD_IMAGE_SOURCE_TYPES = [
  "operator_controlled_server_export",
  "operator_provided_archive"
] as const;

export type PalworldImageSourceType = (typeof PALWORLD_IMAGE_SOURCE_TYPES)[number];

export type PalworldImageUsePolicy = {
  schemaVersion: 1;
  release: "1.0.1";
  status: "blocked_by_license" | "operator_acknowledged" | "ready";
  usageBasis: "none" | "operator_reference_use" | "rights_verified";
  sourceType: PalworldImageSourceType;
  sourceDescription: string;
  acknowledgedAt: string;
  publicNoticeKo: string;
  publicNoticeJa: string;
  takedownContact: string;
  allowPublicDisplay: boolean;
  allowSelfHosting: boolean;
  allowResize: boolean;
  allowWebpConversion: boolean;
  rightsVerified: boolean;
};

export type PalworldImageSourceMapEntry = {
  palId: string;
  sourceInternalId: string;
  sourceFileName: string;
  sourceRevision: string;
  sourceKind: PalworldImageSourceType;
};

export type PalworldImageSourceMap = {
  schemaVersion: 1;
  release: "1.0.1";
  entries: PalworldImageSourceMapEntry[];
};

export function palworldImageSourceReference(
  sourceType: PalworldImageSourceType,
  sourceInternalId: string
): string {
  const prefix = sourceType === "operator_provided_archive"
    ? "operator-archive"
    : "operator-export";
  return `${prefix}-${sourceInternalId}`;
}

function fail(pathName: string, message: string): never {
  throw new PalworldPaldexValidationError(`${pathName}: ${message}`);
}

function recordAt(value: unknown, pathName: string, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(pathName, "객체여야 합니다.");
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record);
  const allowed = new Set(keys);
  for (const key of actualKeys) if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  for (const key of keys) if (!(key in record)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  return record;
}

function stringAt(value: unknown, pathName: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail(pathName, `제어 문자가 없는 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function booleanAt(value: unknown, pathName: string): boolean {
  if (typeof value !== "boolean") fail(pathName, "boolean이어야 합니다.");
  return value;
}

function isoDateAt(value: unknown, pathName: string): string {
  const text = stringAt(value, pathName, 64);
  if (Number.isNaN(Date.parse(text)) || new Date(text).toISOString() !== text) {
    fail(pathName, "UTC ISO-8601 고정 시각이어야 합니다.");
  }
  return text;
}

export function assertPalworldImageUsePolicy(value: unknown): PalworldImageUsePolicy {
  const policy = recordAt(value, "imageUsePolicy", [
    "schemaVersion",
    "release",
    "status",
    "usageBasis",
    "sourceType",
    "sourceDescription",
    "acknowledgedAt",
    "publicNoticeKo",
    "publicNoticeJa",
    "takedownContact",
    "allowPublicDisplay",
    "allowSelfHosting",
    "allowResize",
    "allowWebpConversion",
    "rightsVerified"
  ]);
  if (policy.schemaVersion !== 1) fail("imageUsePolicy.schemaVersion", "1이어야 합니다.");
  if (policy.release !== PALWORLD_PALDEX_RELEASE) fail("imageUsePolicy.release", `${PALWORLD_PALDEX_RELEASE}이어야 합니다.`);
  if (!(["blocked_by_license", "operator_acknowledged", "ready"] as const).includes(policy.status as never)) {
    fail("imageUsePolicy.status", "허용된 상태가 아닙니다.");
  }
  if (!(["none", "operator_reference_use", "rights_verified"] as const).includes(policy.usageBasis as never)) {
    fail("imageUsePolicy.usageBasis", "허용된 사용 근거가 아닙니다.");
  }
  if (!(PALWORLD_IMAGE_SOURCE_TYPES as readonly unknown[]).includes(policy.sourceType)) {
    fail("imageUsePolicy.sourceType", "허용된 운영자 제공 이미지 출처가 아닙니다.");
  }
  stringAt(policy.sourceDescription, "imageUsePolicy.sourceDescription", 512);
  isoDateAt(policy.acknowledgedAt, "imageUsePolicy.acknowledgedAt");
  if (policy.publicNoticeKo !== PALWORLD_PUBLIC_NOTICE_KO) fail("imageUsePolicy.publicNoticeKo", "공개 UI 공지와 정확히 일치해야 합니다.");
  if (policy.publicNoticeJa !== PALWORLD_PUBLIC_NOTICE_JA) fail("imageUsePolicy.publicNoticeJa", "공개 UI 공지와 정확히 일치해야 합니다.");
  const takedownContact = stringAt(policy.takedownContact, "imageUsePolicy.takedownContact", 320);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(takedownContact) && !takedownContact.startsWith("https://")) {
    fail("imageUsePolicy.takedownContact", "공개 이메일 또는 https 문의 주소여야 합니다.");
  }
  const allowPublicDisplay = booleanAt(policy.allowPublicDisplay, "imageUsePolicy.allowPublicDisplay");
  const allowSelfHosting = booleanAt(policy.allowSelfHosting, "imageUsePolicy.allowSelfHosting");
  const allowResize = booleanAt(policy.allowResize, "imageUsePolicy.allowResize");
  const allowWebpConversion = booleanAt(policy.allowWebpConversion, "imageUsePolicy.allowWebpConversion");
  const rightsVerified = booleanAt(policy.rightsVerified, "imageUsePolicy.rightsVerified");
  const allAllowed = allowPublicDisplay && allowSelfHosting && allowResize && allowWebpConversion;
  if (policy.status === "blocked_by_license") {
    if (
      policy.usageBasis !== "none"
      || allowPublicDisplay
      || allowSelfHosting
      || allowResize
      || allowWebpConversion
      || rightsVerified
    ) {
      fail("imageUsePolicy", "blocked 상태는 사용 근거 없음, 공개/변환 차단, 권리 미검증이어야 합니다.");
    }
  } else if (policy.status === "operator_acknowledged") {
    if (policy.usageBasis !== "operator_reference_use" || !allAllowed || rightsVerified) {
      fail("imageUsePolicy", "operator_acknowledged 상태는 운영자 참조 사용, 모든 기술 허용, 권리 미검증이어야 합니다.");
    }
  } else if (policy.usageBasis !== "rights_verified" || !allAllowed || !rightsVerified) {
    fail("imageUsePolicy", "ready 상태는 별도로 검증된 권리 근거와 모든 기술 허용이 필요합니다.");
  }
  return value as PalworldImageUsePolicy;
}

function assertSafeSourceFileName(value: unknown, pathName: string): string {
  const fileName = stringAt(value, pathName, 255);
  if (
    fileName === "."
    || fileName === ".."
    || fileName.includes("..")
    || fileName.includes("/")
    || fileName.includes("\\")
    || fileName.includes("%")
    || fileName.startsWith(".")
    || fileName.endsWith(".")
    || fileName.trim() !== fileName
    || !/\.(?:png|webp)$/u.test(fileName)
  ) {
    fail(pathName, "경로 요소나 우회 문자가 없는 .png 또는 .webp basename이어야 합니다.");
  }
  return fileName;
}

export function assertPalworldImageSourceMap(
  value: unknown,
  artifact: PalworldPaldexArtifact
): PalworldImageSourceMap {
  const mapping = recordAt(value, "imageSourceMap", ["schemaVersion", "release", "entries"]);
  if (mapping.schemaVersion !== 1) fail("imageSourceMap.schemaVersion", "1이어야 합니다.");
  if (mapping.release !== PALWORLD_PALDEX_RELEASE) fail("imageSourceMap.release", `${PALWORLD_PALDEX_RELEASE}이어야 합니다.`);
  if (!Array.isArray(mapping.entries) || mapping.entries.length > PALWORLD_PALDEX_EXPECTED_COUNT) {
    fail("imageSourceMap.entries", `최대 ${PALWORLD_PALDEX_EXPECTED_COUNT}개 canonical mapping이어야 합니다.`);
  }
  const palById = new Map(artifact.records.map((pal, index) => [pal.id, { pal, index }]));
  const seenPalIds = new Set<string>();
  const seenInternalIds = new Set<string>();
  for (const [index, rawEntry] of mapping.entries.entries()) {
    const pathName = `imageSourceMap.entries[${index}]`;
    const entry = recordAt(rawEntry, pathName, [
      "palId",
      "sourceInternalId",
      "sourceFileName",
      "sourceRevision",
      "sourceKind"
    ]);
    const palId = stringAt(entry.palId, `${pathName}.palId`, 96);
    const sourceInternalId = stringAt(entry.sourceInternalId, `${pathName}.sourceInternalId`, 128);
    const sourceFileName = assertSafeSourceFileName(entry.sourceFileName, `${pathName}.sourceFileName`);
    const sourceRevision = stringAt(entry.sourceRevision, `${pathName}.sourceRevision`, 128);
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/u.test(sourceRevision)
      || /^(?:latest|main|master|head)$/iu.test(sourceRevision)
      || sourceRevision.includes("://")
    ) {
      fail(`${pathName}.sourceRevision`, "고정된 opaque revision이어야 하며 branch/latest/URL은 허용되지 않습니다.");
    }
    if (!(PALWORLD_IMAGE_SOURCE_TYPES as readonly unknown[]).includes(entry.sourceKind)) {
      fail(`${pathName}.sourceKind`, "허용된 운영자 제공 이미지 출처가 아닙니다.");
    }
    const canonical = palById.get(palId);
    if (!canonical || canonical.pal.sourceInternalId !== sourceInternalId) {
      fail(pathName, "canonical Pal ID와 sourceInternalId의 exact join 및 순서가 일치하지 않습니다.");
    }
    const previousPalId = index > 0 ? (mapping.entries[index - 1] as Record<string, unknown>).palId : undefined;
    const previous = typeof previousPalId === "string" ? palById.get(previousPalId) : undefined;
    if (previous && previous.index >= canonical.index) fail(pathName, "도감과 같은 canonical 순서여야 합니다.");
    if (seenPalIds.has(palId) || seenInternalIds.has(sourceInternalId)) fail(pathName, "중복 Pal mapping입니다.");
    seenPalIds.add(palId);
    seenInternalIds.add(sourceInternalId);
  }
  return value as PalworldImageSourceMap;
}
