import type { LolRoutingContext } from "@streamops/shared";
import { compareRiotMatchIdsDescending, RiotRequestAbortedError, type RiotApiClient } from "../services/riot-api.js";

type RawIds = { ids: string[]; complete: boolean; expiresAt: number };

// 라우트 인스턴스에 한정한 완료 결과 캐시입니다. 요청의 signal이나 진행 중 Promise는 공유하지 않습니다.
export class PublicLolMatchIdsCache {
  private readonly entries = new Map<string, RawIds>();

  constructor(private readonly maxEntries = 500, private readonly now = Date.now) {}

  invalidate(puuid: string): void {
    for (const key of this.entries.keys()) {
      if (JSON.parse(key)[1] === puuid) this.entries.delete(key);
    }
  }

  async get(riot: RiotApiClient, puuid: string, count: number, queues: number[], start: number,
    routing?: LolRoutingContext, signal?: AbortSignal): Promise<string[]> {
    if (queues.length < 2) return riot.getRecentMatchIdsByPuuid(puuid, count, queues, start, routing, signal);
    const target = Math.min(300, start + count);
    const merged = new Set<string>();
    for (const queue of new Set(queues)) {
      if (signal?.aborted) throw new RiotRequestAbortedError("match.ids");
      const key = JSON.stringify([routing?.accountRegion ?? riot.routingStatus().accountRegion, puuid, queue]);
      let entry = this.entries.get(key);
      if (!entry || entry.expiresAt <= this.now()) {
        entry = { ids: [], complete: false, expiresAt: this.now() + 45_000 };
        this.entries.delete(key);
        this.entries.set(key, entry);
        while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
      }
      // 요청별 복사본으로 확장해 취소·실패한 결과가 캐시에 섞이지 않게 합니다.
      const ids = [...entry.ids];
      let complete = entry.complete;
      while (ids.length < target && !complete) {
        const pageCount = Math.min(100, 300 - ids.length);
        const page = await riot.getRecentMatchIdsByPuuid(puuid, pageCount, [queue], ids.length, routing, signal);
        if (signal?.aborted) throw new RiotRequestAbortedError("match.ids");
        ids.push(...page);
        complete = page.length < pageCount;
      }
      // 무효화·만료·퇴출된 항목을 되살리지 않고, 늦게 끝난 짧은 응답으로 긴 목록을 덮지 않습니다.
      if (this.entries.get(key) === entry && ids.length >= entry.ids.length) {
        entry.ids = ids;
        entry.complete = complete;
      }
      for (const id of ids.slice(0, target)) merged.add(id);
    }
    return [...merged].sort(compareRiotMatchIdsDescending).slice(start, start + count);
  }
}
