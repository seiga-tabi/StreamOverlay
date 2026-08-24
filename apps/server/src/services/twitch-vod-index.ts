/* 경기 → 다시보기(VOD) 점프 지점 찾기 — 목업 page-4 v34.
 *
 * 스트리머의 지난 방송 아카이브 목록을 받아, 경기 시작 시각이 어느 방송 안에
 * 들어가는지 보고 그 방송의 몇 초 지점인지 계산합니다. 프런트는 이 값이 있을 때만
 * 다시보기 버튼을 그립니다.
 *
 * 앱 토큰(client_credentials)으로 조회합니다 — 남의 채널 아카이브는 공개 정보라
 * 시청자 토큰이 필요 없고, 시청자 토큰을 쓰면 로그인한 사람에게만 버튼이 보입니다.
 *
 * 한계(주석으로 남겨 둡니다):
 * - VOD 는 보관 기간(14~60일)이 지나면 사라집니다. "없음"이 정상입니다.
 * - 방송이 끊겼다 이어진 구간의 경기는 어느 VOD 에도 안 들어갑니다 — 그때도 없음입니다.
 * - VOD 내부 시각은 방송 중단·광고로 실제 시계와 어긋날 수 있어 오차가 생깁니다.
 *   경기 시작보다 조금 앞을 가리키는 편이 낫기 때문에 LEAD_IN_SECONDS 만큼 당깁니다.
 */

export type TwitchVod = {
  id: string;
  /** 방송 시작 시각(ISO). */
  createdAt: string;
  durationSeconds: number;
};

export type MatchReplay = {
  vodId: string;
  offsetSeconds: number;
};

export type TwitchVodFetchResult =
  | { state: "ready"; vods: TwitchVod[] }
  | { state: "failed"; reason: string };

/** 경기 시작 직전부터 보여 주는 편이 실제로 쓸모 있습니다(로딩·밴픽 끝자락). */
export const REPLAY_LEAD_IN_SECONDS = 30;

/** 이보다 짧은 VOD 는 방송 조각이라 점프 대상이 되지 못합니다. */
const MIN_VOD_SECONDS = 60;

const DURATION_PATTERN = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/u;

/**
 * Twitch 의 duration 표기("3h21m14s" · "12m" · "45s")를 초로 바꿉니다.
 * 형식을 벗어나면 undefined — 그 VOD 는 후보에서 빠집니다.
 */
export function parseTwitchVodDuration(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  const matched = DURATION_PATTERN.exec(trimmed);
  if (!matched) return undefined;
  const [, hours, minutes, seconds] = matched;
  if (hours === undefined && minutes === undefined && seconds === undefined) return undefined;
  const total = Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
  return Number.isSafeInteger(total) && total > 0 ? total : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** helix/videos 응답에서 쓸 수 있는 아카이브만 추립니다. */
export function parseTwitchVods(payload: unknown): TwitchVod[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  const vods: TwitchVod[] = [];
  for (const entry of payload.data) {
    if (!isRecord(entry)) continue;
    /* 아카이브(지난 방송)만 씁니다 — highlight·upload 는 방송 시각과 무관합니다. */
    if (entry.type !== undefined && entry.type !== "archive") continue;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!/^\d{1,20}$/u.test(id)) continue;
    const createdAt = typeof entry.created_at === "string" ? entry.created_at : "";
    if (!createdAt || !Number.isFinite(Date.parse(createdAt))) continue;
    const durationSeconds = parseTwitchVodDuration(entry.duration);
    if (durationSeconds === undefined || durationSeconds < MIN_VOD_SECONDS) continue;
    vods.push({ id, createdAt, durationSeconds });
  }
  return vods;
}

/**
 * 경기 시작 시각이 들어가는 VOD 와 그 안의 초 위치.
 *
 * 겹치는 VOD 가 있으면 더 늦게 시작한 쪽을 씁니다 — 재방송·분할 업로드가 겹칠 때
 * 실제 그 경기를 담은 것은 나중 것입니다.
 */
export function replayForMatch(
  vods: readonly TwitchVod[],
  matchStartedAt: string | undefined
): MatchReplay | undefined {
  if (!matchStartedAt) return undefined;
  const startedAt = Date.parse(matchStartedAt);
  if (!Number.isFinite(startedAt)) return undefined;

  let best: { vod: TwitchVod; vodStart: number } | undefined;
  for (const vod of vods) {
    const vodStart = Date.parse(vod.createdAt);
    if (!Number.isFinite(vodStart)) continue;
    if (startedAt < vodStart) continue;
    if (startedAt >= vodStart + vod.durationSeconds * 1000) continue;
    if (!best || vodStart > best.vodStart) best = { vod, vodStart };
  }
  if (!best) return undefined;

  const rawOffset = Math.floor((startedAt - best.vodStart) / 1000);
  const offsetSeconds = Math.max(0, rawOffset - REPLAY_LEAD_IN_SECONDS);
  /* 경계에서 뒤로 밀리지 않게 상한을 둡니다. */
  return { vodId: best.vod.id, offsetSeconds: Math.min(offsetSeconds, best.vod.durationSeconds - 1) };
}

