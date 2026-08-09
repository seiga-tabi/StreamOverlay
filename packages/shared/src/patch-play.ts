/* 패치별 내 전적.
 *
 * 경기의 `info.gameVersion` 은 Data Dragon 과 같은 major.minor 를 씁니다.
 * 실측(2026-08-09): "16.12.788.4269" · "16.7.760.9485" · "16.5.752.7101".
 * 같은 패치 안에서도 build 번호는 여러 개라 major.minor 로만 묶습니다.
 *
 * 패치 노트의 `dataDragonVersion`("16.15.1")도 앞 두 자리가 같으므로
 * 이 값이 노트와 전적을 잇는 열쇠입니다. 날짜로 추측하지 않습니다.
 */

/** 한 번에 표본으로 삼는 최근 경기 수. Riot 호출 비용의 상한이기도 합니다. */
export const PATCH_PLAY_SAMPLE_LIMIT = 20;
/** 표본이 20경기이므로 패치가 이보다 많이 나올 수는 없습니다. */
export const PATCH_PLAY_MAX_PATCHES = PATCH_PLAY_SAMPLE_LIMIT;

export type PatchPlayRecord = Readonly<{
  /** Data Dragon 방식 major.minor. 예: "16.15". */
  patchKey: string;
  games: number;
  wins: number;
  /** 0~100. 소수 한 자리까지 둡니다. */
  winRate: number;
}>;

export type PatchPlaySummary = Readonly<{
  schemaVersion: 1;
  /** 조회한 Riot ID. 요청과 응답이 어긋나면 화면이 남의 승률을 보여 주게 됩니다. */
  gameName: string;
  tagLine: string;
  lolPlatform: string;
  /** 실제로 집계에 들어간 경기 수. "최근 N경기 기준"을 화면이 말할 수 있어야 합니다. */
  sampledMatches: number;
  fetchedAt: string;
  patches: readonly PatchPlayRecord[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** "16.12.788.4269" → "16.12". 형식을 벗어나면 undefined 입니다. */
export function patchKeyFromGameVersion(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{1,3})\.(\d{1,3})(?:\.|$)/u.exec(value.trim());
  return match ? `${match[1]}.${match[2]}` : undefined;
}

/** "16.15.1" → "16.15". 패치 노트의 dataDragonVersion 을 같은 열쇠로 바꿉니다. */
export function patchKeyFromDataDragonVersion(value: unknown): string | undefined {
  return patchKeyFromGameVersion(value);
}

/** 표본에서 패치별 승패를 셉니다. 승패를 알 수 없는 경기는 표본에서 뺍니다. */
export function patchPlayRecords(
  matches: readonly { gameVersion?: string; won?: boolean }[]
): PatchPlayRecord[] {
  const buckets = new Map<string, { games: number; wins: number }>();
  for (const match of matches) {
    const patchKey = patchKeyFromGameVersion(match.gameVersion);
    if (!patchKey || typeof match.won !== "boolean") continue;
    const bucket = buckets.get(patchKey) ?? { games: 0, wins: 0 };
    bucket.games += 1;
    if (match.won) bucket.wins += 1;
    buckets.set(patchKey, bucket);
  }

  return [...buckets.entries()]
    .map(([patchKey, bucket]) => Object.freeze({
      patchKey,
      games: bucket.games,
      wins: bucket.wins,
      winRate: Math.round((bucket.wins / bucket.games) * 1000) / 10
    }))
    /* 최신 패치가 먼저 오도록 major.minor 를 숫자로 비교합니다. */
    .sort((a, b) => {
      const [aMajor = 0, aMinor = 0] = a.patchKey.split(".").map(Number);
      const [bMajor = 0, bMinor = 0] = b.patchKey.split(".").map(Number);
      return bMajor - aMajor || bMinor - aMinor;
    })
    .slice(0, PATCH_PLAY_MAX_PATCHES);
}

function parsePatchPlayRecord(value: unknown): PatchPlayRecord | undefined {
  if (!isRecord(value)) return undefined;
  const { patchKey, games, wins, winRate } = value;
  if (typeof patchKey !== "string" || !/^\d{1,3}\.\d{1,3}$/u.test(patchKey)) return undefined;
  if (!Number.isInteger(games) || !Number.isInteger(wins)) return undefined;
  const gameCount = games as number;
  const winCount = wins as number;
  /* 이긴 판이 전체보다 많을 수는 없습니다. 어긋나면 통째로 버립니다. */
  if (gameCount < 1 || gameCount > PATCH_PLAY_SAMPLE_LIMIT) return undefined;
  if (winCount < 0 || winCount > gameCount) return undefined;
  if (typeof winRate !== "number" || !Number.isFinite(winRate) || winRate < 0 || winRate > 100) return undefined;
  if (Math.abs(winRate - Math.round((winCount / gameCount) * 1000) / 10) > 0.05) return undefined;
  return Object.freeze({ patchKey, games: gameCount, wins: winCount, winRate });
}

export function parsePatchPlaySummary(value: unknown): PatchPlaySummary | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value).sort().join(",");
  if (keys !== "fetchedAt,gameName,lolPlatform,patches,sampledMatches,schemaVersion,tagLine") return undefined;
  if (
    value.schemaVersion !== 1
    || typeof value.gameName !== "string"
    || typeof value.tagLine !== "string"
    || typeof value.lolPlatform !== "string"
    || !value.gameName
    || !value.tagLine
    || !value.lolPlatform
    || typeof value.fetchedAt !== "string"
    || !Number.isFinite(Date.parse(value.fetchedAt))
    || !Number.isInteger(value.sampledMatches)
    || (value.sampledMatches as number) < 0
    || (value.sampledMatches as number) > PATCH_PLAY_SAMPLE_LIMIT
    || !Array.isArray(value.patches)
    || value.patches.length > PATCH_PLAY_MAX_PATCHES
  ) return undefined;

  const patches: PatchPlayRecord[] = [];
  const seen = new Set<string>();
  let totalGames = 0;
  for (const raw of value.patches) {
    const record = parsePatchPlayRecord(raw);
    if (!record || seen.has(record.patchKey)) return undefined;
    seen.add(record.patchKey);
    totalGames += record.games;
    patches.push(record);
  }
  /* 패치별 합계가 표본보다 클 수는 없습니다. */
  if (totalGames > (value.sampledMatches as number)) return undefined;

  return Object.freeze({
    schemaVersion: 1,
    gameName: value.gameName,
    tagLine: value.tagLine,
    lolPlatform: value.lolPlatform,
    sampledMatches: value.sampledMatches as number,
    fetchedAt: new Date(value.fetchedAt).toISOString(),
    patches: Object.freeze(patches)
  });
}
