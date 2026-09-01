import type { GameBoxartService, HomeGameBoxartEntry } from "./game-boxart.js";

export type GameSocialCardKey = "palworld" | "minecraft" | "valorant" | "lol" | "bot";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const RENDER_TIMEOUT_SECONDS = 5;
const FETCH_TIMEOUT_MS = 2_000;
const MAX_BOXART_BYTES = 2 * 1024 * 1024;
const MAX_BOXART_DIMENSION = 4096;
const MAX_SOURCE_IMAGE_CACHE = 4;
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;

type SharpFactory = typeof import("sharp")["default"];
type BoxartProvider = Pick<GameBoxartService, "getBoxart">;

type GameTheme = {
  badge: string;
  gradient: readonly [string, string, string];
  ink: string;
  labelLines: readonly string[];
};

const GAME_THEMES: Readonly<Record<GameSocialCardKey, GameTheme>> = Object.freeze({
  palworld: {
    badge: "#3F6F92",
    gradient: ["#CFE8F5", "#8FC4DE", "#4F7A94"],
    ink: "#131B2E",
    labelLines: ["PALWORLD"],
  },
  minecraft: {
    badge: "#47763B",
    gradient: ["#D7E8C7", "#6FA457", "#263D26"],
    ink: "#1E2D1D",
    labelLines: ["MINECRAFT"],
  },
  valorant: {
    badge: "#B43F49",
    gradient: ["#F5D2CF", "#DB5F61", "#4B1720"],
    ink: "#321419",
    labelLines: ["VALORANT"],
  },
  lol: {
    badge: "#4A2F78",
    gradient: ["#CDB9E8", "#7A5AA8", "#241733"],
    ink: "#241333",
    labelLines: ["LEAGUE OF", "LEGENDS"],
  },
  bot: {
    badge: "#555D6C",
    gradient: ["#D9DCE3", "#7C8494", "#252A35"],
    ink: "#252A35",
    labelLines: ["YORO BOT"],
  },
});

let sharpFactoryPromise: Promise<SharpFactory> | undefined;

async function loadSharpFactory(): Promise<SharpFactory> {
  sharpFactoryPromise ??= import("sharp").then((module) => module.default);
  return sharpFactoryPromise;
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

function safeTwitchBoxartUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 500 || /[%\\\u0000-\u001f\u007f]/u.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "static-cdn.jtvnw.net") return undefined;
    if (url.port || url.username || url.password || url.search || url.hash) return undefined;
    if (!/^\/ttv-boxart\/[A-Za-z0-9_-]{1,200}-[0-9]{2,4}x[0-9]{2,4}\.(?:jpe?g|png)$/iu.test(url.pathname)) {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}

function isSafePng(body: Buffer): boolean {
  if (body.length < 24 || !body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return false;
  }
  const width = body.readUInt32BE(16);
  const height = body.readUInt32BE(20);
  return width > 0 && height > 0 && width <= MAX_BOXART_DIMENSION && height <= MAX_BOXART_DIMENSION;
}

function isStartOfFrame(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}

function isSafeJpeg(body: Buffer): boolean {
  if (body.length < 11 || body[0] !== 0xff || body[1] !== 0xd8) return false;
  let offset = 2;
  while (offset + 3 < body.length) {
    if (body[offset] !== 0xff) return false;
    while (offset < body.length && body[offset] === 0xff) offset += 1;
    const marker = body[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= body.length) return false;
    const segmentLength = body.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > body.length) return false;
    if (isStartOfFrame(marker)) {
      if (segmentLength < 7) return false;
      const height = body.readUInt16BE(offset + 3);
      const width = body.readUInt16BE(offset + 5);
      return width > 0 && height > 0 && width <= MAX_BOXART_DIMENSION && height <= MAX_BOXART_DIMENSION;
    }
    offset += segmentLength;
  }
  return false;
}

