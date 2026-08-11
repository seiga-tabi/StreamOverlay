export type ValorantLocalizedText = Readonly<{ ko: string; ja: string }>;

export type ValorantPublicMetadata = Readonly<{
  gameVersion: string;
  sourceName: string;
  sourceUrl: string;
  extractedAt: string;
  verifiedAt: string;
  license: string;
}>;

export type ValorantPagination = Readonly<{
  offset: number;
  limit: number;
  total: number;
  returned: number;
  hasMore: boolean;
}>;

export type ValorantAgent = Readonly<{
  id: string;
  name: ValorantLocalizedText;
  role: Readonly<{ id: string; name: ValorantLocalizedText }>;
  description: ValorantLocalizedText;
  skills: readonly Readonly<{
    key: "Q" | "E" | "C" | "X";
    name: ValorantLocalizedText;
    description: ValorantLocalizedText;
  }>[];
  imageUrl?: string;
}>;

export type ValorantWeapon = Readonly<{
  id: string;
  name: ValorantLocalizedText;
  category: Readonly<{ id: string; name: ValorantLocalizedText }>;
  creditCost: number | null;
  imageUrl?: string;
}>;

export type ValorantMap = Readonly<{
  id: string;
  name: ValorantLocalizedText;
  sites: readonly string[];
  note?: ValorantLocalizedText;
  imageUrl?: string;
}>;

export type ValorantCatalogResponse<T> =
  | Readonly<{ state: "data_unavailable" }>
  | Readonly<{
      state: "ready";
      items: readonly T[];
      offset: number;
      limit: number;
      total: number;
      returned: number;
      hasMore: boolean;
      metadata: ValorantPublicMetadata;
    }>;

export type ValorantLeaderboardRegion = "kr" | "ap" | "na";
export type ValorantAct = Readonly<{ id: string; name: ValorantLocalizedText }>;
export type ValorantLeaderboardResponse =
  | Readonly<{ state: "approval_pending" }>
  | Readonly<{ state: "data_unavailable" }>
  | Readonly<{
      state: "ready";
      act: ValorantAct;
      acts: readonly ValorantAct[];
      region: ValorantLeaderboardRegion;
      entries: readonly Readonly<{
        rank: number;
        anonymous: boolean;
        riotId?: string;
        rankedRating: number;
        wins: number;
      }>[];
      updatedAt: string;
    }>;

export type ValorantStreamerSummary = Readonly<{
  id: string;
  displayName: string;
  riotTag?: string;
}>;

export type ValorantStreamerListResponse =
  | Readonly<{ state: "approval_pending" }>
  | Readonly<{ state: "data_unavailable" }>
  | Readonly<{ state: "ready"; streamers: readonly ValorantStreamerSummary[] }>;

export type ValorantStreamerMatchesResponse =
  | Readonly<{ state: "approval_pending" }>
  | Readonly<{ state: "data_unavailable" }>
  | Readonly<{
      state: "ready";
      profile: Readonly<{
        displayName: string;
        riotTag: string;
        consentBadge: true;
      }>;
      offset: number;
      limit: number;
      total: number;
      returned: number;
      hasMore: boolean;
      matches: readonly Readonly<{
        matchId: string;
        queue: Readonly<{ id: string; name: ValorantLocalizedText }>;
        map: Readonly<{ id: string; name: ValorantLocalizedText }>;
        agent: Readonly<{ id: string; name: ValorantLocalizedText }>;
        win: boolean;
        roundsWon: number;
        roundsLost: number;
        kills: number;
        deaths: number;
        assists: number;
        headshotPercent: number | null;
        startedAt: string;
        durationSeconds: number;
        detail?: Readonly<{
          adr: number | null;
          firstKills: number | null;
          plants: number | null;
          defuses: number | null;
          halves?: readonly Readonly<{ won: number; lost: number }>[];
        }>;
      }>[];
    }>;

export type ValorantValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const RIOT_UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;

function exactRecord(
  value: unknown,
  allowed: readonly string[],
  path: string
): ValorantValidationResult<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: `${path}_object_required` };
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    return { ok: false, error: `${path}_unknown_field` };
  }
  return { ok: true, data: record };
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function nonNegativeInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function canonicalIso(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && new Date(value).toISOString() === value;
}

function localized(value: unknown, path: string): ValorantValidationResult<ValorantLocalizedText> {
  const result = exactRecord(value, ["ko", "ja"], path);
  if (!result.ok) return result;
  if (!boundedString(result.data.ko, 2_000) || !boundedString(result.data.ja, 2_000)) {
    return { ok: false, error: `${path}_invalid` };
  }
  return { ok: true, data: { ko: result.data.ko, ja: result.data.ja } };
}

