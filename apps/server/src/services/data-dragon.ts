import type { LolChampionSkinOption, LolChampionSummary } from "@streamops/shared";

type DataDragonChampion = {
  id: string;
  key: string;
  name: string;
  image?: {
    full?: string;
  };
  skins?: DataDragonSkin[];
};

type DataDragonSkin = {
  num: number;
  name: string;
  chromas?: boolean;
  parentSkin?: number;
};

type ChampionDataResponse = {
  data: Record<string, DataDragonChampion>;
};

type ChampionMapEntry = {
  championId: number;
  championKey: string;
  nameKo: string;
  nameJa?: string;
  iconUrl?: string;
  splashUrl?: string;
  loadingUrl?: string;
  imageVersion: string;
  imageLocale: "neutral";
};

type ChampionSkinEntry = {
  skinNum: number;
  skinNameKo: string;
  skinNameJa?: string;
};

const DATA_DRAGON_BASE = "https://ddragon.leagueoflegends.com";
const NEUTRAL_IMAGE_LOCALE = "neutral" as const;

function championImageUrls(version: string, championKey: string, imageFullName?: string, skinNum = 0): Pick<ChampionMapEntry, "iconUrl" | "splashUrl" | "loadingUrl" | "imageVersion" | "imageLocale"> {
  const safeImageName = imageFullName && imageFullName.endsWith(".png") ? imageFullName : `${championKey}.png`;
  const safeSkinNum = Number.isInteger(skinNum) && skinNum >= 0 ? skinNum : 0;
  return {
    iconUrl: `${DATA_DRAGON_BASE}/cdn/${version}/img/champion/${safeImageName}`,
    splashUrl: `${DATA_DRAGON_BASE}/cdn/img/champion/splash/${championKey}_${safeSkinNum}.jpg`,
    loadingUrl: `${DATA_DRAGON_BASE}/cdn/img/champion/loading/${championKey}_${safeSkinNum}.jpg`,
    imageVersion: version,
    imageLocale: NEUTRAL_IMAGE_LOCALE
  };
}

function normalizeSkinNum(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return undefined;
  const skinNum = Math.trunc(number);
  return skinNum >= 0 && skinNum <= 1000 ? skinNum : undefined;
}

function skinOverrideFor(championId: number, championKey: string, overrides: Record<string, number> | undefined): number | undefined {
  if (!overrides) return undefined;
  const candidates = [String(championId), championKey, championKey.toLowerCase()];
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) return normalizeSkinNum(overrides[key]);
  }
  return undefined;
}

function visibleSkin(skin: DataDragonSkin): boolean {
  return Number.isInteger(skin.num) && skin.num >= 0 && skin.parentSkin === undefined;
}

export class DataDragonService {
  private versionsCache?: { version: string; fetchedAt: number };
  private championCache = new Map<string, Map<number, ChampionMapEntry>>();
  private championDetailCache = new Map<string, DataDragonChampion | undefined>();

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async getLatestVersion(): Promise<string> {
    if (this.versionsCache && Date.now() - this.versionsCache.fetchedAt < 6 * 60 * 60 * 1000) return this.versionsCache.version;
    const response = await this.fetchImpl(`${DATA_DRAGON_BASE}/api/versions.json`);
    if (!response.ok) throw new Error(`Data Dragon versions lookup failed: ${response.status}`);
    const versions = (await response.json()) as string[];
    const version = versions[0];
    if (!version) throw new Error("Data Dragon version list is empty");
    this.versionsCache = { version, fetchedAt: Date.now() };
    return version;
  }

  async getChampionMap(version?: string): Promise<Map<number, ChampionMapEntry>> {
    const resolvedVersion = version ?? await this.getLatestVersion();
    const cached = this.championCache.get(resolvedVersion);
    if (cached) return cached;

    const [ko, ja] = await Promise.all([
      this.fetchChampionData(resolvedVersion, "ko_KR"),
      this.fetchChampionData(resolvedVersion, "ja_JP").catch(() => undefined)
    ]);
    const jaByKey = new Map(Object.values(ja?.data ?? {}).map((champion) => [champion.key, champion]));
    const map = new Map<number, ChampionMapEntry>();

    for (const champion of Object.values(ko.data)) {
      const championId = Number(champion.key);
      if (!Number.isFinite(championId)) continue;
      map.set(championId, {
        championId,
        championKey: champion.id,
        nameKo: champion.name,
        nameJa: jaByKey.get(champion.key)?.name,
        ...championImageUrls(resolvedVersion, champion.id, champion.image?.full)
      });
    }

    this.championCache.set(resolvedVersion, map);
    return map;
  }