function gradientSvg(theme: GameTheme): Buffer {
  return Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gameGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${theme.gradient[0]}"/>
          <stop offset="0.45" stop-color="${theme.gradient[1]}"/>
          <stop offset="1" stop-color="${theme.gradient[2]}"/>
        </linearGradient>
      </defs>
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#gameGradient)"/>
    </svg>
  `);
}

function artTintSvg(theme: GameTheme): Buffer {
  return Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="artTint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${theme.gradient[0]}" stop-opacity="0.42"/>
          <stop offset="0.48" stop-color="${theme.gradient[1]}" stop-opacity="0.26"/>
          <stop offset="1" stop-color="${theme.gradient[2]}" stop-opacity="0.48"/>
        </linearGradient>
      </defs>
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#artTint)"/>
    </svg>
  `);
}

function badgeMarkSvg(key: GameSocialCardKey): string {
  if (key === "minecraft") {
    return `
      <g transform="translate(95 76)">
        <rect width="38" height="38" rx="4" fill="#FFFFFF"/>
        <rect y="13" width="38" height="25" fill="#FFFFFF" fill-opacity="0.72"/>
        <rect x="7" y="22" width="7" height="7" fill="#47763B"/>
        <rect x="24" y="22" width="7" height="7" fill="#47763B"/>
        <rect x="14" y="29" width="10" height="6" fill="#47763B"/>
      </g>
    `;
  }
  if (key === "valorant") {
    return `<path d="M95 78 H106 L114 94 L122 78 H133 L117 114 H111 Z" fill="#FFFFFF"/>`;
  }
  if (key === "lol") {
    return `
      <g transform="translate(95 94)" fill="none" stroke="#FFFFFF" stroke-width="5">
        <circle cx="19" cy="19" r="16"/>
        <path d="M14 8 V28 H29" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    `;
  }
  if (key === "bot") {
    return `
      <g transform="translate(95 76)" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round">
        <path d="M19 1 V8 M13 1 H25"/>
        <rect x="2" y="8" width="34" height="27" rx="7"/>
        <circle cx="12" cy="21" r="2" fill="#FFFFFF" stroke="none"/>
        <circle cx="26" cy="21" r="2" fill="#FFFFFF" stroke="none"/>
        <path d="M12 29 H26"/>
      </g>
    `;
  }
  return `
    <g transform="translate(95 76)" fill="#FFFFFF">
      <circle cx="19" cy="21" r="9"/>
      <circle cx="7" cy="11" r="5"/>
      <circle cx="17" cy="6" r="5"/>
      <circle cx="28" cy="8" r="5"/>
      <circle cx="34" cy="18" r="5"/>
    </g>
  `;
}

function badgeTextSvg(theme: GameTheme): string {
  return theme.labelLines.map((line, index) => `
    <text x="114" y="${theme.labelLines.length === 1 ? 44 : 30 + (index * 21)}" text-anchor="middle"
      font-family="Noto Sans CJK KR, Noto Sans CJK JP, sans-serif" font-size="16" font-weight="900"
      letter-spacing="0.3" fill="#FFFFFF">${line}</text>
  `).join("");
}