function metadata(value: unknown): ValorantValidationResult<ValorantPublicMetadata> {
  const result = exactRecord(
    value,
    ["gameVersion", "sourceName", "sourceUrl", "extractedAt", "verifiedAt", "license"],
    "metadata"
  );
  if (!result.ok) return result;
  if (
    !boundedString(result.data.gameVersion, 80)
    || !boundedString(result.data.sourceName, 120)
    || !boundedString(result.data.sourceUrl, 2_048)
    || !boundedString(result.data.license, 500)
    || !canonicalIso(result.data.extractedAt)
    || !canonicalIso(result.data.verifiedAt)
    || result.data.verifiedAt < result.data.extractedAt
  ) return { ok: false, error: "metadata_invalid" };
  try {
    const source = new URL(result.data.sourceUrl);
    if (source.protocol !== "https:" || source.username || source.password) {
      return { ok: false, error: "metadata_source_url_invalid" };
    }
  } catch {
    return { ok: false, error: "metadata_source_url_invalid" };
  }
  return { ok: true, data: result.data as ValorantPublicMetadata };
}

function pagination(value: unknown, itemLength: number): ValorantValidationResult<ValorantPagination> {
  const result = exactRecord(value, ["offset", "limit", "total", "returned", "hasMore"], "pagination");
  if (!result.ok) return result;
  if (
    !nonNegativeInteger(result.data.offset, 100_000)
    || !nonNegativeInteger(result.data.limit, 100)
    || result.data.limit < 1
    || !nonNegativeInteger(result.data.total, 100_000)
    || !nonNegativeInteger(result.data.returned, 100)
    || result.data.returned !== itemLength
    || result.data.returned > result.data.limit
    || typeof result.data.hasMore !== "boolean"
    || result.data.hasMore !== (result.data.offset + result.data.returned < result.data.total)
  ) return { ok: false, error: "pagination_invalid" };
  return { ok: true, data: result.data as ValorantPagination };
}

function localImageUrl(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 500
    && /^\/images\/valorant\/[A-Za-z0-9._-]+\/[A-Za-z0-9_./-]+$/u.test(value)
    && !value.includes("..")
    && !value.includes("//");
}

function catalogEnvelope<T>(
  value: unknown,
  itemParser: (item: unknown, index: number) => ValorantValidationResult<T>
): ValorantValidationResult<ValorantCatalogResponse<T>> {
  const root = exactRecord(
    value,
    ["state", "items", "offset", "limit", "total", "returned", "hasMore", "metadata"],
    "response"
  );
  if (!root.ok) return root;
  if (root.data.state === "data_unavailable") {
    return Object.keys(root.data).length === 1
      ? { ok: true, data: { state: "data_unavailable" } }
      : { ok: false, error: "data_unavailable_shape_invalid" };
  }
  if (root.data.state !== "ready" || !Array.isArray(root.data.items) || root.data.items.length > 100) {
    return { ok: false, error: "catalog_state_invalid" };
  }
  const items: T[] = [];
  for (let index = 0; index < root.data.items.length; index += 1) {
    const parsed = itemParser(root.data.items[index], index);
    if (!parsed.ok) return parsed;
    items.push(parsed.data);
  }
  const page = pagination({
    offset: root.data.offset,
    limit: root.data.limit,
    total: root.data.total,
    returned: root.data.returned,
    hasMore: root.data.hasMore
  }, items.length);
  if (!page.ok) return page;
  const meta = metadata(root.data.metadata);
  if (!meta.ok) return meta;
  return { ok: true, data: { state: "ready", items, ...page.data, metadata: meta.data } };
}

function entityBase(
  value: unknown,
  allowed: readonly string[],
  path: string
): ValorantValidationResult<Record<string, unknown> & { id: string; name: ValorantLocalizedText }> {
  const result = exactRecord(value, allowed, path);
  if (!result.ok) return result as ValorantValidationResult<Record<string, unknown> & { id: string; name: ValorantLocalizedText }>;
  const name = localized(result.data.name, `${path}_name`);
  if (!boundedString(result.data.id, 128) || !name.ok) {
    return { ok: false, error: `${path}_identity_invalid` };
  }
  return { ok: true, data: { ...result.data, id: result.data.id, name: name.data } };
}

