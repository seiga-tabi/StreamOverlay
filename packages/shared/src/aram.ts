export const ARAM_AUGMENT_RARITIES = ["silver", "gold", "prismatic", "legend"] as const;

export type AramAugmentRarity = (typeof ARAM_AUGMENT_RARITIES)[number];

export type AramAugmentCatalogStatus = "preparing" | "ready";

export type AramAugment = {
  id: string;
  nameKo: string;
  nameJa: string;
  descriptionKo: string;
  descriptionJa: string;
  rarity: AramAugmentRarity;
  iconUrl?: string;
};

export type AramAugmentCatalog = {
  schemaVersion: 1;
  mode: "aram_augments";
  status: AramAugmentCatalogStatus;
  dataVersion: string;
  sourceRevision: string;
  augments: AramAugment[];
};

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function hasExactKeys(record: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(record, key))
    && Object.keys(record).every((key) => allowed.has(key));
}

function boundedText(value: unknown, maxLength: number, allowEmpty = false): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > maxLength) return undefined;
  return normalized;
}

function safeAramIconUrl(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  return /^\/images\/lol\/aram\/[a-f0-9]{64}\.webp$/.test(value) ? value : undefined;
}

export function parseAramAugmentCatalog(value: unknown): AramAugmentCatalog | undefined {
  const record = recordOf(value);
  if (!record || !hasExactKeys(record, [
    "schemaVersion",
    "mode",
    "status",
    "dataVersion",
    "sourceRevision",
    "augments"
  ])) return undefined;
  if (record.schemaVersion !== 1 || record.mode !== "aram_augments") return undefined;
  if (record.status !== "preparing" && record.status !== "ready") return undefined;
  const dataVersion = boundedText(record.dataVersion, 80);
  const sourceRevision = boundedText(record.sourceRevision, 160);
  if (!dataVersion || !sourceRevision || !Array.isArray(record.augments) || record.augments.length > 1_000) return undefined;

  const ids = new Set<string>();
  const augments: AramAugment[] = [];
  for (const candidate of record.augments) {
    const augment = recordOf(candidate);
    if (!augment || !hasExactKeys(augment, [
      "id",
      "nameKo",
      "nameJa",
      "descriptionKo",
      "descriptionJa",
      "rarity"
    ], ["iconUrl"])) return undefined;
    const id = boundedText(augment.id, 80);
    const nameKo = boundedText(augment.nameKo, 120);
    const nameJa = boundedText(augment.nameJa, 120);
    const descriptionKo = boundedText(augment.descriptionKo, 2_000);
    const descriptionJa = boundedText(augment.descriptionJa, 2_000);
    const iconUrl = safeAramIconUrl(augment.iconUrl);
    if (!id || ids.has(id) || !/^[a-z0-9][a-z0-9._-]*$/.test(id)) return undefined;
    if (!nameKo || !nameJa || !descriptionKo || !descriptionJa) return undefined;
    if (!(ARAM_AUGMENT_RARITIES as readonly unknown[]).includes(augment.rarity)) return undefined;
    if (augment.iconUrl !== undefined && !iconUrl) return undefined;
    ids.add(id);
    augments.push({
      id,
      nameKo,
      nameJa,
      descriptionKo,
      descriptionJa,
      rarity: augment.rarity as AramAugmentRarity,
      ...(iconUrl ? { iconUrl } : {})
    });
  }
  if (record.status === "ready" && augments.length === 0) return undefined;
  if (record.status === "preparing" && augments.length > 0) return undefined;

  return {
    schemaVersion: 1,
    mode: "aram_augments",
    status: record.status,
    dataVersion,
    sourceRevision,
    augments
  };
}
