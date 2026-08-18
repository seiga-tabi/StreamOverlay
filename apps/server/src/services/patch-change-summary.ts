/* 패치 변경 요약 — 목업 docs/mockups/lol-patch-summary-share.html v1.2 §④ 계약.
 *
 * Riot 패치 본문은 수집하지 않습니다. 제품이 "제목·요약·링크만 제공"을 공개
 * 고지(patchNotesAttribution)로 선언했고, 여기 담기는 것은 전부 Data Dragon
 * 공개 데이터에서 계산한 사실입니다.
 *
 * 비교 경계는 날짜로 추측하지 않습니다. 패치 노트가 dataDragonVersion 을 직접
 * 주므로 "해당 패치 노트와 직전 패치 노트의 버전 쌍"이 곧 그 패치의 구간입니다
 * (26.16 → 16.16.1, 26.15 → 16.15.1).
 *
 * champion.json 은 기본 스탯만 담습니다. 스킬 계수·쿨타임 변경은 알 수 없으므로
 * 응답이 skillChangesIncluded: false 로 그 한계를 스스로 밝힙니다 — 화면이 없는
 * 정보를 지어내지 않게 하는 장치입니다.
 */

import type { PatchNote, PatchNoteLocale } from "@streamops/shared";

/** 같은 변경을 받은 챔피언이 이 수 이상이면 시스템 변경으로 묶습니다. */
export const PATCH_SYSTEM_CHANGE_MIN_CHAMPIONS = 5;

/* 응답 크기 상한. 실측(16.15.1 → 16.16.1)은 챔피언 4명·아이템 1건이지만
   직전 패치(16.14 → 16.15)는 154건이었습니다. 편차가 크므로 상한을 둡니다. */
const CHAMPION_CHANGE_LIMIT = 40;
const ITEM_CHANGE_LIMIT = 40;

export type PatchStatChange = {
  stat: string;
  from: number;
  to: number;
};

export type PatchSystemChange = PatchStatChange & { championCount: number };

export type PatchChampionChange = {
  championId: number;
  name: string;
  iconUrl?: string;
  direction: "buff" | "nerf" | "adjust";
  changes: PatchStatChange[];
};

export type PatchItemChange = {
  itemId: number;
  name: string;
  iconUrl?: string;
  kind: "price" | "new" | "removed";
  from?: number;
  to?: number;
};

export type PatchChangeSummary = {
  patchVersion: string;
  /** [이전, 현재] Data Dragon 버전. 무엇과 무엇을 비교했는지 화면이 밝힙니다. */
  comparedVersions: [string, string];
  systemChanges: PatchSystemChange[];
  championChanges: PatchChampionChange[];
  itemChanges: PatchItemChange[];
  /** 항상 false. champion.json 에 스킬 수치가 없다는 사실을 응답이 밝힙니다. */
  skillChangesIncluded: boolean;
};

/**
 * 스탯이 오르면 강화인지 약화인지.
 *
 * 사거리·이동 속도처럼 "높을수록 좋다"가 분명한 것만 담습니다. 여기 없는 키는
 * 방향을 판정하지 않고 adjust 로 남깁니다 — 모르는 것을 buff 라고 단정하면
 * 화면이 틀린 말을 하게 됩니다.
 */
const HIGHER_IS_BETTER: Readonly<Record<string, true>> = {
  hp: true,
  hpperlevel: true,
  mp: true,
  mpperlevel: true,
  movespeed: true,
  armor: true,
  armorperlevel: true,
  spellblock: true,
  spellblockperlevel: true,
  attackrange: true,
  hpregen: true,
  hpregenperlevel: true,
  mpregen: true,
  mpregenperlevel: true,
  crit: true,
  critperlevel: true,
  attackdamage: true,
  attackdamageperlevel: true,
  attackspeed: true,
  attackspeedperlevel: true
};

/** 스탯 하나의 방향. 방향을 아는 키가 아니면 undefined 입니다. */
function statDirection(stat: string, from: number, to: number): "buff" | "nerf" | undefined {
  if (!HIGHER_IS_BETTER[stat] || from === to) return undefined;
  return to > from ? "buff" : "nerf";
}

/** 한 챔피언의 변경 묶음이 강화인지 약화인지. 상충하면 adjust 입니다. */
export function championChangeDirection(
  changes: readonly PatchStatChange[]
): "buff" | "nerf" | "adjust" {
  let buffs = 0;
  let nerfs = 0;
  for (const change of changes) {
    const direction = statDirection(change.stat, change.from, change.to);
    if (direction === "buff") buffs += 1;
    else if (direction === "nerf") nerfs += 1;
  }
  if (buffs > 0 && nerfs === 0) return "buff";
  if (nerfs > 0 && buffs === 0) return "nerf";
  return "adjust";
}

/**
 * 패치 번호로 비교할 Data Dragon 버전 쌍을 찾습니다.
 *
 * 노트 목록에서 해당 패치와 **직전 패치**의 dataDragonVersion 을 씁니다. 둘 중
 * 하나라도 없으면 비교 자체가 성립하지 않으므로 undefined 입니다(라우트는 404).
 * 목록 순서를 믿지 않고 patchVersion 을 숫자로 정렬해 직전 노트를 고릅니다.
 */