export function validateValorantAgentCatalogResponse(
  value: unknown
): ValorantValidationResult<ValorantCatalogResponse<ValorantAgent>> {
  return catalogEnvelope(value, (item, index) => {
    const base = entityBase(item, ["id", "name", "role", "description", "skills", "imageUrl"], `agent_${index}`);
    if (!base.ok) return base as ValorantValidationResult<ValorantAgent>;
    const role = entityBase(base.data.role, ["id", "name"], `agent_${index}_role`);
    const description = localized(base.data.description, `agent_${index}_description`);
    if (!role.ok || !description.ok || !Array.isArray(base.data.skills) || base.data.skills.length > 4) {
      return { ok: false, error: `agent_${index}_invalid` };
    }
    const skills: ValorantAgent["skills"][number][] = [];
    for (let skillIndex = 0; skillIndex < base.data.skills.length; skillIndex += 1) {
      const skill = exactRecord(base.data.skills[skillIndex], ["key", "name", "description"], `agent_${index}_skill_${skillIndex}`);
      if (!skill.ok || !["Q", "E", "C", "X"].includes(String(skill.data.key))) {
        return { ok: false, error: `agent_${index}_skill_${skillIndex}_invalid` };
      }
      const name = localized(skill.data.name, `agent_${index}_skill_${skillIndex}_name`);
      const skillDescription = localized(skill.data.description, `agent_${index}_skill_${skillIndex}_description`);
      if (!name.ok || !skillDescription.ok) return { ok: false, error: `agent_${index}_skill_${skillIndex}_invalid` };
      skills.push({ key: skill.data.key as "Q" | "E" | "C" | "X", name: name.data, description: skillDescription.data });
    }
    if (base.data.imageUrl !== undefined && !localImageUrl(base.data.imageUrl)) {
      return { ok: false, error: `agent_${index}_image_invalid` };
    }
    return { ok: true, data: {
      id: base.data.id,
      name: base.data.name,
      role: { id: role.data.id, name: role.data.name },
      description: description.data,
      skills,
      ...(typeof base.data.imageUrl === "string" ? { imageUrl: base.data.imageUrl } : {})
    } };
  });
}

export function validateValorantWeaponCatalogResponse(
  value: unknown
): ValorantValidationResult<ValorantCatalogResponse<ValorantWeapon>> {
  return catalogEnvelope(value, (item, index) => {
    const base = entityBase(item, ["id", "name", "category", "creditCost", "imageUrl"], `weapon_${index}`);
    if (!base.ok) return base as ValorantValidationResult<ValorantWeapon>;
    const category = entityBase(base.data.category, ["id", "name"], `weapon_${index}_category`);
    if (!category.ok || (base.data.creditCost !== null && !nonNegativeInteger(base.data.creditCost, 100_000))) {
      return { ok: false, error: `weapon_${index}_invalid` };
    }
    if (base.data.imageUrl !== undefined && !localImageUrl(base.data.imageUrl)) return { ok: false, error: `weapon_${index}_image_invalid` };
    return { ok: true, data: {
      id: base.data.id,
      name: base.data.name,
      category: { id: category.data.id, name: category.data.name },
      creditCost: base.data.creditCost as number | null,
      ...(typeof base.data.imageUrl === "string" ? { imageUrl: base.data.imageUrl } : {})
    } };
  });
}

export function validateValorantMapCatalogResponse(
  value: unknown
): ValorantValidationResult<ValorantCatalogResponse<ValorantMap>> {
  return catalogEnvelope(value, (item, index) => {
    const base = entityBase(item, ["id", "name", "sites", "note", "imageUrl"], `map_${index}`);
    if (!base.ok) return base as ValorantValidationResult<ValorantMap>;
    if (!Array.isArray(base.data.sites) || base.data.sites.length > 8 || base.data.sites.some((site) => typeof site !== "string" || !/^[A-Z]$/u.test(site))) {
      return { ok: false, error: `map_${index}_sites_invalid` };
    }
    const note = base.data.note === undefined ? undefined : localized(base.data.note, `map_${index}_note`);
    if (note && !note.ok) return note as ValorantValidationResult<ValorantMap>;
    if (base.data.imageUrl !== undefined && !localImageUrl(base.data.imageUrl)) return { ok: false, error: `map_${index}_image_invalid` };
    return { ok: true, data: {
      id: base.data.id,
      name: base.data.name,
      sites: base.data.sites as string[],
      ...(note?.ok ? { note: note.data } : {}),
      ...(typeof base.data.imageUrl === "string" ? { imageUrl: base.data.imageUrl } : {})
    } };
  });
}

