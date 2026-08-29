import crypto from "node:crypto";
import type { LolRankedStats } from "@streamops/shared";

export type PublicLolSocialLocale = "ko" | "ja";

export type PublicLolSocialProfile = {
  riotId: string;
  gameName: string;
  tagLine: string;
  lolPlatform: string;
  frequentTeammates?: readonly {
    gameName: string;
    tagLine: string;
    games: number;
    wins: number;
    lastPlayedAt?: string;
  }[];
  profileIconUrl?: string;
  streamerProfileImageUrl?: string;
  rankedStats?: LolRankedStats;
  summary?: {
    recentGames?: number;
    recentWins?: number;
    recentWinRate?: number;
    averageKda?: number;
  };
  recentMatches?: Array<{
    result?: "win" | "loss" | "remake" | "unknown";
    kills?: number;
    deaths?: number;
    assists?: number;
  }>;
  fetchedAt: string;
};

export type PublicLolSocialSummary = {
  title: string;
  description: string;
  imageAlt: string;
  revision: string;
  riotId: string;
  rankLabel: string;
  recentLabel: string;
  recentRecordLabel?: string;
  winRateLabel?: string;
  kdaLabel?: string;
};

const SOCIAL_CARD_WIDTH = 1200;
const SOCIAL_CARD_HEIGHT = 630;
const MAX_CARD_CACHE = 100;
const MAX_ICON_CACHE = 100;
const MAX_ICON_BYTES = 512 * 1024;
const MAX_CARD_BYTES = 2 * 1024 * 1024;
const MAX_RENDER_CONCURRENCY = 2;
const MAX_RENDER_WAITERS = 16;
const RENDER_TIMEOUT_SECONDS = 3;

type SharpFactory = typeof import("sharp")["default"];

let sharpFactoryPromise: Promise<SharpFactory> | undefined;

async function loadSharpFactory(): Promise<SharpFactory> {
  sharpFactoryPromise ??= import("sharp").then((module) => module.default);
  return sharpFactoryPromise;
}

function safeText(value: unknown, maxLength = 80): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function safeCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.trunc(value);
}

function safeDecimal(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}

function svgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rankLabel(stats: LolRankedStats | undefined, locale: PublicLolSocialLocale): string {
  if (!stats || stats.tier === "UNRANKED") return locale === "ja" ? "アンランク" : "언랭크";
  const tier = stats.tier.charAt(0) + stats.tier.slice(1).toLocaleLowerCase();
  const rank = ["CHALLENGER", "GRANDMASTER", "MASTER"].includes(stats.tier)
    ? ""
    : safeText(stats.rank, 8);
  const lp = safeCount(stats.leaguePoints);
  const localizedLp = lp && lp > 0 ? `${lp.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR")} LP` : "";
  return [tier, rank, localizedLp].filter(Boolean).join(" ");
}

function recentSummary(profile: PublicLolSocialProfile, locale: PublicLolSocialLocale): {
  label: string;
  averageKda?: number;
  games?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
} {
  const recentMatches = Array.isArray(profile.recentMatches) ? profile.recentMatches : [];
  const decidedMatches = recentMatches.filter((match) => match.result === "win" || match.result === "loss");
  const summaryGames = safeCount(profile.summary?.recentGames);
  const games = summaryGames && summaryGames > 0 ? summaryGames : decidedMatches.length || undefined;
  const summaryWins = safeCount(profile.summary?.recentWins);
  const wins = games === undefined
    ? undefined
    : Math.min(games, summaryWins ?? decidedMatches.filter((match) => match.result === "win").length);
  const losses = games !== undefined && wins !== undefined ? Math.max(0, games - wins) : undefined;
  const statedWinRate = safeDecimal(profile.summary?.recentWinRate);
  const winRate = games && games > 0 && wins !== undefined
    ? (statedWinRate !== undefined && statedWinRate <= 100 ? statedWinRate : Math.round((wins / games) * 100))
    : undefined;
  const statedKda = safeDecimal(profile.summary?.averageKda);
  const totals = recentMatches.reduce<{ kills: number; deaths: number; assists: number }>((acc, match) => ({
    kills: acc.kills + (safeCount(match.kills) ?? 0),
    deaths: acc.deaths + (safeCount(match.deaths) ?? 0),
    assists: acc.assists + (safeCount(match.assists) ?? 0),
  }), { kills: 0, deaths: 0, assists: 0 });
  const averageKda = statedKda ?? (recentMatches.length > 0
    ? Math.round(((totals.kills + totals.assists) / Math.max(1, totals.deaths)) * 100) / 100
    : undefined);
  const label = games && wins !== undefined && losses !== undefined && winRate !== undefined
    ? (locale === "ja"
      ? `直近${games}試合 · ${wins}勝 ${losses}敗 · 勝率${winRate}%`
      : `최근 ${games}게임 · ${wins}승 ${losses}패 · 승률 ${winRate}%`)
    : (locale === "ja" ? "最近の戦績をYORO.ggで確認" : "최근 전적을 YORO.gg에서 확인");
  return { label, averageKda, games, wins, losses, winRate };
}

