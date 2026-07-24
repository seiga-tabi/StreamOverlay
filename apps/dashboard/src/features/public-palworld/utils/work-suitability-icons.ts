import { PALWORLD_WORK_SUITABILITY_TYPES, type PalworldWorkSuitabilityType } from "@streamops/shared";
import generatedAssets from "../data/palworld-static-assets.generated.json";

const WORK_ICON_PATTERN =
  /^\/images\/palworld\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\/work\/[a-f0-9]{64}\.webp$/u;
const FILTER_WORK_ICON_PATTERN =
  /^\/images\/palworld\/work\/[a-f0-9]{64}\.webp$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function verifiedWorkIconUrls(): Readonly<Partial<Record<PalworldWorkSuitabilityType, string>>> {
  const source = generatedAssets.workSource;
  if (
    generatedAssets.schemaVersion !== 1
    || source.candidateRelease.startsWith("candidate-")
    || source.mappingStatus !== "verified_colored_source_member"
    || source.status !== "operator_acknowledged"
    || source.usageBasis !== "operator_reference_use"
    || source.rightsVerified
  ) return Object.freeze({});
  const entries = new Map<PalworldWorkSuitabilityType, string>();
  const duplicates = new Set<PalworldWorkSuitabilityType>();
  for (const entry of generatedAssets.work) {
    if (
      !PALWORLD_WORK_SUITABILITY_TYPES.includes(entry.id as PalworldWorkSuitabilityType)
      || !WORK_ICON_PATTERN.test(entry.imageUrl)
      || entry.width !== 64
      || entry.height !== 64
    ) continue;
    const id = entry.id as PalworldWorkSuitabilityType;
    if (entries.has(id)) {
      duplicates.add(id);
      continue;
    }
    entries.set(id, entry.imageUrl);
  }
  for (const id of duplicates) entries.delete(id);
  return Object.freeze(Object.fromEntries(entries));
}

const workIconUrls = verifiedWorkIconUrls();

export function workSuitabilityIconUrl(type: PalworldWorkSuitabilityType): string | undefined {
  return workIconUrls[type];
}

function verifiedFilterWorkIconUrls(): Readonly<Partial<Record<PalworldWorkSuitabilityType, string>>> {
  const source = generatedAssets.workSource;
  if (
    generatedAssets.schemaVersion !== 1
    || !SHA256_PATTERN.test(source.sourceArchiveSha256)
    || source.candidateRelease !== `candidate-${source.sourceArchiveSha256.slice(0, 16)}`
    || source.mappingStatus !== "verified_colored_source_member"
    || source.status !== "operator_acknowledged"
    || source.usageBasis !== "operator_reference_use"
    || source.rightsVerified
  ) return Object.freeze({});

  const entries = new Map<PalworldWorkSuitabilityType, string>();
  const duplicates = new Set<PalworldWorkSuitabilityType>();
  for (const entry of generatedAssets.work) {
    if (
      !PALWORLD_WORK_SUITABILITY_TYPES.includes(entry.id as PalworldWorkSuitabilityType)
      || !FILTER_WORK_ICON_PATTERN.test(entry.imageUrl)
      || entry.width !== 64
      || entry.height !== 64
    ) continue;
    const id = entry.id as PalworldWorkSuitabilityType;
    if (entries.has(id)) {
      duplicates.add(id);
      continue;
    }
    entries.set(id, entry.imageUrl);
  }
  for (const id of duplicates) entries.delete(id);
  return Object.freeze(Object.fromEntries(entries));
}

const filterWorkIconUrls = verifiedFilterWorkIconUrls();

export function workSuitabilityFilterIconUrl(
  type: PalworldWorkSuitabilityType,
): string | undefined {
  return filterWorkIconUrls[type];
}