function statusOnly<T extends "approval_pending" | "data_unavailable">(
  value: unknown,
  state: T
): ValorantValidationResult<Readonly<{ state: T }>> | undefined {
  const root = exactRecord(value, ["state"], "response");
  if (!root.ok || root.data.state !== state) return undefined;
  return { ok: true, data: { state } };
}

function act(value: unknown, path: string): ValorantValidationResult<ValorantAct> {
  const base = entityBase(value, ["id", "name"], path);
  if (!base.ok || !RIOT_UUID_PATTERN.test(base.ok ? base.data.id : "")) {
    return { ok: false, error: `${path}_invalid` };
  }
  return { ok: true, data: { id: base.data.id, name: base.data.name } };
}

export function validateValorantLeaderboardResponse(
  value: unknown
): ValorantValidationResult<ValorantLeaderboardResponse> {
  const pending = statusOnly(value, "approval_pending");
  if (pending) return pending;
  const unavailable = statusOnly(value, "data_unavailable");
  if (unavailable) return unavailable;
  const root = exactRecord(value, ["state", "act", "acts", "region", "entries", "updatedAt"], "response");
  if (
    !root.ok || root.data.state !== "ready"
    || !["kr", "ap", "na"].includes(String(root.data.region))
    || !Array.isArray(root.data.acts) || root.data.acts.length > 20
    || !Array.isArray(root.data.entries) || root.data.entries.length > 500
    || !canonicalIso(root.data.updatedAt)
  ) return { ok: false, error: "leaderboard_invalid" };
  const currentAct = act(root.data.act, "act");
  if (!currentAct.ok) return currentAct;
  const acts: ValorantAct[] = [];
  for (let index = 0; index < root.data.acts.length; index += 1) {
    const parsed = act(root.data.acts[index], `acts_${index}`);
    if (!parsed.ok) return parsed;
    acts.push(parsed.data);
  }
  if (!acts.some((candidate) => candidate.id === currentAct.data.id)) {
    return { ok: false, error: "leaderboard_current_act_missing" };
  }
  const entries: Extract<ValorantLeaderboardResponse, { state: "ready" }>["entries"][number][] = [];
  let previousRank = 0;
  for (let index = 0; index < root.data.entries.length; index += 1) {
    const item = exactRecord(
      root.data.entries[index],
      ["rank", "anonymous", "riotId", "rankedRating", "wins"],
      `entry_${index}`
    );
    if (
      !item.ok
      || !nonNegativeInteger(item.data.rank, 1_000_000) || item.data.rank < 1
      || item.data.rank < previousRank
      || typeof item.data.anonymous !== "boolean"
      || !nonNegativeInteger(item.data.rankedRating, 1_000_000)
      || !nonNegativeInteger(item.data.wins, 1_000_000)
      || (item.data.anonymous && item.data.riotId !== undefined)
      || (!item.data.anonymous && !boundedString(item.data.riotId, 100))
    ) return { ok: false, error: `entry_${index}_invalid` };
    previousRank = item.data.rank;
    entries.push({
      rank: item.data.rank,
      anonymous: item.data.anonymous,
      ...(!item.data.anonymous && typeof item.data.riotId === "string" ? { riotId: item.data.riotId } : {}),
      rankedRating: item.data.rankedRating,
      wins: item.data.wins
    });
  }
  return { ok: true, data: {
    state: "ready",
    act: currentAct.data,
    acts,
    region: root.data.region as ValorantLeaderboardRegion,
    entries,
    updatedAt: root.data.updatedAt
  } };
}

export function validateValorantStreamerListResponse(
  value: unknown
): ValorantValidationResult<ValorantStreamerListResponse> {
  const pending = statusOnly(value, "approval_pending");
  if (pending) return pending;
  const unavailable = statusOnly(value, "data_unavailable");
  if (unavailable) return unavailable;
  const root = exactRecord(value, ["state", "streamers"], "response");
  if (!root.ok || root.data.state !== "ready" || !Array.isArray(root.data.streamers) || root.data.streamers.length > 1_000) {
    return { ok: false, error: "streamer_list_invalid" };
  }
  const streamers: ValorantStreamerSummary[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < root.data.streamers.length; index += 1) {
    const item = exactRecord(root.data.streamers[index], ["id", "displayName", "riotTag"], `streamer_${index}`);
    if (
      !item.ok || typeof item.data.id !== "string" || !/^[a-f0-9]{32}$/u.test(item.data.id)
      || ids.has(item.data.id) || !boundedString(item.data.displayName, 80)
      || (item.data.riotTag !== undefined && !boundedString(item.data.riotTag, 100))
    ) return { ok: false, error: `streamer_${index}_invalid` };
    ids.add(item.data.id);
    streamers.push({
      id: item.data.id,
      displayName: item.data.displayName,
      ...(typeof item.data.riotTag === "string" ? { riotTag: item.data.riotTag } : {})
    });
  }
  return { ok: true, data: { state: "ready", streamers } };
}