function overlaySvg(key: GameSocialCardKey): Buffer {
  const theme = GAME_THEMES[key];
  const badgeHeight = key === "lol" ? 198 : 174;
  return Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <!-- v5 objectBoundingBox 붓 경로를 1200×630 좌표로 비례 변환했습니다. -->
      <path d="M0 0 L768 0 C744 37.8 804 63 768 100.8 C840 138.6 756 170.1 804 207.9
        C732 245.7 828 283.5 744 321.3 C816 365.4 720 403.2 780 441
        C708 478.8 768 516.6 684 554.4 C744 585.9 648 611.1 600 630 L0 630 Z" fill="#F3EFE6"/>
      <g fill="#F3EFE6">
        <circle cx="633" cy="148" r="9"/>
        <circle cx="666" cy="245" r="6"/>
        <circle cx="607" cy="372" r="7"/>
        <circle cx="677" cy="471" r="5"/>
        <circle cx="562" cy="552" r="10"/>
      </g>
      <!-- v5 badge polygon(0 0,100% 0,100% 80%,50% 100%,0 80%). -->
      <path d="M30 0 H198 V${badgeHeight * 0.8} L114 ${badgeHeight} L30 ${badgeHeight * 0.8} Z" fill="${theme.badge}"/>
      ${badgeTextSvg(theme)}
      ${badgeMarkSvg(key)}
      <text x="53" y="273" font-family="'Yuji Boku', 'Yuji Syuku', serif" font-size="35" font-weight="400"
        letter-spacing="0.35" fill="${theme.ink}">YORO.GG</text>
      <text x="49" y="393" font-family="'Yuji Boku', 'Yuji Syuku', serif" font-size="129" font-weight="400"
        letter-spacing="-1.29" fill="${theme.ink}" transform="rotate(-1.6 305 350)">YORO.GG</text>
    </svg>
  `);
}

export class GameSocialCardRenderer {
  private readonly cards = new Map<GameSocialCardKey, { body: Buffer; expiresAt: number }>();
  private readonly inFlight = new Map<GameSocialCardKey, Promise<Buffer>>();
  private readonly sourceImages = new Map<string, Buffer>();

  constructor(
    private readonly gameBoxart: BoxartProvider | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sharpFactoryLoader: () => Promise<SharpFactory> = loadSharpFactory,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async render(key: GameSocialCardKey): Promise<Buffer> {
    const cached = this.cards.get(key);
    if (cached && cached.expiresAt > this.now()) return cached.body;
    const running = this.inFlight.get(key);
    if (running) return running;
    const task = this.renderFresh(key).then(({ body, hasArt }) => {
      const ttlMs = key === "bot" || hasArt ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
      this.cards.set(key, { body, expiresAt: this.now() + ttlMs });
      return body;
    });
    this.inFlight.set(key, task);
    try {
      return await task;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async renderFresh(key: GameSocialCardKey): Promise<{ body: Buffer; hasArt: boolean }> {
    const sharp = await this.sharpFactoryLoader();
    const source = key === "bot" ? undefined : await this.loadGameBoxart(key);
    const overlays: Array<{ input: Buffer; blend?: "over" }> = [];
    let hasArt = false;
    if (source) {
      try {
        const art = await sharp(source, { limitInputPixels: MAX_BOXART_DIMENSION ** 2, failOn: "error" })
          .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: "centre" })
          .blur(22)
          .modulate({ brightness: 0.82, saturation: 0.78 })
          .timeout({ seconds: RENDER_TIMEOUT_SECONDS })
          .png({ compressionLevel: 9 })
          .toBuffer();
        overlays.push({ input: art, blend: "over" }, { input: artTintSvg(GAME_THEMES[key]), blend: "over" });
        hasArt = true;
      } catch {
        // 손상된 원격 박스아트는 고정 그라디언트로 열어 둡니다.
      }
    }
    overlays.push({ input: overlaySvg(key), blend: "over" });
    const body = await sharp(gradientSvg(GAME_THEMES[key]))
      .composite(overlays)
      .timeout({ seconds: RENDER_TIMEOUT_SECONDS })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { body, hasArt };
  }

  private async loadGameBoxart(key: Exclude<GameSocialCardKey, "bot">): Promise<Buffer | undefined> {
    if (!this.gameBoxart) return undefined;
    try {
      const entries = await this.gameBoxart.getBoxart();
      const url = safeTwitchBoxartUrl(
        entries.find((entry: HomeGameBoxartEntry) => entry.key === key)?.boxArtUrl,
      );
      return url ? await this.loadSourceImage(url) : undefined;
    } catch {
      return undefined;
    }
  }

  private async loadSourceImage(url: string): Promise<Buffer | undefined> {
    const cached = this.sourceImages.get(url);
    if (cached) return touchCache(this.sourceImages, url, cached, MAX_SOURCE_IMAGE_CACHE);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (!response.ok || (contentType !== "image/png" && contentType !== "image/jpeg")) return undefined;
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_BOXART_BYTES) return undefined;
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0 || body.length > MAX_BOXART_BYTES) return undefined;
      const safeFormat = contentType === "image/png" ? isSafePng(body) : isSafeJpeg(body);
      if (!safeFormat) return undefined;
      return touchCache(this.sourceImages, url, body, MAX_SOURCE_IMAGE_CACHE);
    } catch {
      return undefined;
    }
  }
}