export function buildPublicLolSocialSummary(
  profile: PublicLolSocialProfile,
  locale: PublicLolSocialLocale,
): PublicLolSocialSummary {
  const gameName = safeText(profile.gameName, 48);
  const tagLine = safeText(profile.tagLine, 24);
  const riotId = safeText(profile.riotId, 80) || `${gameName}#${tagLine}`;
  const rank = rankLabel(profile.rankedStats, locale);
  const recent = recentSummary(profile, locale);
  const kdaLabel = recent.averageKda !== undefined
    ? (locale === "ja" ? `平均KDA ${recent.averageKda.toFixed(2)}` : `평균 KDA ${recent.averageKda.toFixed(2)}`)
    : undefined;
  const title = `${riotId} · ${rank} | YORO.gg`;
  const description = [recent.label, kdaLabel].filter(Boolean).join(" · ");
  const imageAlt = locale === "ja"
    ? `${riotId}のLeague of Legends戦績カード`
    : `${riotId}의 League of Legends 전적 카드`;
  const revisionPayload = JSON.stringify({
    fetchedAt: safeText(profile.fetchedAt, 40),
    kda: recent.averageKda,
    locale,
    platform: safeText(profile.lolPlatform, 16),
    rank,
    profileIconUrl: safeText(profile.profileIconUrl, 300),
    streamerProfileImageUrl: safeText(profile.streamerProfileImageUrl, 500),
    recent: recent.label,
    riotId,
  });
  return {
    title,
    description,
    imageAlt,
    revision: crypto.createHash("sha256").update(revisionPayload).digest("hex").slice(0, 16),
    riotId,
    rankLabel: rank,
    recentLabel: recent.label,
    recentRecordLabel: recent.games && recent.wins !== undefined && recent.losses !== undefined
      ? (locale === "ja" ? `${recent.wins}勝 ${recent.losses}敗` : `${recent.wins}승 ${recent.losses}패`)
      : undefined,
    winRateLabel: recent.winRate !== undefined
      ? (locale === "ja" ? `勝率 ${recent.winRate}%` : `승률 ${recent.winRate}%`)
      : undefined,
    kdaLabel,
  };
}

export function safeDataDragonProfileIconUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 300 || /[%\\\u0000-\u001f\u007f]/u.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "ddragon.leagueoflegends.com") return undefined;
    if (url.port || url.username || url.password || url.search || url.hash) return undefined;
    if (!/^\/cdn\/[0-9]+(?:\.[0-9]+){1,3}\/img\/profileicon\/[0-9]+\.png$/u.test(url.pathname)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function safeTwitchProfileImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 500 || /[%\\\u0000-\u001f\u007f]/u.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "static-cdn.jtvnw.net") return undefined;
    if (url.port || url.username || url.password || url.search || url.hash) return undefined;
    if (!/^\/jtv_user_pictures\/[A-Za-z0-9_-]+(?:-profile_image-[0-9]+x[0-9]+)?\.png$/u.test(url.pathname)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function publicLolSocialProfileImageUrls(profile: PublicLolSocialProfile): string[] {
  const urls = [
    safeTwitchProfileImageUrl(profile.streamerProfileImageUrl),
    safeDataDragonProfileIconUrl(profile.profileIconUrl),
  ].filter((url): url is string => Boolean(url));
  return [...new Set(urls)];
}

function isSafePng(body: Buffer): boolean {
  if (body.length < 24 || !body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  const width = body.readUInt32BE(16);
  const height = body.readUInt32BE(20);
  return width > 0 && height > 0 && width <= 2048 && height <= 2048;
}

function touchCache<K, V>(cache: Map<K, V>, key: K, value: V, maxSize: number): V {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > maxSize) {
    const oldest = cache.keys().next().value as K | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return value;
}

export class PublicLolSocialCardRenderer {
  private readonly cards = new Map<string, Buffer>();
  private readonly sourceImages = new Map<string, Buffer>();
  private readonly icons = new Map<string, Buffer>();
  private readonly inFlightCards = new Map<string, Promise<Buffer>>();
  private readonly renderWaiters: Array<() => void> = [];
  private activeRenders = 0;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sharpFactoryLoader: () => Promise<SharpFactory> = loadSharpFactory,
  ) {}

  async render(profile: PublicLolSocialProfile, locale: PublicLolSocialLocale): Promise<{
    body: Buffer;
    summary: PublicLolSocialSummary;
  }> {
    const summary = buildPublicLolSocialSummary(profile, locale);
    const cached = this.cards.get(summary.revision);
    if (cached) return { body: touchCache(this.cards, summary.revision, cached, MAX_CARD_CACHE), summary };
    const running = this.inFlightCards.get(summary.revision);
    if (running) return { body: await running, summary };
    const task = this.withRenderSlot(async () => {
      const icon = await this.loadProfileIcon(profile);
      const body = await this.renderPng(summary, locale, icon);
      if (body.length > MAX_CARD_BYTES) throw new Error("공유 이미지 응답 크기 제한을 초과했습니다.");
      return touchCache(this.cards, summary.revision, body, MAX_CARD_CACHE);
    });
    this.inFlightCards.set(summary.revision, task);
    try {
      return { body: await task, summary };
    } finally {
      this.inFlightCards.delete(summary.revision);
    }
  }

  async sourceImage(profile: PublicLolSocialProfile): Promise<Buffer | undefined> {
    for (const url of publicLolSocialProfileImageUrls(profile)) {
      const image = await this.loadSourceImage(url);
      if (image) return image;
    }
    return undefined;
  }

  private async withRenderSlot<T>(render: () => Promise<T>): Promise<T> {
    if (this.activeRenders >= MAX_RENDER_CONCURRENCY) {
      if (this.renderWaiters.length >= MAX_RENDER_WAITERS) {
        throw new Error("공유 이미지 생성 대기열이 가득 찼습니다.");
      }
      await new Promise<void>((resolve) => this.renderWaiters.push(resolve));
    }
    this.activeRenders += 1;
    try {
      return await render();
    } finally {
      this.activeRenders = Math.max(0, this.activeRenders - 1);
      this.renderWaiters.shift()?.();
    }
  }

  private async loadSourceImage(url: string): Promise<Buffer | undefined> {
    const cached = this.sourceImages.get(url);
    if (cached) return touchCache(this.sourceImages, url, cached, MAX_ICON_CACHE);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok || response.headers.get("content-type")?.split(";", 1)[0] !== "image/png") return undefined;
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_ICON_BYTES) return undefined;
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0 || body.length > MAX_ICON_BYTES || !isSafePng(body)) return undefined;
      return touchCache(this.sourceImages, url, body, MAX_ICON_CACHE);
    } catch {
      return undefined;
    }
  }

  private async loadProfileIcon(profile: PublicLolSocialProfile): Promise<Buffer | undefined> {
    for (const url of publicLolSocialProfileImageUrls(profile)) {
      const cached = this.icons.get(url);
      if (cached) return touchCache(this.icons, url, cached, MAX_ICON_CACHE);
      try {
        const body = await this.loadSourceImage(url);
        if (!body) continue;
        const sharp = await this.sharpFactoryLoader();
        const metadata = await sharp(body, { limitInputPixels: 1024 * 1024 }).metadata();
        if (metadata.format !== "png" || !metadata.width || !metadata.height || metadata.width > 1024 || metadata.height > 1024) continue;
        const mask = Buffer.from('<svg width="176" height="176"><circle cx="88" cy="88" r="88" fill="white"/></svg>');
        const normalized = await sharp(body, { limitInputPixels: 1024 * 1024 })
          .resize(176, 176, { fit: "cover" })
          .composite([{ input: mask, blend: "dest-in" }])
          .png({ compressionLevel: 9 })
          .toBuffer();
        return touchCache(this.icons, url, normalized, MAX_ICON_CACHE);
      } catch {
        // 등록 스트리머 이미지가 손상됐거나 만료되면 일반 Riot 프로필 이미지 후보를 계속 확인합니다.
      }
    }
    return undefined;
  }

  private async renderPng(
    summary: PublicLolSocialSummary,
    locale: PublicLolSocialLocale,
    icon: Buffer | undefined,
  ): Promise<Buffer> {
    const sharp = await this.sharpFactoryLoader();
    const avatarInitial = Array.from(summary.riotId)[0]?.toLocaleUpperCase() ?? "Y";
    const svg = Buffer.from(`
      <svg width="${SOCIAL_CARD_WIDTH}" height="${SOCIAL_CARD_HEIGHT}" viewBox="0 0 ${SOCIAL_CARD_WIDTH} ${SOCIAL_CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0b1221"/>
            <stop offset="0.55" stop-color="#131d35"/>
            <stop offset="1" stop-color="#29195a"/>
          </linearGradient>
          <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#7667ff"/>
            <stop offset="1" stop-color="#b05cff"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#background)"/>
        <circle cx="1050" cy="90" r="270" fill="#765cff" opacity="0.14"/>
        <circle cx="1110" cy="560" r="360" fill="#3e8cff" opacity="0.08"/>
        <rect x="50" y="50" width="1100" height="530" rx="34" fill="#0d1425" fill-opacity="0.78" stroke="#6674a8" stroke-opacity="0.48"/>
        <rect x="50" y="50" width="10" height="530" rx="5" fill="url(#accent)"/>
        <text x="100" y="125" fill="#f8faff" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="40" font-weight="800">YORO.gg</text>
        <text x="1095" y="122" text-anchor="end" fill="#aeb8d7" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="22">LEAGUE OF LEGENDS</text>
        <circle cx="210" cy="310" r="98" fill="#222d4a" stroke="url(#accent)" stroke-width="8"/>
        ${icon ? "" : `<text x="210" y="335" text-anchor="middle" fill="#ffffff" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="74" font-weight="800">${svgText(avatarInitial)}</text>`}
        <text x="350" y="255" fill="#ffffff" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="54" font-weight="800">${svgText(summary.riotId)}</text>
        <rect x="350" y="292" width="390" height="70" rx="20" fill="#202a46" stroke="#6272b0" stroke-opacity="0.5"/>
        <text x="380" y="338" fill="#9ed8ff" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="30" font-weight="700">${svgText(summary.rankLabel)}</text>
        <text x="350" y="408" fill="#aeb8d7" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="20">${locale === "ja" ? "最近の戦績" : "최근 전적"}</text>
        <text x="350" y="452" fill="#eef1fb" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="29" font-weight="700">${svgText(summary.recentRecordLabel ?? summary.recentLabel)}</text>
        <text x="620" y="408" fill="#aeb8d7" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="20">${locale === "ja" ? "勝率" : "승률"}</text>
        ${summary.winRateLabel ? `<text x="620" y="452" fill="#eef1fb" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="29" font-weight="700">${svgText(summary.winRateLabel.replace(/^(승률|勝率)\s*/u, ""))}</text>` : ""}
        <text x="820" y="408" fill="#aeb8d7" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="20">${locale === "ja" ? "平均KDA" : "평균 KDA"}</text>
        ${summary.kdaLabel ? `<text x="820" y="452" fill="#bcb4ff" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="29" font-weight="700">${svgText(summary.kdaLabel.replace(/^(평균 KDA|平均KDA)\s*/u, ""))}</text>` : ""}
        <text x="1095" y="535" text-anchor="end" fill="#aeb8d7" font-family="Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="21">${locale === "ja" ? "YORO.ggで戦績を確認" : "YORO.gg에서 전적 확인"}</text>
      </svg>
    `);
    const base = sharp(svg).timeout({ seconds: RENDER_TIMEOUT_SECONDS });
    if (!icon) return base.png({ compressionLevel: 9 }).toBuffer();
    return base
      .composite([{ input: icon, left: 122, top: 222 }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
}
