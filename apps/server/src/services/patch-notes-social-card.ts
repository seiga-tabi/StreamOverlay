import type { PatchNote, PatchNoteLocale, PatchNotesFeed } from "@streamops/shared";
import { isPatchNoteImageUrl } from "@streamops/shared";

/* LoL 패치 노트 SNS 공유 카드(1200×630).
 *
 * 소환사 프로필 카드(public-lol-social-card.ts)와 같은 파이프라인입니다:
 * SVG 조립 → sharp PNG. 카드 재료는 전부 패치 노트 수집 응답이 이미 주는
 * 값(patchVersion·summary·publishedAt·imageUrl·accentColor)이라 새 수집이 없고,
 * 키 아트는 생성 시점에 한 번 받아 PNG 안에 굽습니다 — 공유받은 쪽에서
 * Riot CDN 으로 나가는 런타임 요청이 없습니다(방송 안정성 원칙).
 * 근거: docs/mockups/patch-share-card.html §01·§03
 */

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const MAX_CARD_CACHE = 40;
const MAX_ART_CACHE = 12;
const MAX_ART_BYTES = 3 * 1024 * 1024;
const MAX_CARD_BYTES = 2 * 1024 * 1024;
const MAX_RENDER_CONCURRENCY = 2;
const MAX_RENDER_WAITERS = 16;
const RENDER_TIMEOUT_SECONDS = 3;
const ART_FETCH_TIMEOUT_MS = 3_000;

const GOLD = "#f2c14e";
const GOLD_INK = "#241a02";
const NAVY = "#0b1420";
const HEX_COLOR = /^#[0-9a-f]{6}$/u;
const CARD_DATE_LOCALES: Readonly<Record<PatchNoteLocale, string>> = Object.freeze({
  ko: "ko-KR",
  ja: "ja-JP",
  en: "en-US",
});
const CARD_TITLE_LABELS: Readonly<Record<PatchNoteLocale, string>> = Object.freeze({
  ko: "LoL 패치 노트",
  ja: "LoLパッチノート",
  en: "LoL Patch Notes",
});

type SharpFactory = typeof import("sharp")["default"];

let sharpFactoryPromise: Promise<SharpFactory> | undefined;

async function loadSharpFactory(): Promise<SharpFactory> {
  sharpFactoryPromise ??= import("sharp").then((module) => module.default);
  return sharpFactoryPromise;
}

function svgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

export type PatchNotesCardModel = Readonly<{
  patchVersion: string;
  summary?: string;
  publishedAt: string;
  imageUrl?: string;
  accentColor?: string;
}>;

/** 피드에서 카드로 만들 수 있는(버전이 있는) 가장 최신 패치를 고릅니다. */
export function latestPatchNoteWithVersion(feed: PatchNotesFeed | undefined): PatchNote | undefined {
  return feed?.notes.find((note) => note.patchVersion);
}

export function patchNotesCardModel(note: PatchNote): PatchNotesCardModel | undefined {
  if (!note.patchVersion) return undefined;
  return Object.freeze({
    patchVersion: note.patchVersion,
    ...(note.summary ? { summary: note.summary } : {}),
    publishedAt: note.publishedAt,
    ...(note.imageUrl && isPatchNoteImageUrl(note.imageUrl) ? { imageUrl: note.imageUrl } : {}),
    ...(note.accentColor && HEX_COLOR.test(note.accentColor) ? { accentColor: note.accentColor } : {}),
  });
}

/** SVG 는 자동 줄바꿈이 없어 요약을 최대 2줄로 직접 자릅니다(넘치면 말줄임). */
export function wrapSummaryLines(summary: string, maxPerLine: number): readonly string[] {
  const text = safeText(summary, maxPerLine * 3);
  if (!text) return [];
  const lines: string[] = [];
  let rest = text;
  while (rest && lines.length < 2) {
    if ([...rest].length <= maxPerLine) {
      lines.push(rest);
      rest = "";
      break;
    }
    const slice = [...rest].slice(0, maxPerLine).join("");
    /* 공백 언어(ko)는 단어 경계에서, 일본어처럼 공백이 없으면 글자 수로 자릅니다. */
    const breakAt = slice.lastIndexOf(" ");
    const cut = breakAt > maxPerLine * 0.5 ? breakAt : slice.length;
    lines.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest && lines.length === 2) {
    const last = lines[1]!;
    lines[1] = `${[...last].slice(0, Math.max(1, maxPerLine - 1)).join("").trimEnd()}…`;
  }
  return lines;
}

