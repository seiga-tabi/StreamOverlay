/* 패치 변경 요약 — 목업 docs/mockups/lol-patch-summary-share.html v1.2 §④ 계약.
 *
 * 서버가 인접 두 패치 노트의 dataDragonVersion 쌍으로 Data Dragon 을 비교해 만든
 * 결과입니다. Riot 패치 본문을 복제하지 않고 공개 데이터에서 계산한 사실이며,
 * champion.json 은 기본 스탯만 담으므로 스킬 변경은 포함되지 않습니다
 * (응답이 skillChangesIncluded 로 그 사실을 스스로 밝힙니다).
 *
 * 타입과 파서를 shared 가 아니라 여기에 둔 이유: 이 계약은 아직 서버에 없습니다
 * (prompts/codex-lol-patch-summary-ko.txt 로 넘긴 상태). 프런트가 먼저 화면을 갖추고,
 * 응답이 없으면 패널을 통째로 숨기는 fail-soft 로 배포 순서를 분리합니다.
 * 서버가 계약을 구현하면 shared 파서로 옮기고 이 파일은 지웁니다.
 */

export type PatchStatChange = {
  /** Data Dragon 스탯 키(hp·armor·spellblock…). 화면 라벨은 프런트가 붙입니다. */
  stat: string;
  from: number;
  to: number;
};

export type PatchSystemChange = PatchStatChange & {
  /** 같은 변경을 받은 챔피언 수. 서버가 5명 이상일 때만 시스템 변경으로 묶습니다. */
  championCount: number;
};

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
  /** 항상 false — 스킬 변경 미포함을 응답이 스스로 밝힙니다. */
  skillChangesIncluded: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseStatChange(value: unknown): PatchStatChange | undefined {
  if (!isRecord(value)) return undefined;
  const from = finiteNumber(value.from);
  const to = finiteNumber(value.to);
  if (typeof value.stat !== "string" || !value.stat || from === undefined || to === undefined) return undefined;
  /* 변화가 없는 항목은 요약이 아닙니다. 서버 버그로 섞여 와도 화면에 올리지 않습니다. */
  if (from === to) return undefined;
  return { stat: value.stat, from, to };
}

function parseSystemChange(value: unknown): PatchSystemChange | undefined {
  const base = parseStatChange(value);
  if (!base || !isRecord(value)) return undefined;
  const championCount = finiteNumber(value.championCount);
  if (championCount === undefined || championCount < 1) return undefined;
  return { ...base, championCount: Math.trunc(championCount) };
}

function parseChampionChange(value: unknown): PatchChampionChange | undefined {
  if (!isRecord(value)) return undefined;
  const championId = finiteNumber(value.championId);
  const direction = value.direction;
  if (championId === undefined || typeof value.name !== "string" || !value.name) return undefined;
  if (direction !== "buff" && direction !== "nerf" && direction !== "adjust") return undefined;
  const changes = Array.isArray(value.changes)
    ? value.changes.map(parseStatChange).filter((change): change is PatchStatChange => Boolean(change))
    : [];
  if (changes.length === 0) return undefined;
  return {
    championId: Math.trunc(championId),
    name: value.name,
    ...(typeof value.iconUrl === "string" && value.iconUrl ? { iconUrl: value.iconUrl } : {}),
    direction,
    changes,
  };
}

function parseItemChange(value: unknown): PatchItemChange | undefined {
  if (!isRecord(value)) return undefined;
  const itemId = finiteNumber(value.itemId);
  const kind = value.kind;
  if (itemId === undefined || typeof value.name !== "string" || !value.name) return undefined;
  if (kind !== "price" && kind !== "new" && kind !== "removed") return undefined;
  const from = finiteNumber(value.from);
  const to = finiteNumber(value.to);
  /* 가격 변경인데 값이 없으면 화면이 "→" 만 그리게 됩니다. */
  if (kind === "price" && (from === undefined || to === undefined)) return undefined;
  return {
    itemId: Math.trunc(itemId),
    name: value.name,
    ...(typeof value.iconUrl === "string" && value.iconUrl ? { iconUrl: value.iconUrl } : {}),
    kind,
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
  };
}

