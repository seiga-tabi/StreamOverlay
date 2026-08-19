import { streamerChannelHandle, streamerPlatformFromChannelKey } from "@streamops/shared";
import type { TwitchApiClient } from "./twitch-api.js";

/* 추천 채널의 실시간 정보 — LIVE 여부와 프로필 이미지.
 *
 * 둘 다 DB 에 없는 값이고 Twitch 에만 있습니다. 원칙 두 가지:
 *
 * 1. Twitch 가 흔들려도 게시판은 그대로 뜬다. 실패는 "LIVE 아님"·"이미지 없음"
 *    으로 떨어지고 화면은 플랫폼 마크로 닫습니다.
 * 2. 시청자 브라우저가 Twitch CDN 에 직접 붙지 않는다. 이미지는 서버가 받아
 *    같은 origin 으로 다시 내보냅니다 — 시청자 IP 가 외부로 새지 않습니다.
 */

/** LIVE 는 자주 바뀌지만 매 요청 물을 값은 아닙니다. */
const LIVE_TTL_MS = 60_000;
/** 프로필 이미지는 거의 바뀌지 않습니다. */
const AVATAR_TTL_MS = 6 * 60 * 60 * 1000;
/** 프로필 이미지는 300px 남짓입니다. 이보다 크면 우리가 아는 그 이미지가 아닙니다. */
const AVATAR_MAX_BYTES = 512 * 1024;
const AVATAR_FETCH_TIMEOUT_MS = 4_000;
/** 메모리 상한 — 게시판이 커져도 이미지 캐시가 무한정 늘지 않게 합니다. */
const AVATAR_CACHE_MAX = 200;

const ALLOWED_AVATAR_HOSTS = new Set(["static-cdn.jtvnw.net"]);

const CONTENT_TYPES = new Map([
  ["image/png", "image/png"],
  ["image/jpeg", "image/jpeg"],
  ["image/webp", "image/webp"]
]);

export type StreamerAvatar = {
  body: Buffer;
  contentType: string;
  /** 캐시 검증용. 같은 이미지면 같은 값입니다. */
  etag: string;
};

type CachedAvatar = {
  value: StreamerAvatar | undefined;
  expiresAt: number;
};

/** channelKey 가 Twitch 채널이면 login 을, 아니면 undefined. */
export function twitchLoginForChannelKey(channelKey: string): string | undefined {
  if (streamerPlatformFromChannelKey(channelKey) !== "twitch") return undefined;
  const handle = streamerChannelHandle(channelKey);
  return handle && /^[a-z0-9][a-z0-9_]{0,24}$/u.test(handle) ? handle : undefined;
}

export class StreamerBoardChannelService {
  private liveLogins = new Set<string>();
  private liveExpiresAt = 0;
  private liveRequest?: Promise<Set<string>>;
  private readonly avatars = new Map<string, CachedAvatar>();
  private readonly avatarRequests = new Map<string, Promise<StreamerAvatar | undefined>>();

  constructor(
    private readonly twitch: TwitchApiClient | undefined,
    private readonly now: () => number = () => Date.now(),
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  /**
   * 넘긴 채널 키 중 지금 방송 중인 것. Twitch 채널만 판정할 수 있고 나머지는
   * 언제나 방송 중이 아닙니다(치지직·YouTube 는 조회 수단이 없습니다).
   */
  async liveChannelKeys(channelKeys: readonly string[]): Promise<string[]> {
    const byLogin = new Map<string, string>();
    for (const key of channelKeys) {
      const login = twitchLoginForChannelKey(key);
      if (login) byLogin.set(login, key);
    }
    if (byLogin.size === 0 || !this.twitch) return [];
    const live = await this.liveLoginsFor([...byLogin.keys()]);
    return [...byLogin.entries()]
      .filter(([login]) => live.has(login))
      .map(([, key]) => key);
  }

  private async liveLoginsFor(logins: readonly string[]): Promise<Set<string>> {
    if (this.liveExpiresAt > this.now()) return this.liveLogins;
    /* 요청이 겹쳐도 Twitch 에는 한 번만 묻습니다. */
    if (this.liveRequest) return this.liveRequest;
    const twitch = this.twitch;
    if (!twitch) return new Set();
    const request = twitch.getLiveLogins(logins)
      .catch(() => new Set<string>())
      .then((live) => {
        this.liveLogins = live;
        this.liveExpiresAt = this.now() + LIVE_TTL_MS;
        return live;
      })
      .finally(() => {
        this.liveRequest = undefined;
      });
    this.liveRequest = request;
    return request;
  }

  /**
   * 채널 프로필 이미지. 없으면 undefined 이고 화면은 플랫폼 마크로 떨어집니다.
   * "없음"도 캐시합니다 — 없다는 것을 확인하려고 매번 Twitch 를 부르지 않습니다.
   */
  async avatar(channelKey: string): Promise<StreamerAvatar | undefined> {
    const login = twitchLoginForChannelKey(channelKey);
    if (!login || !this.twitch) return undefined;
    const cached = this.avatars.get(login);
    if (cached && cached.expiresAt > this.now()) return cached.value;
    const pending = this.avatarRequests.get(login);
    if (pending) return pending;

    const request = this.loadAvatar(login)
      .catch(() => undefined)
      .then((value) => {
        this.avatars.set(login, { value, expiresAt: this.now() + AVATAR_TTL_MS });
        while (this.avatars.size > AVATAR_CACHE_MAX) {
          const oldest = this.avatars.keys().next().value;
          if (oldest === undefined) break;
          this.avatars.delete(oldest);
        }
        return value;
      })
      .finally(() => {
        this.avatarRequests.delete(login);
      });
    this.avatarRequests.set(login, request);
    return request;
  }

  private async loadAvatar(login: string): Promise<StreamerAvatar | undefined> {
    const profiles = await this.twitch?.getUserProfilesByLogins([login]);
    const imageUrl = profiles?.get(login)?.profileImageUrl;
    if (!imageUrl) return undefined;

    /* 대상 주소는 Twitch 가 준 값이지만 그대로 믿지 않습니다 — 알려진 호스트의
       https 만 받습니다(응답이 조작돼도 우리 서버가 임의 주소를 부르지 않도록). */
    let target: URL;
    try {
      target = new URL(imageUrl);
    } catch {
      return undefined;
    }
    if (target.protocol !== "https:" || !ALLOWED_AVATAR_HOSTS.has(target.hostname.toLowerCase())) {
      return undefined;
    }

    const response = await this.fetchImpl(target, {
      signal: AbortSignal.timeout(AVATAR_FETCH_TIMEOUT_MS),
      headers: { Accept: "image/*" }
    });
    if (!response.ok) return undefined;
    const contentType = CONTENT_TYPES.get((response.headers.get("content-type") ?? "").split(";")[0]!.trim());
    if (!contentType) return undefined;
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > AVATAR_MAX_BYTES) return undefined;
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length === 0 || body.length > AVATAR_MAX_BYTES) return undefined;

    /* URL 이 바뀌면(사진 교체) etag 도 바뀝니다 — 경로는 그대로 두고 내용만 갱신됩니다. */
    return { body, contentType, etag: `"streamer-avatar-${login}-${body.length}"` };
  }
}
