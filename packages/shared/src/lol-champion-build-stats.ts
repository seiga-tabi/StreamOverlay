/* 챔피언 글로벌 빌드 통계 — `lol_champion_match_builds`(migration 0027) 누적 표본을
 * 챔피언·포지션·큐·패치 단위로 집계한 읽기 전용 응답 계약입니다.
 *
 * 프로필 주인 개인의 최근 매치로 만드는 "시그니처 빌드"와는 데이터 원천이 다릅니다
 * (이쪽은 전적 조회 시 관측된 모든 참가자의 빌드). 아래 임계값은 서버 집계와
 * 프런트 문구가 같은 숫자를 말하도록 여기서 한 번만 정의합니다. */

export const LOL_CHAMPION_BUILD_STATS_POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type LolChampionBuildStatsPosition = (typeof LOL_CHAMPION_BUILD_STATS_POSITIONS)[number];

/** 솔로랭크(RANKED_SOLO_5x5) — queueId 를 생략하면 이 큐로 집계합니다. */
export const LOL_CHAMPION_BUILD_STATS_DEFAULT_QUEUE_ID = 420;
/** 전체 표본이 이 수 미만이면 `sampleInsufficient` 응답만 돌려줍니다. */
export const LOL_CHAMPION_BUILD_STATS_MIN_TOTAL_GAMES = 30;
/** 조합 표본이 이 수 미만이면 그 조합의 승률을 노출하지 않습니다(채용률만). */
export const LOL_CHAMPION_BUILD_STATS_MIN_GROUP_WIN_RATE_GAMES = 20;
/** 채용률(%)이 이 값 미만인 조합은 "그 외"로 묶습니다. */
export const LOL_CHAMPION_BUILD_STATS_MIN_GROUP_PICK_RATE = 10;
export const LOL_CHAMPION_BUILD_STATS_MAX_RUNE_GROUPS = 5;
export const LOL_CHAMPION_BUILD_STATS_MAX_ITEM_GROUPS = 4;
export const LOL_CHAMPION_BUILD_STATS_MAX_SPELL_GROUPS = 3;

export function isLolChampionBuildStatsPosition(value: unknown): value is LolChampionBuildStatsPosition {
  return typeof value === "string" && (LOL_CHAMPION_BUILD_STATS_POSITIONS as readonly string[]).includes(value);
}

/** Data Dragon 으로 풀어낸 룬/아이템 표시 정보. 풀지 못하면 id 만 옵니다. */
export type LolChampionBuildStatsAsset = {
  id: number;
  nameKo?: string;
  nameJa?: string;
  nameEn?: string;
  iconUrl?: string;
};

export type LolChampionBuildStatsGroup = {
  /** 안정적인 그룹 식별자(같은 조합이면 요청 간에 같은 값). */
  key: string;
  games: number;
  /** 0~100. 분모는 전체 표본(totalGames). */
  pickRate: number;
  /** 0~100. 그룹 표본이 LOL_CHAMPION_BUILD_STATS_MIN_GROUP_WIN_RATE_GAMES 미만이면 undefined. */
  winRate: number | undefined;
};

export type LolChampionRuneBuildGroup = LolChampionBuildStatsGroup & {
  keystonePerkId: number;
  primaryStyleId: number;
  subStyleId: number;
  keystone?: LolChampionBuildStatsAsset;
  primaryStyle?: LolChampionBuildStatsAsset;
  subStyle?: LolChampionBuildStatsAsset;
};

export type LolChampionItemBuildGroup = LolChampionBuildStatsGroup & {
  /** 최종 아이템(장신구 제외) — 최대 6개, 오름차순 정렬, 슬롯 순서 무관. */
  itemIds: number[];
  items?: LolChampionBuildStatsAsset[];
};

export type LolChampionSpellBuildGroup = LolChampionBuildStatsGroup & {
  /** 순서 무관 — 작은 id 가 summonerSpell1 입니다. */
  summonerSpell1: number;
  summonerSpell2: number;
};

/** 같은 챔피언·큐·패치의 포지션 분포(요청한 포지션 포함, 게임 수 내림차순). */
export type LolChampionBuildStatsPositionGroup = {
  teamPosition: string;
  games: number;
  /** 0~100. 표본이 LOL_CHAMPION_BUILD_STATS_MIN_GROUP_WIN_RATE_GAMES 미만이면 undefined. */
  winRate: number | undefined;
};

type LolChampionBuildStatsBase = {
  championId: number;
  teamPosition: LolChampionBuildStatsPosition;
  queueId: number;
  /** "X.Y" — 서버가 Data Dragon 최신 버전에서 결정합니다(요청 파라미터가 아님). */
  patch: string;
  /** 아이콘 URL 조립용(스펠 등) Data Dragon 버전. 확인 실패 시 생략. */
  dataDragonVersion?: string;
  totalGames: number;
  positions: LolChampionBuildStatsPositionGroup[];
  /** ISO — 이 응답을 만든 조회 시각(캐시 시각 아님). */
  updatedAt: string;
};

export type LolChampionBuildStatsInsufficientResponse = LolChampionBuildStatsBase & {
  sampleInsufficient: true;
};

export type LolChampionBuildStatsReadyResponse = LolChampionBuildStatsBase & {
  sampleInsufficient: false;
  /** 0~100 전체 승률. */
  winRate: number;
  /** 상위 5 — 채용률 10% 이상만. 나머지는 otherRuneGames 로 합산. */
  runeGroups: LolChampionRuneBuildGroup[];
  /** 상위 4 — 채용률 10% 이상만. */
  itemGroups: LolChampionItemBuildGroup[];
  /** 상위 3 — 채용률 10% 이상만. */
  spellGroups: LolChampionSpellBuildGroup[];
  otherRuneGames: number;
  otherItemGames: number;
  otherSpellGames: number;
};

export type LolChampionBuildStatsResponse =
  | LolChampionBuildStatsInsufficientResponse
  | LolChampionBuildStatsReadyResponse;
