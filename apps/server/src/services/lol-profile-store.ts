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
  /** 분석 시각이 없는 항목도 보존 기한을 계산할 수 있도록 최초 저장 시각을 유지합니다. */
  createdAt?: string;
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
  private pendingWrite: NodeJS.Timeout | undefined;
  private dirty = false;
  private retryDelayMs = 3_000;
  private readonly ttlMs: number;

  constructor(
    private readonly filePath: string,
    private readonly onPersistenceError: (error: unknown) => void = (error) => {
      console.error("LoL 프로필 캐시 저장에 실패했습니다.", error);
    },
    ttlDays = 90
  ) {
    this.ttlMs = (Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 90) * 86_400_000;
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
    const createdAt = this.profiles.get(entry.riotPuuid)?.createdAt ?? entry.createdAt;
    const normalized = {
      ...clone(entry),
      createdAt: Number.isFinite(Date.parse(createdAt ?? "")) ? createdAt : new Date().toISOString(),
      riotIdKey: normalizeRiotIdKey(entry.riotGameName, entry.riotTagLine)
    };
    for (const [puuid, profile] of this.profiles.entries()) {
      if (puuid !== normalized.riotPuuid && profile.riotIdKey === normalized.riotIdKey) {
        this.profiles.delete(puuid);
      }
    }
    this.profiles.set(normalized.riotPuuid, normalized);
    this.dirty = true;
    this.schedulePersist();
    return clone(normalized);
  }

  /** 예약된 디스크 쓰기를 즉시 완료합니다. 실패하면 변경 상태를 유지하고 호출자에게 전달합니다. */
  flush(): void {
    if (this.pendingWrite) clearTimeout(this.pendingWrite);
    this.pendingWrite = undefined;
    this.pruneExpired();
    if (!this.dirty) return;
    try {
      this.persist();
      this.dirty = false;
      this.retryDelayMs = 3_000;
    } catch (error) {
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, 300_000);
      this.schedulePersist();
      throw error;
    }
  }

  private schedulePersist(): void {
    if (this.pendingWrite) return;
    // 첫 변경 이후 3초 단위로 배치하여 연속 요청에도 저장이 무한히 밀리지 않게 합니다.
    this.pendingWrite = setTimeout(() => {
      try {
        this.flush();
      } catch (error) {
        try {
          this.onPersistenceError(error);
        } catch {
          // 오류 보고 콜백의 예외가 타이머 밖으로 전파되지 않게 합니다.
        }
      }
    }, this.retryDelayMs);
    this.pendingWrite.unref();
  }

  private isExpired(profile: Pick<LolProfileCacheEntry, "analyzedAt" | "createdAt" | "status" | "nextRetryAt">, now: number): boolean {
    const analyzedAt = Date.parse(profile.analyzedAt ?? "");
    const createdAt = Date.parse(profile.createdAt ?? "");
    const timestamp = Number.isFinite(analyzedAt) ? analyzedAt : createdAt;
    const age = now - timestamp;
    const awaitingRetry = (profile.status === "failed" || profile.status === "rate_limited")
      && Date.parse(profile.nextRetryAt ?? "") > now;
    // 재시도 대기 중인 실패도 TTL의 2배가 지나면 정리하여 영구 보존을 막습니다.
    return age > this.ttlMs && (!awaitingRetry || age > this.ttlMs * 2);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [puuid, profile] of this.profiles) {
      if (!this.isExpired(profile, now)) continue;
      this.profiles.delete(puuid);
      this.dirty = true;
    }
  }

  private cleanupTempFiles(): void {
    const directory = path.dirname(this.filePath);
    const prefix = `${path.basename(this.filePath)}.`;
    try {
      for (const name of fs.readdirSync(directory)) {
        if (!name.startsWith(prefix) || !name.endsWith(".tmp")) continue;
        try {
          const tempPath = path.join(directory, name);
          if (!(Date.now() - fs.statSync(tempPath).mtimeMs >= 60_000)) continue;
          const match = /^(\d+)\.\d+\.tmp$/.exec(name.slice(prefix.length));
          const pid = match ? Number(match[1]) : NaN;
          if (Number.isSafeInteger(pid) && pid > 0 && pid <= 2_147_483_647) {
            // PID 확인은 단일 호스트 방어이며, PID 네임스페이스가 다른 컨테이너
            // 재기동에서는 위 mtime 검사가 주 방어선입니다.
            try {
              process.kill(pid, 0);
              continue;
            } catch (error) {
              // 권한 부족도 프로세스가 존재할 수 있으므로 보존합니다.
              if ((error as NodeJS.ErrnoException).code === "EPERM") continue;
            }
          }
          fs.unlinkSync(tempPath);
        } catch {
          // 잔존 임시 파일 삭제 실패는 다른 파일 정리나 서버 시작을 막지 않습니다.
        }
      }
    } catch {
      // 디렉터리가 없거나 읽을 수 없어도 서버 시작은 계속합니다.
    }
  }

  private load(): void {
    this.cleanupTempFiles();
    if (!fs.existsSync(this.filePath)) return;
    let parsed: PersistedProfiles;
    let legacyCreatedAt: string;
    try {
      legacyCreatedAt = new Date(Math.min(fs.statSync(this.filePath).mtimeMs, Date.now())).toISOString();
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
      if (!Number.isFinite(Date.parse(profile.createdAt ?? ""))) {
        profile.createdAt = legacyCreatedAt;
        this.dirty = true;
      }
      if (this.isExpired(profile, Date.now())) {
        this.dirty = true;
        continue;
      }
      this.profiles.set(profile.riotPuuid, {
        ...profile,
        riotIdKey: profile.riotIdKey || normalizeRiotIdKey(profile.riotGameName, profile.riotTagLine),
        rankHistory: normalizePersistedRankHistory(profile.rankHistory)
      });
    }
    if (this.dirty) this.schedulePersist();
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    let descriptor: number | undefined;
    let ownsTempFile = false;
    try {
      descriptor = fs.openSync(tempPath, "wx");
      ownsTempFile = true;
      fs.writeFileSync(descriptor, '{"profiles":[', "utf8");
      let separator = "";
      // 후속 작업: 전체 파일 읽기·재작성 비용은 운영 Postgres 이관으로 해결합니다.
      // 전체 복제/배열/문자열 없이 프로필 단위로 직렬화합니다.
      // 동기 쓰기이므로 순회 도중 save()나 종료 flush가 끼어들지 않습니다.
      for (const profile of this.profiles.values()) {
        fs.writeFileSync(descriptor, separator + JSON.stringify(profile), "utf8");
        separator = ",";
      }
      fs.writeFileSync(descriptor, "]}", "utf8");
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.renameSync(tempPath, this.filePath);
    } finally {
      try {
        if (descriptor !== undefined) fs.closeSync(descriptor);
      } finally {
        if (ownsTempFile && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    }
  }
}