/** Twitch 링크의 t 파라미터 표기("1h02m03s"). */
export function replayTimestampParam(offsetSeconds: number): string {
  const safe = Math.max(0, Math.trunc(offsetSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}h${String(minutes).padStart(2, "0")}m${String(seconds).padStart(2, "0")}s`;
}

export type TwitchVodIndexDeps = {
  /** 성공한 빈 목록과 실패를 구분해 실패 캐시가 오래 남지 않게 합니다. */
  videosFor: (twitchUserId: string) => Promise<TwitchVodFetchResult>;
  onLoad?: (result: {
    twitchUserId: string;
    state: TwitchVodFetchResult["state"];
    vodCount: number;
    cacheTtlMs: number;
    reason?: string;
  }) => void;
  now?: () => number;
};

/** VOD 목록은 방송이 끝날 때만 늘어납니다 — 자주 물을 값이 아닙니다. */
export const VOD_LIST_TTL_MS = 10 * 60 * 1000;
/** 일시 실패를 "아카이브 없음"처럼 오래 고정하지 않습니다. */
export const VOD_LIST_FAILURE_TTL_MS = 30 * 1000;
const VOD_CACHE_MAX = 200;

export class TwitchVodIndex {
  private readonly cache = new Map<string, { vods: TwitchVod[]; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<TwitchVod[]>>();
  private readonly now: () => number;

  constructor(private readonly deps: TwitchVodIndexDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  /** 경기 하나의 점프 지점. 못 찾으면 undefined 이고 화면은 버튼을 그리지 않습니다. */
  async replayFor(twitchUserId: string, matchStartedAt: string | undefined): Promise<MatchReplay | undefined> {
    if (!matchStartedAt || !/^\d{1,32}$/u.test(twitchUserId)) return undefined;
    const vods = await this.vodsFor(twitchUserId);
    return replayForMatch(vods, matchStartedAt);
  }

  /** 여러 경기를 한 번에 — 목록 화면이 매 행마다 조회를 돌리지 않도록. */
  async replaysFor(
    twitchUserId: string,
    matchStartedAts: readonly (string | undefined)[]
  ): Promise<(MatchReplay | undefined)[]> {
    if (!/^\d{1,32}$/u.test(twitchUserId)) return matchStartedAts.map(() => undefined);
    const vods = await this.vodsFor(twitchUserId);
    return matchStartedAts.map((startedAt) => replayForMatch(vods, startedAt));
  }

  private async vodsFor(twitchUserId: string): Promise<TwitchVod[]> {
    const cached = this.cache.get(twitchUserId);
    if (cached && cached.expiresAt > this.now()) return cached.vods;
    const pending = this.inFlight.get(twitchUserId);
    if (pending) return pending;

    const request = this.deps.videosFor(twitchUserId)
      .catch((): TwitchVodFetchResult => ({ state: "failed", reason: "network_error" }))
      .then((result) => {
        const vods = result.state === "ready" ? result.vods : [];
        const cacheTtlMs = result.state === "ready" ? VOD_LIST_TTL_MS : VOD_LIST_FAILURE_TTL_MS;
        try {
          this.deps.onLoad?.({
            twitchUserId,
            state: result.state,
            vodCount: vods.length,
            cacheTtlMs,
            ...(result.state === "failed" ? { reason: result.reason } : {})
          });
        } catch {
          /* 진단 기록 실패가 다시보기 계산을 막아서는 안 됩니다. */
        }
        /* 정상적인 빈 목록은 오래, 일시 실패는 짧게 캐시합니다. */
        this.cache.set(twitchUserId, { vods, expiresAt: this.now() + cacheTtlMs });
        while (this.cache.size > VOD_CACHE_MAX) {
          const oldest = this.cache.keys().next().value;
          if (oldest === undefined) break;
          this.cache.delete(oldest);
        }
        return vods;
      })
      .finally(() => {
        this.inFlight.delete(twitchUserId);
      });
    this.inFlight.set(twitchUserId, request);
    return request;
  }
}
