/* 패치 노트 캐시.
 *
 * 원문은 2주에 한 번 바뀌므로 요청마다 Riot 을 부르지 않습니다. 6시간마다 한 번
 * 새로 받고, 실패하면 마지막 성공본을 `stale: true` 로 그대로 내보냅니다.
 * 마지막 성공본은 디스크에도 남겨 서버를 다시 띄워도 빈 화면이 나오지 않게 합니다.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  PATCH_NOTE_LOCALES,
  parsePatchNotesFeed,
  type PatchNotesFeed,
  type PatchNoteLocale
} from "@streamops/shared";
import { fetchPatchNotes, type PatchNotesFetchDeps } from "./patch-notes-source.js";

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
/* 원문이 죽어 있을 때 요청마다 다시 찌르지 않기 위한 최소 간격입니다. */
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;
const FEED_MAX_BYTES = 500_000;

export interface PatchNotesFeedStore {
  load(locale: PatchNoteLocale): Promise<PatchNotesFeed | undefined>;
  save(feed: PatchNotesFeed): Promise<void>;
}

export class LocalPatchNotesFeedStore implements PatchNotesFeedStore {
  constructor(private readonly directory: string) {}

  private filePath(locale: PatchNoteLocale): string {
    return path.join(this.directory, `${locale}.json`);
  }

  async load(locale: PatchNoteLocale): Promise<PatchNotesFeed | undefined> {
    try {
      const filePath = this.filePath(locale);
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size <= 0 || stat.size > FEED_MAX_BYTES) return undefined;
      const parsed = parsePatchNotesFeed(JSON.parse(await fs.readFile(filePath, "utf8")) as unknown);
      /* 파일 이름과 내용이 어긋나면 쓰지 않습니다. */
      return parsed?.locale === locale ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  async save(feed: PatchNotesFeed): Promise<void> {
    const filePath = this.filePath(feed.locale);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    /* 저장본은 언제나 stale: false 입니다. stale 은 읽는 시점에 정해집니다. */
    await fs.writeFile(temporaryPath, JSON.stringify({ ...feed, stale: false }), "utf8");
    await fs.rename(temporaryPath, filePath);
  }
}

export type PatchNotesServiceDeps = PatchNotesFetchDeps & {
  store?: PatchNotesFeedStore;
  /** Data Dragon 버전 목록 공급자. 실패해도 수집 자체는 계속합니다. */
  dataDragonVersionsProvider?: () => Promise<readonly string[]>;
  now?: () => number;
  refreshIntervalMs?: number;
};

type LocaleState = {
  feed?: PatchNotesFeed;
  /** 마지막으로 원문에서 성공적으로 받은 시각. */
  refreshedAt?: number;
  lastFailureAt?: number;
  inFlight?: Promise<void>;
};

export class PatchNotesService {
  private readonly states = new Map<PatchNoteLocale, LocaleState>();
  private readonly now: () => number;
  private readonly refreshIntervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(private readonly deps: PatchNotesServiceDeps = {}) {
    this.now = deps.now ?? Date.now;
    this.refreshIntervalMs = deps.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
  }

  private stateFor(locale: PatchNoteLocale): LocaleState {
    const existing = this.states.get(locale);
    if (existing) return existing;
    const created: LocaleState = {};
    this.states.set(locale, created);
    return created;
  }

  /** 캐시가 비어 있으면 디스크에 남은 마지막 성공본을 올립니다. */
  private async hydrate(locale: PatchNoteLocale): Promise<void> {
    const state = this.stateFor(locale);
    if (state.feed || !this.deps.store) return;
    const stored = await this.deps.store.load(locale);
    if (stored && !state.feed) state.feed = stored;
  }

  private async dataDragonVersions(): Promise<readonly string[]> {
    if (this.deps.dataDragonVersions) return this.deps.dataDragonVersions;
    if (!this.deps.dataDragonVersionsProvider) return [];
    try {
      return await this.deps.dataDragonVersionsProvider();
    } catch {
      /* 버전 매칭은 부가 정보입니다. 없다고 패치 노트를 못 보여 줄 이유는 없습니다. */
      return [];
    }
  }

  private async refreshOnce(locale: PatchNoteLocale): Promise<void> {
    const state = this.stateFor(locale);
    const notes = await fetchPatchNotes(locale, {
      fetchImpl: this.deps.fetchImpl,
      dataDragonVersions: await this.dataDragonVersions()
    });
    const feed: PatchNotesFeed = Object.freeze({
      schemaVersion: 1 as const,
      locale,
      fetchedAt: new Date(this.now()).toISOString(),
      stale: false,
      notes: Object.freeze(notes)
    });
    state.feed = feed;
    state.refreshedAt = this.now();
    state.lastFailureAt = undefined;
    await this.deps.store?.save(feed).catch(() => undefined);
  }

  private refresh(locale: PatchNoteLocale): Promise<void> {
    const state = this.stateFor(locale);
    /* 같은 언어를 동시에 여러 번 받아 오지 않습니다. */
    if (state.inFlight) return state.inFlight;
    const running = this.refreshOnce(locale)
      .catch((error: unknown) => {
        state.lastFailureAt = this.now();
        throw error;
      })
      .finally(() => {
        state.inFlight = undefined;
      });
    state.inFlight = running;
    return running;
  }

  /**
   * 화면에 내보낼 목록입니다. 최신 수집에 실패하고 저장본만 있으면 `stale: true` 가
   * 붙고, 저장본조차 없으면 undefined 입니다(호출한 쪽이 503 을 냅니다).
   */
  async getFeed(locale: PatchNoteLocale): Promise<PatchNotesFeed | undefined> {
    await this.hydrate(locale);
    const state = this.stateFor(locale);
    const fresh = state.refreshedAt !== undefined
      && this.now() - state.refreshedAt < this.refreshIntervalMs;
    if (state.feed && fresh) return state.feed;

    const backingOff = state.lastFailureAt !== undefined
      && this.now() - state.lastFailureAt < FAILURE_BACKOFF_MS;
    if (state.feed && backingOff) return Object.freeze({ ...state.feed, stale: true });

    try {
      await this.refresh(locale);
    } catch {
      /* 실패는 여기서 끝냅니다. 가진 것이 있으면 그것을 보여 줍니다. */
    }
    if (!state.feed) return undefined;
    const current = state.refreshedAt !== undefined
      && this.now() - state.refreshedAt < this.refreshIntervalMs;
    return current ? state.feed : Object.freeze({ ...state.feed, stale: true });
  }

  /** 주기 갱신. 첫 요청이 느려지지 않도록 기동 직후 한 번 받아 둡니다. */
  start(): void {
    if (this.timer) return;
    const run = () => {
      for (const locale of PATCH_NOTE_LOCALES) {
        this.refresh(locale).catch(() => undefined);
      }
    };
    run();
    this.timer = setInterval(run, this.refreshIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