export function cardDateLabel(publishedAt: string, locale: PatchNoteLocale): string {
  const time = Date.parse(publishedAt);
  if (!Number.isFinite(time)) return "";
  const date = new Date(time);
  return date.toLocaleDateString(CARD_DATE_LOCALES[locale], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

function isSafeArtImage(metadata: { format?: string; width?: number; height?: number }): boolean {
  return (metadata.format === "jpeg" || metadata.format === "png" || metadata.format === "webp")
    && Boolean(metadata.width && metadata.height)
    && (metadata.width ?? 0) <= 4096
    && (metadata.height ?? 0) <= 4096;
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

export class PatchNotesSocialCardRenderer {
  private readonly cards = new Map<string, Buffer>();
  private readonly arts = new Map<string, Buffer>();
  private readonly inFlight = new Map<string, Promise<Buffer>>();
  private readonly renderWaiters: Array<() => void> = [];
  private activeRenders = 0;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sharpFactoryLoader: () => Promise<SharpFactory> = loadSharpFactory,
  ) {}

  async render(model: PatchNotesCardModel, locale: PatchNoteLocale): Promise<Buffer> {
    const key = `${locale}:${model.patchVersion}`;
    const cached = this.cards.get(key);
    if (cached) return touchCache(this.cards, key, cached, MAX_CARD_CACHE);
    const running = this.inFlight.get(key);
    if (running) return running;
    const task = this.withRenderSlot(async () => {
      const art = await this.loadKeyArt(model);
      const body = await this.renderPng(model, locale, art);
      if (body.length > MAX_CARD_BYTES) throw new Error("패치 공유 이미지 응답 크기 제한을 초과했습니다.");
      return touchCache(this.cards, key, body, MAX_CARD_CACHE);
    });
    this.inFlight.set(key, task);
    try {
      return await task;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async withRenderSlot<T>(render: () => Promise<T>): Promise<T> {
    if (this.activeRenders >= MAX_RENDER_CONCURRENCY) {
      if (this.renderWaiters.length >= MAX_RENDER_WAITERS) {
        throw new Error("패치 공유 이미지 생성 대기열이 가득 찼습니다.");
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

  /**
   * 키 아트 PNG 하나만 돌려줍니다(공유 카드 캔버스용).
   *
   * 브라우저가 Riot CDN 에서 직접 받아 캔버스에 그릴 수 없기 때문입니다 —
   * cmsassets.rgpub.io 는 access-control-allow-origin 을 주지 않아
   * canvas 가 오염(tainted)되고 toDataURL 이 막힙니다(2026-08-18 실측).
   * 같은 origin 에서 내려주면 그 제약이 사라집니다.
   *
   * URL 은 이용자 입력이 아니라 우리가 수집한 노트의 imageUrl 이고, 아래
   * loadKeyArt 의 allowlist·timeout·크기 상한·이미지 검사를 그대로 지납니다.
   */
  async keyArt(model: PatchNotesCardModel): Promise<Buffer | undefined> {
    return this.loadKeyArt(model);
  }

  /** 키 아트를 1200×630 cover 로 정규화합니다. 실패하면 undefined — 폴백형으로 갑니다. */
  private async loadKeyArt(model: PatchNotesCardModel): Promise<Buffer | undefined> {
    const url = model.imageUrl;
    if (!url || !isPatchNoteImageUrl(url)) return undefined;
    const cached = this.arts.get(url);
    if (cached) return touchCache(this.arts, url, cached, MAX_ART_CACHE);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(ART_FETCH_TIMEOUT_MS),
      });
      const contentType = response.headers.get("content-type")?.split(";", 1)[0] ?? "";
      if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) return undefined;
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_ART_BYTES) return undefined;
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0 || body.length > MAX_ART_BYTES) return undefined;
      const sharp = await this.sharpFactoryLoader();
      const metadata = await sharp(body, { limitInputPixels: 4096 * 4096 }).metadata();
      if (!isSafeArtImage(metadata)) return undefined;
      const normalized = await sharp(body, { limitInputPixels: 4096 * 4096 })
        .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: "centre" })
        .png({ compressionLevel: 9 })
        .toBuffer();
      return touchCache(this.arts, url, normalized, MAX_ART_CACHE);
    } catch {
      return undefined;
    }
  }

  private overlaySvg(model: PatchNotesCardModel, locale: PatchNoteLocale, hasArt: boolean): Buffer {
    const ja = locale === "ja";
    const accent = model.accentColor && HEX_COLOR.test(model.accentColor) ? model.accentColor : NAVY;
    const summaryLines = wrapSummaryLines(model.summary ?? "", ja ? 26 : 28);
    const dateLabel = cardDateLabel(model.publishedAt, locale);
    const fontFamily = "Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif";
    return Buffer.from(`
      <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#060c14" stop-opacity="0.96"/>
            <stop offset="0.38" stop-color="#060c14" stop-opacity="0.88"/>
            <stop offset="0.72" stop-color="#060c14" stop-opacity="0.28"/>
            <stop offset="1" stop-color="#060c14" stop-opacity="0.12"/>
          </linearGradient>
          <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="${svgText(accent)}" stop-opacity="0.38"/>
            <stop offset="0.55" stop-color="${svgText(accent)}" stop-opacity="0"/>
          </linearGradient>
          <radialGradient id="fallbackGlow" cx="0.88" cy="0.1" r="1.2">
            <stop offset="0" stop-color="${GOLD}" stop-opacity="0.16"/>
            <stop offset="0.55" stop-color="${GOLD}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        ${hasArt
          ? '<rect width="1200" height="630" fill="url(#shade)"/><rect width="1200" height="630" fill="url(#accent)"/>'
          : `<rect width="1200" height="630" fill="${NAVY}"/><rect width="1200" height="630" fill="url(#fallbackGlow)"/>`}
        <rect x="64" y="52" width="48" height="48" rx="11" fill="${GOLD}"/>
        <text x="88" y="86" text-anchor="middle" fill="${GOLD_INK}" font-family="${fontFamily}" font-size="26" font-weight="900">Y</text>
        <text x="128" y="86" fill="#f8f9fa" font-family="${fontFamily}" font-size="30" font-weight="900">YORO.gg</text>
        <line x1="286" y1="60" x2="286" y2="92" stroke="#f8f9fa" stroke-opacity="0.3"/>
        <text x="306" y="85" fill="#f8f9fa" fill-opacity="0.75" font-family="${fontFamily}" font-size="24" font-weight="700">${CARD_TITLE_LABELS[locale]}</text>
        <text x="66" y="212" fill="${GOLD}" font-family="${fontFamily}" font-size="26" font-weight="900" letter-spacing="6">PATCH NOTES</text>
        <text x="60" y="352" fill="#ffffff" font-family="${fontFamily}" font-size="148" font-weight="900" letter-spacing="-2">${svgText(model.patchVersion)}</text>
        ${summaryLines.map((line, index) => (
          `<text x="66" y="${412 + index * 38}" fill="#f8f9fa" fill-opacity="0.8" font-family="${fontFamily}" font-size="26">${svgText(line)}</text>`
        )).join("")}
        ${dateLabel ? `<text x="66" y="566" fill="${GOLD}" font-family="${fontFamily}" font-size="23" font-weight="700">${svgText(dateLabel)}</text>` : ""}
        <text x="${dateLabel ? 220 : 66}" y="566" fill="#f8f9fa" fill-opacity="0.65" font-family="${fontFamily}" font-size="23" font-weight="700">yoro.gg/patch-notes</text>
      </svg>
    `);
  }

  private async renderPng(
    model: PatchNotesCardModel,
    locale: PatchNoteLocale,
    art: Buffer | undefined,
  ): Promise<Buffer> {
    const sharp = await this.sharpFactoryLoader();
    const overlay = this.overlaySvg(model, locale, Boolean(art));
    if (!art) {
      return sharp(overlay).timeout({ seconds: RENDER_TIMEOUT_SECONDS }).png({ compressionLevel: 9 }).toBuffer();
    }
    return sharp(art, { limitInputPixels: CARD_WIDTH * CARD_HEIGHT * 4 })
      .timeout({ seconds: RENDER_TIMEOUT_SECONDS })
      .composite([{ input: overlay, left: 0, top: 0 }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
}
