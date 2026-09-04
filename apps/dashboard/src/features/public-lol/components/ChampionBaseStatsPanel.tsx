import type { LolChampionDetailResponse, LolChampionPatchStatChange } from "@streamops/shared";
import { activePublicLocale, t } from "../i18n/public-lol-i18n";
import { hasPatchStatLabel, patchStatLabel, type PatchStatLabelLocale } from "../types/patch-change-summary";
import { fillChampionText, formatChampionDelta, formatChampionNumber } from "../utils/champion-detail";

/* 챔피언 상세 「기본 정보」 패널 — 목업
 * `docs/mockups/lol-champion-detail-skills-stats.approved-spec.html` §04·§05.
 *
 * ddragon stats 20키를 자동 격자(minmax 200px)에 담습니다. 값이 0 인 칸(아리의
 * 레벨당 공격력·치명타)도 숨기지 않습니다 — 칸이 비면 "아직 안 불러왔나"로 읽힙니다.
 * 라벨은 패치 노트 화면과 같은 사전(STAT_LABELS)을 그대로 씁니다.
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

function statLabelLocale(): PatchStatLabelLocale {
  if (activePublicLocale === "ja") return "ja";
  if (activePublicLocale === "en") return "en";
  return "ko";
}

/** 알려진 순서 먼저, 그 뒤에 ddragon 이 나중에 늘린 키를 이름순으로 붙입니다. */
function orderedStatKeys(baseStats: Readonly<Record<string, number>>): string[] {
  const present = STAT_ORDER.filter((stat) => typeof baseStats[stat] === "number");
  const extra = Object.keys(baseStats)
    .filter((stat) => !STAT_ORDER.includes(stat) && typeof baseStats[stat] === "number")
    .sort();
  return [...present, ...extra];
}

function StatDelta({ change }: { change: LolChampionPatchStatChange }) {
  /* 방향을 모르는 스탯(HIGHER_IS_BETTER 밖의 키)은 adjust 로 옵니다 — 그때는 판정색을
     붙이지 않고 무채로 둡니다. 틀린 초록/빨강은 정보가 없는 것보다 나쁩니다(목업 §11). */
  const direction = change.direction === "adjust" ? undefined : change.direction;
  return (
    <span className="public-cstat-delta" {...(direction ? { "data-direction": direction } : {})}>
      <span className="public-cstat-from">{formatChampionNumber(change.from)}</span>
      {/* 화살표는 "오른쪽 화살표"로 읽히면 방해라 감추고, 방향은 이 조각이 말합니다(§10). */}
      <span className="yoro-u-sr-only">{t().championDetailDeltaFrom}</span>
      <span aria-hidden="true" className="public-cstat-arrow">→</span>
      <em className="public-cstat-to">{formatChampionNumber(change.to)}</em>
      <span className="public-cstat-amount">{formatChampionDelta(change.from, change.to)}</span>
    </span>
  );
}

export function ChampionBaseStatsPanel({ detail }: { detail: LolChampionDetailResponse }) {
  const stats = orderedStatKeys(detail.baseStats);
  if (stats.length === 0) return null;

  const changeByStat = new Map<string, LolChampionPatchStatChange>(
    (detail.patchChanges?.stats ?? []).map((change) => [change.stat, change])
  );
  const locale = statLabelLocale();

  return (
    <section aria-labelledby="public-champion-stats-title" className="public-champ-panel public-cdetail-panel">
      <div className="public-champ-head">
        <h2 id="public-champion-stats-title">{t().championDetailStatsTitle}</h2>
        <span className="public-champ-pill">
          {fillChampionText(t().championDetailStatsPill, { version: detail.dataDragonVersion })}
        </span>
      </div>

      {changeByStat.size > 0 ? (
        <p className="public-cpatch-note">
          {fillChampionText(t().championDetailStatChangeNote, { count: changeByStat.size })}
        </p>
      ) : null}

      <div className="public-cstat-grid">
        {stats.map((stat) => {
          const value = detail.baseStats[stat];
          if (value === undefined) return null;
          const change = changeByStat.get(stat);
          const direction = change && change.direction !== "adjust" ? change.direction : undefined;
          return (
            <div className="public-cstat" data-direction={direction} key={stat}>
              <span className="public-cstat-label" data-fallback={hasPatchStatLabel(stat) ? undefined : "true"}>
                {patchStatLabel(stat, locale)}
              </span>
              <span className="public-cstat-value">{formatChampionNumber(value)}</span>
              {change ? <StatDelta change={change} /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
