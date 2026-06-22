import fs from "node:fs";
import path from "node:path";
import type { LolChampionSummary, LolMainRole, LolProfileStatus, LolRankedStats } from "@streamops/shared";
import { normalizeRiotIdKey } from "@streamops/shared";

export type LolProfileCacheEntry = {
  riotPuuid: string;
  riotGameName: string;
  riotTagLine: string;
  riotIdKey: string;
  status: LolProfileStatus;
  mainRole?: LolMainRole;
  mainRoleConfidence?: number;
  topChampions?: LolChampionSummary[];
  rankedStats?: LolRankedStats;
  analyzedAt?: string;
  failedReason?: string;
  nextRetryAt?: string;
};

export interface LolProfileRepository {
  getByPuuid(puuid: string): LolProfileCacheEntry | undefined;
  getByRiotId(gameName: string, tagLine: string): LolProfileCacheEntry | undefined;
  save(entry: LolProfileCacheEntry): LolProfileCacheEntry;
}

type PersistedProfiles = {
  profiles: LolProfileCacheEntry[];
};

function clone(entry: LolProfileCacheEntry): LolProfileCacheEntry {
  return {
    ...entry,
    topChampions: entry.topChampions?.map((champion) => ({ ...champion })),
    rankedStats: entry.rankedStats ? { ...entry.rankedStats } : undefined
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
        riotIdKey: profile.riotIdKey || normalizeRiotIdKey(profile.riotGameName, profile.riotTagLine)
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
