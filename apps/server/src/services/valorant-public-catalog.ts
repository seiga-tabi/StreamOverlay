import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateValorantAgentCatalogResponse,
  validateValorantMapCatalogResponse,
  validateValorantWeaponCatalogResponse,
  type ValorantAct,
  type ValorantAgent,
  type ValorantCatalogResponse,
  type ValorantLocalizedText,
  type ValorantMap,
  type ValorantPublicMetadata,
  type ValorantWeapon
} from "@streamops/shared";

type ValorantPublicCatalogArtifact = {
  schemaVersion: 1;
  metadata: ValorantPublicMetadata;
  agents: ValorantAgent[];
  weapons: ValorantWeapon[];
  maps: ValorantMap[];
  acts: ValorantAct[];
  queues: Array<{ id: string; name: ValorantLocalizedText }>;
};

export class ValorantCatalogError extends Error {
  constructor(readonly code: "invalid_query" | "artifact_unavailable") {
    super(code);
    this.name = "ValorantCatalogError";
  }
}

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DEFAULT_ARTIFACT_PATH = path.resolve(
  PROJECT_ROOT,
  "apps/server/data/valorant/public-content-12.08.json"
);
const EXPECTED_GAME_VERSION = "12.08.00.4578383";
const EXPECTED_SOURCE_NAME = "Riot Games Public Content Catalog";
const EXPECTED_SOURCE_URL = "https://valorant.dyn.riotcdn.net/x/content-catalog/PublicContentCatalog-release-12.08.zip";
const RIOT_UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;

function validLocalizedText(value: unknown): value is ValorantLocalizedText {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 2
    && typeof item.ko === "string"
    && item.ko.trim().length > 0
    && item.ko.length <= 2_000
    && typeof item.ja === "string"
    && item.ja.trim().length > 0
    && item.ja.length <= 2_000;
}

function validActs(value: unknown): value is ValorantAct[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return false;
  const ids = new Set<string>();
  return value.every((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const item = candidate as Record<string, unknown>;
    if (
      Object.keys(item).some((key) => !["id", "name"].includes(key))
      || typeof item.id !== "string"
      || !RIOT_UUID_PATTERN.test(item.id)
      || ids.has(item.id)
      || !validLocalizedText(item.name)
    ) return false;
    ids.add(item.id);
    return true;
  });
}

function validQueues(value: unknown): value is Array<{ id: string; name: ValorantLocalizedText }> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return false;
  const ids = new Set<string>();
  return value.every((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const item = candidate as Record<string, unknown>;
    if (
      Object.keys(item).some((key) => !["id", "name"].includes(key))
      || typeof item.id !== "string"
      || !/^[a-z0-9_-]{1,128}$/u.test(item.id)
      || ids.has(item.id)
      || !validLocalizedText(item.name)
    ) return false;
    ids.add(item.id);
    return true;
  });
}

function exactArtifact(value: unknown): ValorantPublicCatalogArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValorantCatalogError("artifact_unavailable");
  const record = value as Record<string, unknown>;
  const keys = ["schemaVersion", "metadata", "agents", "weapons", "maps", "acts", "queues"];
  if (record.schemaVersion !== 1 || Object.keys(record).some((key) => !keys.includes(key))) {
    throw new ValorantCatalogError("artifact_unavailable");
  }
  const page = (items: unknown) => ({
    state: "ready" as const,
    items,
    offset: 0,
    limit: Array.isArray(items) ? Math.max(1, items.length) : 1,
    total: Array.isArray(items) ? items.length : 0,
    returned: Array.isArray(items) ? items.length : 0,
    hasMore: false,
    metadata: record.metadata
  });
  const agents = validateValorantAgentCatalogResponse(page(record.agents));
  const weapons = validateValorantWeaponCatalogResponse(page(record.weapons));
  const maps = validateValorantMapCatalogResponse(page(record.maps));
  if (
    !agents.ok
    || !weapons.ok
    || !maps.ok
    || agents.data.state !== "ready"
    || agents.data.metadata.gameVersion !== EXPECTED_GAME_VERSION
    || agents.data.metadata.sourceName !== EXPECTED_SOURCE_NAME
    || agents.data.metadata.sourceUrl !== EXPECTED_SOURCE_URL
    || !validActs(record.acts)
    || !validQueues(record.queues)
  ) {
    throw new ValorantCatalogError("artifact_unavailable");
  }
  return record as ValorantPublicCatalogArtifact;
}

