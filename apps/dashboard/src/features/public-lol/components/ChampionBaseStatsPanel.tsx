import type { LolChampionDetailResponse } from "@streamops/shared";
import { activePublicLocale, t } from "../i18n/public-lol-i18n";
import { fillChampionText, formatChampionNumber } from "../utils/champion-detail";

/* 챔피언 상세 「기본 정보」 패널 — 목업
 * `docs/mockups/lol-champion-detail-skills-stats.approved-spec.html` §04·§05.
 *
 * ddragon stats 20키를 자동 격자(minmax 200px)에 담습니다. 값이 0 인 칸(아리의
 * 레벨당 공격력·치명타)도 숨기지 않습니다 — 칸이 비면 "아직 안 불러왔나"로 읽힙니다.
 * 라벨은 화면 언어에 맞춘 전용 사전을 씁니다.
 */

/* 표시 순서 — 목업 §04 격자 그대로입니다(체력계 → 마나계 → 공격 → 방어 → 이동·사거리 →
   치명타). 응답 객체의 키 순서에 기대지 않습니다. */
const STAT_ORDER: readonly string[] = [
  "hp",
  "hpperlevel",
  "hpregen",
  "hpregenperlevel",
  "mp",
  "mpperlevel",
  "mpregen",
  "mpregenperlevel",
  "attackdamage",
  "attackdamageperlevel",
  "attackspeed",
  "attackspeedperlevel",
  "armor",
  "armorperlevel",
  "spellblock",
  "spellblockperlevel",
  "movespeed",
  "attackrange",
  "crit",
  "critperlevel"
];

type StatLabelLocale = "ko" | "ja" | "en";

const STAT_LABELS: Readonly<Record<string, Readonly<Record<StatLabelLocale, string>>>> = {
  hp: { ko: "체력", ja: "体力", en: "Health" },
  hpperlevel: { ko: "레벨당 체력", ja: "レベルごとの体力", en: "Health per level" },
  hpregen: { ko: "체력 재생", ja: "体力回復", en: "Health regen" },
  hpregenperlevel: { ko: "레벨당 체력 재생", ja: "レベルごとの体力回復", en: "Health regen per level" },
  mp: { ko: "마나", ja: "マナ", en: "Mana" },
  mpperlevel: { ko: "레벨당 마나", ja: "レベルごとのマナ", en: "Mana per level" },
  mpregen: { ko: "마나 재생", ja: "マナ回復", en: "Mana regen" },
  mpregenperlevel: { ko: "레벨당 마나 재생", ja: "レベルごとのマナ回復", en: "Mana regen per level" },
  attackdamage: { ko: "공격력", ja: "攻撃力", en: "Attack damage" },
  attackdamageperlevel: { ko: "레벨당 공격력", ja: "レベルごとの攻撃力", en: "Attack damage per level" },
  attackspeed: { ko: "공격 속도", ja: "攻撃速度", en: "Attack speed" },
  attackspeedperlevel: { ko: "레벨당 공격 속도", ja: "レベルごとの攻撃速度", en: "Attack speed per level" },
  armor: { ko: "방어력", ja: "物理防御", en: "Armor" },
  armorperlevel: { ko: "레벨당 방어력", ja: "レベルごとの物理防御", en: "Armor per level" },
  spellblock: { ko: "마법 저항력", ja: "魔法防御", en: "Magic resist" },
  spellblockperlevel: { ko: "레벨당 마법 저항력", ja: "レベルごとの魔法防御", en: "Magic resist per level" },
  movespeed: { ko: "이동 속도", ja: "移動速度", en: "Move speed" },
  attackrange: { ko: "사거리", ja: "攻撃距離", en: "Attack range" },
  crit: { ko: "치명타", ja: "クリティカル", en: "Critical strike" },
  critperlevel: { ko: "레벨당 치명타", ja: "レベルごとのクリティカル", en: "Critical strike per level" }
};

function statLabelLocale(): StatLabelLocale {
  if (activePublicLocale === "ja") return "ja";
  if (activePublicLocale === "en") return "en";
  return "ko";
}

function statLabel(stat: string, locale: StatLabelLocale): string {
  return STAT_LABELS[stat]?.[locale] ?? stat;
}

/** 알려진 순서 먼저, 그 뒤에 ddragon 이 나중에 늘린 키를 이름순으로 붙입니다. */
function orderedStatKeys(baseStats: Readonly<Record<string, number>>): string[] {
  const present = STAT_ORDER.filter((stat) => typeof baseStats[stat] === "number");
  const extra = Object.keys(baseStats)
    .filter((stat) => !STAT_ORDER.includes(stat) && typeof baseStats[stat] === "number")
    .sort();
  return [...present, ...extra];
}

export function ChampionBaseStatsPanel({ detail }: { detail: LolChampionDetailResponse }) {
  const stats = orderedStatKeys(detail.baseStats);
  if (stats.length === 0) return null;

  const locale = statLabelLocale();

  return (
    <section aria-labelledby="public-champion-stats-title" className="public-champ-panel public-cdetail-panel">
      <div className="public-champ-head">
        <h2 id="public-champion-stats-title">{t().championDetailStatsTitle}</h2>
        <span className="public-champ-pill">
          {fillChampionText(t().championDetailStatsPill, { version: detail.dataDragonVersion })}
        </span>
      </div>

      <div className="public-cstat-grid">
        {stats.map((stat) => {
          const value = detail.baseStats[stat];
          if (value === undefined) return null;
          return (
            <div className="public-cstat" key={stat}>
              <span className="public-cstat-label" data-fallback={STAT_LABELS[stat] ? undefined : "true"}>
                {statLabel(stat, locale)}
              </span>
              <span className="public-cstat-value">{formatChampionNumber(value)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
