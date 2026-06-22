import type { LolChampionSummary } from "@streamops/shared";

type DataDragonChampion = {
  id: string;
  key: string;
  name: string;
  image?: {
    full?: string;
  };
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

const DATA_DRAGON_BASE = "https://ddragon.leagueoflegends.com";
const NEUTRAL_IMAGE_LOCALE = "neutral" as const;

function championImageUrls(version: string, championKey: string, imageFullName?: string): Pick<ChampionMapEntry, "iconUrl" | "splashUrl" | "loadingUrl" | "imageVersion" | "imageLocale"> {
  const safeImageName = imageFullName && imageFullName.endsWith(".png") ? imageFullName : `${championKey}.png`;
  return {
    iconUrl: `${DATA_DRAGON_BASE}/cdn/${version}/img/champion/${safeImageName}`,
    splashUrl: `${DATA_DRAGON_BASE}/cdn/img/champion/splash/${championKey}_0.jpg`,
    loadingUrl: `${DATA_DRAGON_BASE}/cdn/img/champion/loading/${championKey}_0.jpg`,
    imageVersion: version,
    imageLocale: NEUTRAL_IMAGE_LOCALE
  };
}

export class DataDragonService {
  private versionsCache?: { version: string; fetchedAt: number };
  private championCache = new Map<string, Map<number, ChampionMapEntry>>();

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
    masteryLevel?: number;
    masteryPoints?: number;
    games?: number;
  }): Promise<LolChampionSummary> {
    try {
      const map = await this.getChampionMap();
      const champion = map.get(input.championId);
      if (champion) {
        return {
          ...champion,
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
      nameKo: `Champion ${input.championId}`,
      masteryLevel: input.masteryLevel,
      masteryPoints: input.masteryPoints,
      games: input.games
    };
  }

  private async fetchChampionData(version: string, language: "ko_KR" | "ja_JP"): Promise<ChampionDataResponse> {
    const response = await this.fetchImpl(`${DATA_DRAGON_BASE}/cdn/${version}/data/${language}/champion.json`);
    if (!response.ok) throw new Error(`Data Dragon champion lookup failed: ${response.status}`);
    return (await response.json()) as ChampionDataResponse;
  }
}
