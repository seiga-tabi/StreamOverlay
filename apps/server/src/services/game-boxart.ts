/* 홈 카테고리 타일용 트위치 박스아트(안 B — docs/handoffs/2026-08-22-home-category-boxart-handoff.md).
 *
 * helix/games 의 box_art_url 템플릿({width}x{height})을 타일 원본 비율 285x380(3:4)으로
 * 치환해 넘깁니다. 게임 id·박스아트는 사실상 불변이라 성공은 길게 캐시하고,
 * 실패는 짧게 캐시해 Twitch 장애가 홈 트래픽만큼 재시도로 증폭되지 않게 합니다.
 *
 * 트위치는 조회 실패 대신 「박스아트 없음」 회색 패드 이미지를 주는 경우가 있어
 * (URL 에 404_boxart 가 들어감 — 실측), 그 패턴은 null 로 정규화합니다.
 * null 은 프런트가 자체 키아트·마크 타일로 폴백하라는 뜻입니다.
 */

export type HomeGameBoxartKey = "lol" | "palworld" | "valorant" | "minecraft";

export type HomeGameBoxartEntry = {
  key: HomeGameBoxartKey;
  boxArtUrl: string | null;
};

type GamesClient = {
  getGamesByNames(names: readonly string[]): Promise<unknown>;
};

/* Twitch 카테고리 정식 명칭 — 이름 조회는 대소문자 구분 없이 정확 일치만 됩니다. */
const GAME_NAMES: Record<HomeGameBoxartKey, string> = {
  lol: "League of Legends",
  palworld: "Palworld",
  valorant: "VALORANT",
  minecraft: "Minecraft"
};

const GAME_KEYS = Object.keys(GAME_NAMES) as HomeGameBoxartKey[];

/* 타일 원본 규격(3:4) — 프런트 타일 규격과 같은 비율이라 크롭이 없습니다. */
const BOX_ART_SIZE = "285x380";

const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;

function normalizeBoxArtUrl(template: unknown): string | null {
  if (typeof template !== "string" || template.length === 0) return null;
  /* 패드 이미지(박스아트 없음)는 그림이 아니라 안내판 — 프런트 폴백이 낫습니다. */
  if (template.includes("404_boxart")) return null;
  const resolved = template.replace("{width}x{height}", BOX_ART_SIZE);
  try {
    const parsed = new URL(resolved);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export class GameBoxartService {
  private cache: { entries: HomeGameBoxartEntry[]; expiresAt: number } | undefined;
  private pending: Promise<HomeGameBoxartEntry[]> | undefined;

  constructor(
    private readonly twitch: GamesClient | undefined,
    private readonly now: () => number = () => Date.now()
  ) {}

  async getBoxart(): Promise<HomeGameBoxartEntry[]> {
    if (this.cache && this.cache.expiresAt > this.now()) return this.cache.entries;
    /* 홈 트래픽이 몰려도 Twitch 호출은 한 번 — 진행 중 조회에 합류합니다. */
    this.pending ??= this.fetchEntries().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async fetchEntries(): Promise<HomeGameBoxartEntry[]> {
    const empty = GAME_KEYS.map((key): HomeGameBoxartEntry => ({ key, boxArtUrl: null }));
    if (!this.twitch) {
      this.cache = { entries: empty, expiresAt: this.now() + FAILURE_TTL_MS };
      return empty;
    }

    let byName = new Map<string, string | null>();
    try {
      const body = await this.twitch.getGamesByNames(GAME_KEYS.map((key) => GAME_NAMES[key])) as {
        data?: Array<{ name?: unknown; box_art_url?: unknown }>;
      };
      for (const game of Array.isArray(body?.data) ? body.data : []) {
        if (typeof game?.name !== "string") continue;
        byName.set(game.name.toLowerCase(), normalizeBoxArtUrl(game.box_art_url));
      }
    } catch {
      byName = new Map();
    }

    const entries = GAME_KEYS.map((key): HomeGameBoxartEntry => ({
      key,
      boxArtUrl: byName.get(GAME_NAMES[key].toLowerCase()) ?? null
    }));
    const anyHit = entries.some((entry) => entry.boxArtUrl !== null);
    this.cache = { entries, expiresAt: this.now() + (anyHit ? SUCCESS_TTL_MS : FAILURE_TTL_MS) };
    return entries;
  }
}