export function validateValorantStreamerMatchesResponse(
  value: unknown
): ValorantValidationResult<ValorantStreamerMatchesResponse> {
  const pending = statusOnly(value, "approval_pending");
  if (pending) return pending;
  const unavailable = statusOnly(value, "data_unavailable");
  if (unavailable) return unavailable;
  const root = exactRecord(
    value,
    ["state", "profile", "offset", "limit", "total", "returned", "hasMore", "matches"],
    "response"
  );
  if (
    !root.ok || root.data.state !== "ready"
    || !Array.isArray(root.data.matches) || root.data.matches.length > 20
    || !nonNegativeInteger(root.data.offset, 10_000)
    || !nonNegativeInteger(root.data.limit, 20) || root.data.limit < 1
    || !nonNegativeInteger(root.data.total, 10_000)
    || root.data.returned !== root.data.matches.length
    || typeof root.data.hasMore !== "boolean"
    || root.data.hasMore !== (root.data.offset + root.data.matches.length < root.data.total)
  ) return { ok: false, error: "matches_pagination_invalid" };
  const profile = exactRecord(root.data.profile, ["displayName", "riotTag", "consentBadge"], "profile");
  if (
    !profile.ok || !boundedString(profile.data.displayName, 80)
    || !boundedString(profile.data.riotTag, 100) || profile.data.consentBadge !== true
  ) return { ok: false, error: "profile_invalid" };
  const matches: Extract<ValorantStreamerMatchesResponse, { state: "ready" }>["matches"][number][] = [];
  for (let index = 0; index < root.data.matches.length; index += 1) {
    const item = exactRecord(root.data.matches[index], [
      "matchId", "queue", "map", "agent", "win", "roundsWon", "roundsLost",
      "kills", "deaths", "assists", "headshotPercent", "startedAt", "durationSeconds", "detail"
    ], `match_${index}`);
    const queue = item.ok ? entityBase(item.data.queue, ["id", "name"], `match_${index}_queue`) : undefined;
    const map = item.ok ? entityBase(item.data.map, ["id", "name"], `match_${index}_map`) : undefined;
    const agent = item.ok ? entityBase(item.data.agent, ["id", "name"], `match_${index}_agent`) : undefined;
    if (
      !item?.ok || !queue?.ok || !map?.ok || !agent?.ok
      || !boundedString(item.data.matchId, 128) || !/^[A-Za-z0-9_-]+$/u.test(item.data.matchId)
      || typeof item.data.win !== "boolean"
      || !nonNegativeInteger(item.data.roundsWon, 100)
      || !nonNegativeInteger(item.data.roundsLost, 100)
      || !nonNegativeInteger(item.data.kills, 1_000)
      || !nonNegativeInteger(item.data.deaths, 1_000)
      || !nonNegativeInteger(item.data.assists, 1_000)
      || (item.data.headshotPercent !== null && (
        typeof item.data.headshotPercent !== "number"
        || !Number.isFinite(item.data.headshotPercent)
        || item.data.headshotPercent < 0 || item.data.headshotPercent > 100
      ))
      || !canonicalIso(item.data.startedAt)
      || !nonNegativeInteger(item.data.durationSeconds, 86_400)
      || item.data.detail !== undefined
    ) return { ok: false, error: `match_${index}_invalid` };
    matches.push({
      matchId: item.data.matchId,
      queue: { id: queue.data.id, name: queue.data.name },
      map: { id: map.data.id, name: map.data.name },
      agent: { id: agent.data.id, name: agent.data.name },
      win: item.data.win,
      roundsWon: item.data.roundsWon,
      roundsLost: item.data.roundsLost,
      kills: item.data.kills,
      deaths: item.data.deaths,
      assists: item.data.assists,
      headshotPercent: item.data.headshotPercent as number | null,
      startedAt: item.data.startedAt,
      durationSeconds: item.data.durationSeconds
    });
  }
  return { ok: true, data: {
    state: "ready",
    profile: {
      displayName: profile.data.displayName,
      riotTag: profile.data.riotTag,
      consentBadge: true
    },
    offset: root.data.offset,
    limit: root.data.limit,
    total: root.data.total,
    returned: root.data.returned as number,
    hasMore: root.data.hasMore,
    matches
  } };
}