export function comparedVersionsForPatch(
  notes: readonly PatchNote[],
  patchVersion: string
): [string, string] | undefined {
  const ordered = notes
    .filter((note): note is PatchNote & { patchVersion: string } => Boolean(note.patchVersion))
    .map((note) => ({ note, order: patchVersionOrder(note.patchVersion) }))
    .filter((entry): entry is { note: PatchNote & { patchVersion: string }; order: number } => (
      entry.order !== undefined
    ))
    .sort((left, right) => right.order - left.order);

  const index = ordered.findIndex((entry) => entry.note.patchVersion === patchVersion);
  if (index < 0) return undefined;
  const current = ordered[index]?.note.dataDragonVersion;
  /* 같은 패치 번호가 두 번 실린 경우를 대비해 "번호가 더 낮은 첫 노트"를 찾습니다. */
  const previous = ordered.slice(index + 1)
    .find((entry) => entry.note.patchVersion !== patchVersion)?.note.dataDragonVersion;
  if (!current || !previous) return undefined;
  return [previous, current];
}

/** "26.16" → 26016. 형식을 벗어나면 undefined. */
function patchVersionOrder(patchVersion: string): number | undefined {
  const match = /^(\d{1,3})\.(\d{1,3})$/u.exec(patchVersion);
  if (!match?.[1] || !match[2]) return undefined;
  return Number(match[1]) * 1_000 + Number(match[2]);
}

export type PatchChangeSummaryInput = {
  patchVersion: string;
  comparedVersions: [string, string];
  previousChampionStats: ReadonlyMap<number, Readonly<Record<string, number>>>;
  currentChampionStats: ReadonlyMap<number, Readonly<Record<string, number>>>;
  previousItemGold: ReadonlyMap<number, number>;
  currentItemGold: ReadonlyMap<number, number>;
  /** 현재 버전 기준 표시 이름·아이콘. 이름이 없는 항목은 요약에서 뺍니다. */
  championNames: ReadonlyMap<number, { name: string; iconUrl?: string }>;
  itemNames: ReadonlyMap<number, { name: string; iconUrl?: string }>;
};

/**
 * 두 버전의 공개 데이터를 비교해 요약을 만듭니다. 네트워크를 타지 않는 순수
 * 함수라 픽스처만으로 검증할 수 있습니다.
 *
 * 변경이 하나도 없으면 undefined — 빈 패널을 만들지 않습니다.
 */
export function buildPatchChangeSummary(input: PatchChangeSummaryInput): PatchChangeSummary | undefined {
  const perChampion = new Map<number, PatchStatChange[]>();
  for (const [championId, currentStats] of input.currentChampionStats) {
    const previousStats = input.previousChampionStats.get(championId);
    /* 신규 챔피언은 "변경"이 아닙니다 — 비교 대상이 없습니다. */
    if (!previousStats) continue;
    const changes: PatchStatChange[] = [];
    for (const [stat, to] of Object.entries(currentStats)) {
      const from = previousStats[stat];
      if (typeof from !== "number" || from === to) continue;
      changes.push({ stat, from, to });
    }
    if (changes.length > 0) perChampion.set(championId, changes);
  }

  /* 같은 (stat·from·to)를 받은 챔피언 수를 세어 시스템 변경을 가려냅니다. */
  const groupCounts = new Map<string, number>();
  for (const changes of perChampion.values()) {
    for (const change of changes) {
      const key = statChangeKey(change);
      groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    }
  }

  const systemChanges: PatchSystemChange[] = [];
  const systemKeys = new Set<string>();
  for (const changes of perChampion.values()) {
    for (const change of changes) {
      const key = statChangeKey(change);
      const championCount = groupCounts.get(key) ?? 0;
      if (championCount < PATCH_SYSTEM_CHANGE_MIN_CHAMPIONS || systemKeys.has(key)) continue;
      systemKeys.add(key);
      systemChanges.push({ ...change, championCount });
    }
  }
  systemChanges.sort((left, right) => right.championCount - left.championCount);

  const championChanges: PatchChampionChange[] = [];
  for (const [championId, changes] of perChampion) {
    /* 시스템 변경으로 묶인 항목은 개별 나열에서 뺍니다(27명을 한 명씩 적지 않습니다). */
    const individual = changes.filter((change) => !systemKeys.has(statChangeKey(change)));
    if (individual.length === 0) continue;
    const named = input.championNames.get(championId);
    /* 이름을 모르면 화면에 "미상"을 띄우게 됩니다 — 그런 항목은 싣지 않습니다. */
    if (!named?.name) continue;
    championChanges.push({
      championId,
      name: named.name,
      ...(named.iconUrl ? { iconUrl: named.iconUrl } : {}),
      direction: championChangeDirection(individual),
      changes: individual
    });
  }
  championChanges.sort((left, right) => right.changes.length - left.changes.length
    || left.championId - right.championId);

  const itemChanges: PatchItemChange[] = [];
  for (const [itemId, to] of input.currentItemGold) {
    const from = input.previousItemGold.get(itemId);
    const named = input.itemNames.get(itemId);
    if (!named?.name) continue;
    if (from === undefined) {
      itemChanges.push({ itemId, name: named.name, ...(named.iconUrl ? { iconUrl: named.iconUrl } : {}), kind: "new" });
      continue;
    }
    if (from === to) continue;
    itemChanges.push({
      itemId,
      name: named.name,
      ...(named.iconUrl ? { iconUrl: named.iconUrl } : {}),
      kind: "price",
      from,
      to
    });
  }
  for (const [itemId] of input.previousItemGold) {
    if (input.currentItemGold.has(itemId)) continue;
    const named = input.itemNames.get(itemId);
    /* 삭제된 아이템은 현재 버전에 이름이 없는 게 정상이라 id 만으로는 못 씁니다. */
    if (!named?.name) continue;
    itemChanges.push({ itemId, name: named.name, ...(named.iconUrl ? { iconUrl: named.iconUrl } : {}), kind: "removed" });
  }
  itemChanges.sort((left, right) => left.itemId - right.itemId);

  if (systemChanges.length === 0 && championChanges.length === 0 && itemChanges.length === 0) return undefined;

  return {
    patchVersion: input.patchVersion,
    comparedVersions: input.comparedVersions,
    systemChanges,
    championChanges: championChanges.slice(0, CHAMPION_CHANGE_LIMIT),
    itemChanges: itemChanges.slice(0, ITEM_CHANGE_LIMIT),
    /* champion.json 에는 스킬 수치가 없습니다. 이 값은 계산 결과가 아니라 한계 고지입니다. */
    skillChangesIncluded: false
  };
}