/** 응답을 검증합니다. 형식을 벗어나면 undefined — 화면은 패널을 숨깁니다. */
export function parsePatchChangeSummary(value: unknown): PatchChangeSummary | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.patchVersion !== "string" || !/^\d{1,3}\.\d{1,3}$/u.test(value.patchVersion)) return undefined;
  const versions = value.comparedVersions;
  if (!Array.isArray(versions) || versions.length !== 2) return undefined;
  const [previous, current] = versions;
  if (typeof previous !== "string" || typeof current !== "string" || !previous || !current) return undefined;

  const systemChanges = Array.isArray(value.systemChanges)
    ? value.systemChanges.map(parseSystemChange).filter((change): change is PatchSystemChange => Boolean(change))
    : [];
  const championChanges = Array.isArray(value.championChanges)
    ? value.championChanges.map(parseChampionChange).filter((change): change is PatchChampionChange => Boolean(change))
    : [];
  const itemChanges = Array.isArray(value.itemChanges)
    ? value.itemChanges.map(parseItemChange).filter((change): change is PatchItemChange => Boolean(change))
    : [];

  /* 세 목록이 모두 비면 보여 줄 것이 없습니다 — 빈 패널을 그리지 않습니다. */
  if (systemChanges.length === 0 && championChanges.length === 0 && itemChanges.length === 0) return undefined;

  return {
    patchVersion: value.patchVersion,
    comparedVersions: [previous, current],
    systemChanges,
    championChanges,
    itemChanges,
    skillChangesIncluded: value.skillChangesIncluded === true,
  };
}

/* Data Dragon 스탯 키 → 화면 라벨. 서버가 키만 보내고 라벨은 화면이 붙입니다
   (언어를 서버 응답에 섞지 않기 위해서입니다). 모르는 키는 키 그대로 씁니다.
   en 은 Riot 영문 클라이언트 표기를 따릅니다(2026-08-23: 없어서 ko 로 떨어져
   /en 패치 노트에 「마법 저항력」이 그대로 보였습니다). */
const STAT_LABELS: Record<string, { ko: string; ja: string; en: string }> = {
  hp: { ko: "체력", ja: "体力", en: "Health" },
  hpperlevel: { ko: "레벨당 체력", ja: "レベルごとの体力", en: "Health per level" },
  mp: { ko: "마나", ja: "マナ", en: "Mana" },
  mpperlevel: { ko: "레벨당 마나", ja: "レベルごとのマナ", en: "Mana per level" },
  movespeed: { ko: "이동 속도", ja: "移動速度", en: "Move speed" },
  armor: { ko: "방어력", ja: "物理防御", en: "Armor" },
  armorperlevel: { ko: "레벨당 방어력", ja: "レベルごとの物理防御", en: "Armor per level" },
  spellblock: { ko: "마법 저항력", ja: "魔法防御", en: "Magic resist" },
  spellblockperlevel: { ko: "레벨당 마법 저항력", ja: "レベルごとの魔法防御", en: "Magic resist per level" },
  attackrange: { ko: "사거리", ja: "攻撃距離", en: "Attack range" },
  hpregen: { ko: "체력 재생", ja: "体力回復", en: "Health regen" },
  hpregenperlevel: { ko: "레벨당 체력 재생", ja: "レベルごとの体力回復", en: "Health regen per level" },
  mpregen: { ko: "마나 재생", ja: "マナ回復", en: "Mana regen" },
  mpregenperlevel: { ko: "레벨당 마나 재생", ja: "レベルごとのマナ回復", en: "Mana regen per level" },
  crit: { ko: "치명타", ja: "クリティカル", en: "Critical strike" },
  /* ddragon stats 는 키가 20개인데 이 사전에 19개만 있어 챔피언 상세의 기본 스탯
     격자에 영문 키가 그대로 노출됐습니다(목업 §04 에서 발견 · 라벨 추가로 결정). */
  critperlevel: { ko: "레벨당 치명타", ja: "レベルごとのクリティカル", en: "Critical strike per level" },
  attackdamage: { ko: "공격력", ja: "攻撃力", en: "Attack damage" },
  attackdamageperlevel: { ko: "레벨당 공격력", ja: "レベルごとの攻撃力", en: "Attack damage per level" },
  attackspeed: { ko: "공격 속도", ja: "攻撃速度", en: "Attack speed" },
  attackspeedperlevel: { ko: "레벨당 공격 속도", ja: "レベルごとの攻撃速度", en: "Attack speed per level" },
};

export type PatchStatLabelLocale = "ko" | "ja" | "en";

export function patchStatLabel(stat: string, locale: PatchStatLabelLocale): string {
  return STAT_LABELS[stat]?.[locale] ?? stat;
}

/** 라벨이 없어 영문 키가 그대로 나가는 상태인지. 화면은 그 칸을 다른 서체로 표시합니다
 *  — 앞으로 ddragon 이 스탯 키를 늘렸을 때를 위한 보험입니다(목업 §04). */
export function hasPatchStatLabel(stat: string): boolean {
  return stat in STAT_LABELS;
}
