import type { LolChampionSkinOption, LolChampionSummary } from "@streamops/shared";

type DataDragonChampion = {
  id: string;
  key: string;
  name: string;
  image?: {
    full?: string;
  };
  spells?: DataDragonChampionSpell[];
  skins?: DataDragonSkin[];
};

type DataDragonChampionSpell = {
  id: string;
  name: string;
  image?: {
    full?: string;
  };
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

type DataDragonRune = {
  id: number;
  key?: string;
  icon?: string;
  name?: string;
};

type DataDragonRuneSlot = {
  runes?: DataDragonRune[];
};

type DataDragonRuneStyle = {
  id: number;
  key?: string;
  icon?: string;
  name?: string;
  slots?: DataDragonRuneSlot[];
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

export type LolRuneSummary = {
  runeId: number;
  nameKo?: string;
  nameJa?: string;
  iconUrl?: string;
};

export type LolChampionAbilitySummary = {
  slot: number;
  key: "Q" | "W" | "E" | "R";
  nameKo?: string;
  nameJa?: string;
  iconUrl?: string;
};

const DATA_DRAGON_BASE = "https://ddragon.leagueoflegends.com";
const NEUTRAL_IMAGE_LOCALE = "neutral" as const;
const FALLBACK_RUNE_SUMMARIES: LolRuneSummary[] = [
  {
    runeId: 8136,
    nameKo: "좀비 와드",
    nameJa: "ゾンビワード",
    iconUrl: `${DATA_DRAGON_BASE}/cdn/img/perk-images/Styles/Domination/ZombieWard/ZombieWard.png`
  },
  {
    runeId: 8138,
    nameKo: "사냥의 증표",
    nameJa: "目玉コレクター",
    iconUrl: `${DATA_DRAGON_BASE}/cdn/img/perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png`
  },
  {
    runeId: 8120,
    nameKo: "유령 포로",
    nameJa: "ゴーストポロ",
    iconUrl: `${DATA_DRAGON_BASE}/cdn/img/perk-images/Styles/Domination/GhostPoro/GhostPoro.png`
  }
];

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

function firstDataDragonVersion(versions: string[]): string {
  const version = versions[0];
  if (!version) throw new Error("Data Dragon version list is empty");
  return version;
}

export class DataDragonService {
  private versionsCache?: { versions: string[]; fetchedAt: number };
  private versionRequest?: Promise<string[]>;
  private championCache = new Map<string, Map<number, ChampionMapEntry>>();
  private championMapRequests = new Map<string, Promise<Map<number, ChampionMapEntry>>>();
  private championDetailCache = new Map<string, DataDragonChampion | undefined>();
  private championDetailRequests = new Map<string, Promise<DataDragonChampion | undefined>>();
  private runeCache = new Map<string, Map<number, LolRuneSummary>>();
  private runeMapRequests = new Map<string, Promise<Map<number, LolRuneSummary>>>();

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async getVersions(): Promise<string[]> {
    if (this.versionsCache && Date.now() - this.versionsCache.fetchedAt < 6 * 60 * 60 * 1000) return this.versionsCache.versions;
    if (this.versionRequest) return this.versionRequest;
    this.versionRequest = (async () => {
      const response = await this.fetchImpl(`${DATA_DRAGON_BASE}/api/versions.json`);
      if (!response.ok) throw new Error(`Data Dragon versions lookup failed: ${response.status}`);
      const versions = (await response.json()) as string[];
      if (!versions[0]) throw new Error("Data Dragon version list is empty");
      this.versionsCache = { versions, fetchedAt: Date.now() };
      return versions;
    })().finally(() => {
      this.versionRequest = undefined;
    });
    return this.versionRequest;
  }

  async getLatestVersion(): Promise<string> {
    return firstDataDragonVersion(await this.getVersions());
  }

  async getVersionForGameVersion(gameVersion?: string): Promise<string> {
    const versions = await this.getVersions();
    const latestVersion = firstDataDragonVersion(versions);
    const match = gameVersion?.match(/^(\d+)\.(\d+)/);
    if (!match) return latestVersion;
    const prefix = `${match[1]}.${match[2]}.`;
    return versions.find((version) => version.startsWith(prefix)) ?? latestVersion;
  }

  async getChampionMap(version?: string): Promise<Map<number, ChampionMapEntry>> {
    const resolvedVersion = version ?? await this.getLatestVersion();
    const cached = this.championCache.get(resolvedVersion);
    if (cached) return cached;
    const running = this.championMapRequests.get(resolvedVersion);
    if (running) return running;

    const request = (async () => {
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
    })().finally(() => {
      this.championMapRequests.delete(resolvedVersion);
    });
    this.championMapRequests.set(resolvedVersion, request);
    return request;
  }

  async getRuneMap(version?: string): Promise<Map<number, LolRuneSummary>> {
    const resolvedVersion = version ?? await this.getLatestVersion();
    const cached = this.runeCache.get(resolvedVersion);
    if (cached) return cached;
    const running = this.runeMapRequests.get(resolvedVersion);
    if (running) return running;

    const request = (async () => {
      const [ko, ja] = await Promise.all([
        this.fetchRuneData(resolvedVersion, "ko_KR"),
        this.fetchRuneData(resolvedVersion, "ja_JP").catch(() => undefined)
      ]);
      const jaById = new Map<number, DataDragonRuneStyle | DataDragonRune>();
      for (const style of ja ?? []) {
        jaById.set(style.id, style);
        for (const slot of style.slots ?? []) {
          for (const rune of slot.runes ?? []) jaById.set(rune.id, rune);
        }
      }

      const map = new Map<number, LolRuneSummary>();
      const addEntry = (entry: DataDragonRuneStyle | DataDragonRune): void => {
        if (!Number.isFinite(entry.id)) return;
        const jaEntry = jaById.get(entry.id);
        map.set(entry.id, {
          runeId: entry.id,
          nameKo: entry.name,
          nameJa: jaEntry?.name,
          iconUrl: entry.icon ? `${DATA_DRAGON_BASE}/cdn/img/${entry.icon}` : undefined
        });
      };

      for (const style of ko) {
        addEntry(style);
        for (const slot of style.slots ?? []) {
          for (const rune of slot.runes ?? []) addEntry(rune);
        }
      }

      for (const fallback of FALLBACK_RUNE_SUMMARIES) {
        if (!map.has(fallback.runeId)) map.set(fallback.runeId, fallback);
      }

      this.runeCache.set(resolvedVersion, map);
      return map;
    })().finally(() => {
      this.runeMapRequests.delete(resolvedVersion);
    });
    this.runeMapRequests.set(resolvedVersion, request);
    return request;
  }

  async mapRuneSummaries(runeIds: number[], version?: string): Promise<LolRuneSummary[]> {
    const map = await this.getRuneMap(version);
    return runeIds.map((runeId) => map.get(runeId) ?? { runeId });
  }

  async getChampionAbilities(championId: number, version?: string): Promise<LolChampionAbilitySummary[]> {
    const resolvedVersion = version ?? await this.getLatestVersion();
    const map = await this.getChampionMap(resolvedVersion);
    const champion = map.get(championId);
    if (!champion) return [];
    const [ko, ja] = await Promise.all([
      this.fetchChampionDetail(resolvedVersion, "ko_KR", champion.championKey),
      this.fetchChampionDetail(resolvedVersion, "ja_JP", champion.championKey).catch(() => undefined)
    ]);
    const jaBySpellId = new Map((ja?.spells ?? []).map((spell) => [spell.id, spell]));
    const keys = ["Q", "W", "E", "R"] as const;
    return (ko?.spells ?? []).slice(0, 4).map((spell, index) => ({
      slot: index + 1,
      key: keys[index] ?? "Q",
      nameKo: spell.name,
      nameJa: jaBySpellId.get(spell.id)?.name,
      iconUrl: spell.image?.full ? `${DATA_DRAGON_BASE}/cdn/${resolvedVersion}/img/spell/${spell.image.full}` : undefined
    }));
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

  private async fetchRuneData(version: string, language: "ko_KR" | "ja_JP"): Promise<DataDragonRuneStyle[]> {
    const response = await this.fetchImpl(`${DATA_DRAGON_BASE}/cdn/${version}/data/${language}/runesReforged.json`);
    if (!response.ok) throw new Error(`Data Dragon rune lookup failed: ${response.status}`);
    return (await response.json()) as DataDragonRuneStyle[];
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
    const running = this.championDetailRequests.get(cacheKey);
    if (running) return running;
    const request = (async () => {
      const response = await this.fetchImpl(`${DATA_DRAGON_BASE}/cdn/${version}/data/${language}/champion/${championKey}.json`);
      if (!response.ok) throw new Error(`Data Dragon champion detail lookup failed: ${response.status}`);
      const parsed = (await response.json()) as ChampionDataResponse;
      const champion = parsed.data?.[championKey] ?? Object.values(parsed.data ?? {}).find((entry) => entry.id === championKey);
      this.championDetailCache.set(cacheKey, champion);
      return champion;
    })().finally(() => {
      this.championDetailRequests.delete(cacheKey);
    });
    this.championDetailRequests.set(cacheKey, request);
    return request;
  }
}