function statChangeKey(change: PatchStatChange): string {
  return `${change.stat}|${change.from}|${change.to}`;
}

export type PatchChangeSummaryDeps = {
  /** 요청 locale 의 노트 목록. dataDragonVersion 이 여기서 나옵니다. */
  notesFor(locale: PatchNoteLocale): Promise<readonly PatchNote[]>;
  championStats(version: string): Promise<ReadonlyMap<number, Readonly<Record<string, number>>>>;
  itemGold(version: string): Promise<ReadonlyMap<number, number>>;
  championNames(version: string, locale: PatchNoteLocale): Promise<ReadonlyMap<number, { name: string; iconUrl?: string }>>;
  itemNames(version: string, locale: PatchNoteLocale): Promise<ReadonlyMap<number, { name: string; iconUrl?: string }>>;
  now?: () => number;
};

/* 패치가 나오기 전에는 결과가 바뀌지 않습니다. 캐시 키는 패치 번호와 언어이고,
   TTL 은 노트 수집 주기(6시간)에 맞춥니다. champion.json 은 버전당 약 210KB 라
   매 요청 다운로드는 금지입니다. */
const SUMMARY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SUMMARY_CACHE_MAX = 32;

export class PatchChangeSummaryService {
  private readonly cache = new Map<string, { summary?: PatchChangeSummary; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<PatchChangeSummary | undefined>>();
  private readonly now: () => number;

  constructor(private readonly deps: PatchChangeSummaryDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** 요약이 성립하지 않으면 undefined 입니다(라우트가 404 로 옮깁니다). */
  async summaryFor(patchVersion: string, locale: PatchNoteLocale): Promise<PatchChangeSummary | undefined> {
    const key = `${locale}:${patchVersion}`;
    const cached = this.cache.get(key);
    /* "요약 없음"도 캐시합니다 — 없다는 사실을 확인하려고 매번 Data Dragon 을
       두 버전씩 내려받을 이유가 없습니다. */
    if (cached && cached.expiresAt > this.now()) return cached.summary;
    if (cached) this.cache.delete(key);
    const running = this.inFlight.get(key);
    if (running) return running;

    const request = (async () => {
      const notes = await this.deps.notesFor(locale);
      const comparedVersions = comparedVersionsForPatch(notes, patchVersion);
      if (!comparedVersions) return undefined;
      const [previousVersion, currentVersion] = comparedVersions;
      const [previousChampionStats, currentChampionStats, previousItemGold, currentItemGold, championNames, itemNames] =
        await Promise.all([
          this.deps.championStats(previousVersion),
          this.deps.championStats(currentVersion),
          this.deps.itemGold(previousVersion),
          this.deps.itemGold(currentVersion),
          this.deps.championNames(currentVersion, locale),
          this.deps.itemNames(currentVersion, locale)
        ]);
      return buildPatchChangeSummary({
        patchVersion,
        comparedVersions,
        previousChampionStats,
        currentChampionStats,
        previousItemGold,
        currentItemGold,
        championNames,
        itemNames
      });
    })().then((summary) => {
      this.cache.set(key, { summary, expiresAt: this.now() + SUMMARY_CACHE_TTL_MS });
      if (this.cache.size > SUMMARY_CACHE_MAX) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
      return summary;
    }).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, request);
    return request;
  }
}