  async mapChampionSummary(input: {
    championId: number;
    championName?: string;
    masteryLevel?: number;
    masteryPoints?: number;
    games?: number;
    skinNum?: number;
    skinOverrides?: Record<string, number>;
  }): Promise<LolChampionSummary> {
    try {
      const version = await this.getLatestVersion();
      const map = await this.getChampionMap(version);
      const champion = map.get(input.championId);
      if (champion) {
        const requestedSkinNum = normalizeSkinNum(input.skinNum) ?? skinOverrideFor(input.championId, champion.championKey, input.skinOverrides);
        const selectedSkin = requestedSkinNum !== undefined && requestedSkinNum !== 0
          ? await this.getSkinEntry(version, champion.championKey, requestedSkinNum).catch(() => undefined)
          : undefined;
        const skinNum = requestedSkinNum === 0 ? 0 : selectedSkin?.skinNum ?? 0;
        return {
          ...champion,
          ...championImageUrls(version, champion.championKey, undefined, skinNum),
          skinNum: requestedSkinNum !== undefined ? skinNum : selectedSkin?.skinNum,
          skinNameKo: selectedSkin?.skinNameKo,
          skinNameJa: selectedSkin?.skinNameJa,
          masteryLevel: input.masteryLevel,
          masteryPoints: input.masteryPoints,
          games: input.games
        };
      }
    } catch {
      // Data Dragon 실패 시에도 시참 분석은 중단하지 않습니다.
    }

    return {
      championId: input.championId,
      championKey: input.championName,
      nameKo: `Champion ${input.championId}`,
      masteryLevel: input.masteryLevel,
      masteryPoints: input.masteryPoints,
      games: input.games
    };
  }

  async getChampionSkinOptions(championId: number): Promise<{ champion: LolChampionSummary; skins: LolChampionSkinOption[] }> {
    const version = await this.getLatestVersion();
    const map = await this.getChampionMap(version);
    const champion = map.get(championId);
    if (!champion) throw new Error(`Data Dragon champion not found: ${championId}`);

    const [ko, ja] = await Promise.all([
      this.fetchChampionDetail(version, "ko_KR", champion.championKey),
      this.fetchChampionDetail(version, "ja_JP", champion.championKey).catch(() => undefined)
    ]);
    const jaSkinsByNum = new Map((ja?.skins ?? []).filter(visibleSkin).map((skin) => [skin.num, skin]));
    const skins = (ko?.skins ?? [])
      .filter(visibleSkin)
      .sort((a, b) => a.num - b.num)
      .map((skin) => {
        const jaSkin = jaSkinsByNum.get(skin.num);
        const urls = championImageUrls(version, champion.championKey, undefined, skin.num);
        return {
          skinNum: skin.num,
          nameKo: skin.num === 0 ? champion.nameKo : skin.name,
          nameJa: skin.num === 0 ? champion.nameJa : jaSkin?.name,
          splashUrl: urls.splashUrl ?? `${DATA_DRAGON_BASE}/cdn/img/champion/splash/${champion.championKey}_${skin.num}.jpg`,
          loadingUrl: urls.loadingUrl ?? `${DATA_DRAGON_BASE}/cdn/img/champion/loading/${champion.championKey}_${skin.num}.jpg`
        };
      });

    return {
      champion: {
        ...champion
      },
      skins
    };
  }

  private async fetchChampionData(version: string, language: "ko_KR" | "ja_JP"): Promise<ChampionDataResponse> {
    const response = await this.fetchImpl(`${DATA_DRAGON_BASE}/cdn/${version}/data/${language}/champion.json`);
    if (!response.ok) throw new Error(`Data Dragon champion lookup failed: ${response.status}`);
    return (await response.json()) as ChampionDataResponse;
  }

  private async getSkinEntry(version: string, championKey: string, skinNum: number): Promise<ChampionSkinEntry | undefined> {
    if (skinNum === 0) return undefined;
    const [ko, ja] = await Promise.all([
      this.fetchChampionDetail(version, "ko_KR", championKey),
      this.fetchChampionDetail(version, "ja_JP", championKey).catch(() => undefined)
    ]);
    const koSkin = ko?.skins?.find((skin) => skin.num === skinNum && visibleSkin(skin));
    if (!koSkin) return undefined;
    const jaSkin = ja?.skins?.find((skin) => skin.num === skinNum && visibleSkin(skin));
    return {
      skinNum,
      skinNameKo: koSkin.name,
      skinNameJa: jaSkin?.name
    };
  }

  private async fetchChampionDetail(version: string, language: "ko_KR" | "ja_JP", championKey: string): Promise<DataDragonChampion | undefined> {
    const cacheKey = `${version}:${language}:${championKey}`;
    if (this.championDetailCache.has(cacheKey)) return this.championDetailCache.get(cacheKey);
    const response = await this.fetchImpl(`${DATA_DRAGON_BASE}/cdn/${version}/data/${language}/champion/${championKey}.json`);
    if (!response.ok) throw new Error(`Data Dragon champion detail lookup failed: ${response.status}`);
    const parsed = (await response.json()) as ChampionDataResponse;
    const champion = parsed.data?.[championKey] ?? Object.values(parsed.data ?? {}).find((entry) => entry.id === championKey);
    this.championDetailCache.set(cacheKey, champion);
    return champion;
  }
}
