import { PALWORLD_WORK_SUITABILITY_TYPES, type PalworldWorkSuitabilityType } from "@streamops/shared";
import generatedAssets from "../data/palworld-static-assets.generated.json";

const WORK_ICON_PATTERN =
  /^\/images\/palworld\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\/work\/[a-f0-9]{64}\.webp$/u;
const MAP_RELEASE_PATTERN =
  /^\/images\/palworld\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\/maps\/[a-f0-9]{64}\.webp$/u;
const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function verifiedWorkIconUrls(): Readonly<Partial<Record<PalworldWorkSuitabilityType, string>>> {
  const source = generatedAssets.workSource;
  if (
    generatedAssets.schemaVersion !== 1
    || !RELEASE_PATTERN.test(source.release)
    || MAP_RELEASE_PATTERN.exec(generatedAssets.map.imageUrl)?.[1] !== source.release
    || source.sourceType !== "operator_pak_export"
    || !SHA256_PATTERN.test(source.sourceArchiveSha256)
    || !SHA256_PATTERN.test(source.mappingSha256)
    || source.candidateRelease !== `candidate-${source.sourceArchiveSha256.slice(0, 16)}`
    || source.mappingStatus !== "verified_colored_source_member"
    || source.status !== "operator_acknowledged"
    || source.usageBasis !== "operator_reference_use"
    || source.rightsVerified
    || generatedAssets.work.length !== PALWORLD_WORK_SUITABILITY_TYPES.length
  ) return Object.freeze({});
  const entries = new Map<PalworldWorkSuitabilityType, string>();
  const duplicates = new Set<PalworldWorkSuitabilityType>();
  for (const entry of generatedAssets.work) {
    if (
      !PALWORLD_WORK_SUITABILITY_TYPES.includes(entry.id as PalworldWorkSuitabilityType)
      || WORK_ICON_PATTERN.exec(entry.imageUrl)?.[1] !== source.release
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
  if (
    entries.size !== PALWORLD_WORK_SUITABILITY_TYPES.length
    || PALWORLD_WORK_SUITABILITY_TYPES.some((id) => !entries.has(id))
  ) return Object.freeze({});
  return Object.freeze(Object.fromEntries(entries));
}

const workIconUrls = verifiedWorkIconUrls();

export function workSuitabilityIconUrl(type: PalworldWorkSuitabilityType): string | undefined {
  return workIconUrls[type];
}
