import fs from "node:fs";
import path from "node:path";
import type { LolChampionSummary, LolMainRole, LolPerformanceStats, LolProfileStatus, LolRankedStats, LolRecentMatchChampion, LolRankHistoryByQueue, LolRankHistoryPoint } from "@streamops/shared";
import { normalizeRiotIdKey } from "@streamops/shared";

export type LolProfileCacheEntry = {
  riotPuuid: string;
  riotGameName: string;
  riotTagLine: string;
  riotIdKey: string;
  /** 랭크·전적 근거를 다른 shard와 섞지 않기 위한 LoL platform입니다. 이전 cache에는 없을 수 있습니다. */
  lolPlatform?: string;
  status: LolProfileStatus;
  mainRole?: LolMainRole;
  mainRoleConfidence?: number;
  ladderRank?: number;
  topChampions?: LolChampionSummary[];
  rankedStats?: LolRankedStats;
  performanceStats?: LolPerformanceStats;
  recentMatches?: LolRecentMatchChampion[];
  rankHistory?: LolRankHistoryByQueue;
  championSkinOverridesKey?: string;
  analyzedAt?: string;
  failedReason?: string;
  /** 표시 문구와 분리된 machine-readable 실패 원인입니다. */
  failureCode?: "account_not_found" | "riot_not_configured" | "rate_limited" | "riot_auth" | "riot_error";
  nextRetryAt?: string;
};

export interface LolProfileRepository {
  getByPuuid(puuid: string): LolProfileCacheEntry | undefined;
  getByRiotId(gameName: string, tagLine: string): LolProfileCacheEntry | undefined;
  searchByText(query: string, limit?: number): LolProfileCacheEntry[];
  save(entry: LolProfileCacheEntry): LolProfileCacheEntry;
}

type PersistedLolProfileCacheEntry = Omit<LolProfileCacheEntry, "rankHistory"> & {
  rankHistory?: LolRankHistoryByQueue | LolRankHistoryPoint[];
};

type PersistedProfiles = {
  profiles: PersistedLolProfileCacheEntry[];
};

function cloneRankHistory(history: LolRankHistoryByQueue | undefined): LolRankHistoryByQueue | undefined {
  return history ? {
    solo: history.solo?.map((point) => ({ ...point })),
    flex: history.flex?.map((point) => ({ ...point })),
    ranked5v5: history.ranked5v5?.map((point) => ({ ...point }))
  } : undefined;
}

function normalizePersistedRankHistory(
  history: LolRankHistoryByQueue | LolRankHistoryPoint[] | undefined
): LolRankHistoryByQueue | undefined {
  if (Array.isArray(history)) {
    return { solo: history.map((point) => ({ ...point })) };
  }
  return cloneRankHistory(history);
}

function clone(entry: LolProfileCacheEntry): LolProfileCacheEntry {
  return {
    ...entry,
    topChampions: entry.topChampions?.map((champion) => ({ ...champion })),
    rankedStats: entry.rankedStats ? { ...entry.rankedStats } : undefined,
    performanceStats: entry.performanceStats ? { ...entry.performanceStats } : undefined,
    recentMatches: entry.recentMatches?.map((match) => ({ ...match })),
    rankHistory: cloneRankHistory(entry.rankHistory)
  };
}

export class LocalJsonLolProfileRepository implements LolProfileRepository {
  private profiles = new Map<string, LolProfileCacheEntry>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  getByPuuid(puuid: string): LolProfileCacheEntry | undefined {
    const entry = this.profiles.get(puuid);
    return entry ? clone(entry) : undefined;
  }

  getByRiotId(gameName: string, tagLine: string): LolProfileCacheEntry | undefined {
    const key = normalizeRiotIdKey(gameName, tagLine);
    const entry = [...this.profiles.values()].find((profile) => profile.riotIdKey === key);
    return entry ? clone(entry) : undefined;
  }

  searchByText(query: string, limit = 8): LolProfileCacheEntry[] {
    const searchText = query.trim().normalize("NFKC").replace(/＃/g, "#").toLocaleLowerCase();
    if (!searchText) return [];
    const safeLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
    return [...this.profiles.values()]
      .filter((profile) => {
        const riotId = `${profile.riotGameName}#${profile.riotTagLine}`.normalize("NFKC").toLocaleLowerCase();
        const gameName = profile.riotGameName.normalize("NFKC").toLocaleLowerCase();
        const tagLine = profile.riotTagLine.normalize("NFKC").toLocaleLowerCase();
        const tagOnly = searchText.startsWith("#") ? searchText.slice(1) : "";
        if (tagOnly) return tagLine.includes(tagOnly);
        return riotId.includes(searchText) || gameName.includes(searchText) || tagLine.includes(searchText);
      })
      .sort((a, b) => Date.parse(b.analyzedAt ?? "") - Date.parse(a.analyzedAt ?? ""))
      .slice(0, safeLimit)
      .map(clone);
  }

  save(entry: LolProfileCacheEntry): LolProfileCacheEntry {
    const normalized = {
      ...clone(entry),
      riotIdKey: normalizeRiotIdKey(entry.riotGameName, entry.riotTagLine)
    };
    for (const [puuid, profile] of this.profiles.entries()) {
      if (puuid !== normalized.riotPuuid && profile.riotIdKey === normalized.riotIdKey) {
        this.profiles.delete(puuid);
      }
    }
    this.profiles.set(normalized.riotPuuid, normalized);
    this.persist();
    return clone(normalized);
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) return;
    let parsed: PersistedProfiles;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as PersistedProfiles;
    } catch {
      const backupPath = `${this.filePath}.broken-${Date.now()}`;
      try {
        fs.copyFileSync(this.filePath, backupPath);
      } catch {
        // 손상된 cache 백업 실패는 서버 시작을 막지 않습니다.
      }
      this.profiles.clear();
      return;
    }
    for (const profile of parsed.profiles ?? []) {
      if (!profile.riotPuuid) continue;
      this.profiles.set(profile.riotPuuid, {
        ...profile,
        riotIdKey: profile.riotIdKey || normalizeRiotIdKey(profile.riotGameName, profile.riotTagLine),
        rankHistory: normalizePersistedRankHistory(profile.rankHistory)
      });
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload: PersistedProfiles = { profiles: [...this.profiles.values()].map(clone) };
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tempPath, this.filePath);
  }
}