function parsePageQuery(searchParams: URLSearchParams): { offset: number; limit: number } {
  const allowed = new Set(["offset", "limit"]);
  if (
    [...searchParams.keys()].some((key) => !allowed.has(key))
    || [...allowed].some((key) => searchParams.getAll(key).length > 1)
  ) throw new ValorantCatalogError("invalid_query");
  const offsetText = searchParams.get("offset") ?? "0";
  const limitText = searchParams.get("limit") ?? "50";
  if (!/^(?:0|[1-9]\d{0,4})$/u.test(offsetText) || !/^[1-9]\d{0,2}$/u.test(limitText)) {
    throw new ValorantCatalogError("invalid_query");
  }
  const offset = Number(offsetText);
  const limit = Number(limitText);
  if (offset > 100_000 || limit > 100) throw new ValorantCatalogError("invalid_query");
  return { offset, limit };
}

export class ValorantPublicCatalogService {
  private constructor(private readonly artifact: ValorantPublicCatalogArtifact) {}

  static load(artifactPath = DEFAULT_ARTIFACT_PATH): ValorantPublicCatalogService {
    try {
      const raw = fs.readFileSync(artifactPath, "utf8");
      if (Buffer.byteLength(raw, "utf8") > 2 * 1024 * 1024) throw new Error("artifact_too_large");
      return new ValorantPublicCatalogService(exactArtifact(JSON.parse(raw) as unknown));
    } catch (error) {
      if (error instanceof ValorantCatalogError) throw error;
      throw new ValorantCatalogError("artifact_unavailable");
    }
  }

  private page<T>(items: readonly T[], searchParams: URLSearchParams): ValorantCatalogResponse<T> {
    const { offset, limit } = parsePageQuery(searchParams);
    const pageItems = items.slice(offset, offset + limit);
    return {
      state: "ready",
      items: pageItems,
      offset,
      limit,
      total: items.length,
      returned: pageItems.length,
      hasMore: offset + pageItems.length < items.length,
      metadata: this.artifact.metadata
    };
  }

  agents(searchParams: URLSearchParams): ValorantCatalogResponse<ValorantAgent> {
    return this.page(this.artifact.agents, searchParams);
  }

  weapons(searchParams: URLSearchParams): ValorantCatalogResponse<ValorantWeapon> {
    return this.page(this.artifact.weapons, searchParams);
  }

  maps(searchParams: URLSearchParams): ValorantCatalogResponse<ValorantMap> {
    return this.page(this.artifact.maps, searchParams);
  }

  acts(limit = 12): readonly ValorantAct[] {
    return this.artifact.acts.slice(0, limit);
  }

  act(id: string): ValorantAct | undefined {
    return this.artifact.acts.find((act) => act.id === id.toLowerCase());
  }

  agentName(id: string): ValorantLocalizedText {
    return this.artifact.agents.find((agent) => agent.id === id.toLowerCase())?.name
      ?? { ko: "알 수 없는 요원", ja: "不明なエージェント" };
  }

  mapName(id: string): ValorantLocalizedText {
    return this.artifact.maps.find((map) => map.id === id.toLowerCase())?.name
      ?? { ko: "알 수 없는 맵", ja: "不明なマップ" };
  }

  queueName(id: string): ValorantLocalizedText {
    return this.artifact.queues.find((queue) => queue.id === id.toLowerCase())?.name
      ?? { ko: "알 수 없는 대기열", ja: "不明なキュー" };
  }
}
