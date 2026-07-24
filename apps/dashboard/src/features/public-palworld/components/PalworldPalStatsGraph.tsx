import type { PalworldPalStats } from "@streamops/shared";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

export type PalworldPalStatId =
  | "hp"
  | "attack"
  | "shotAttack"
  | "meleeAttack"
  | "defense"
  | "stamina"
  | "food"
  | "walkSpeed"
  | "moveSpeed"
  | "runSpeed"
  | "rideSprintSpeed";

type PalworldPalStatLabel =
  | "hp"
  | "attack"
  | "shotAttack"
  | "meleeAttack"
  | "defense"
  | "stamina"
  | "food"
  | "walkSpeed"
  | "moveSpeed"
  | "runSpeed"
  | "rideSprintSpeed";

type PalworldPalStatGroup = "combat" | "movement" | "resource";

export type PalworldPalStatRow = {
  id: PalworldPalStatId;
  label: PalworldPalStatLabel;
  value: number;
  percent: number;
  group: PalworldPalStatGroup;
};

/**
 * 현재 active release와 검증 중인 PAK candidate의 실제 범위를 모두 포함하는 표시용 축입니다.
 * 막대는 보조 표현이며 API의 정확한 값은 항상 별도 텍스트로 렌더링합니다.
 */
export const PALWORLD_PAL_STAT_GRAPH_SCALES: Readonly<Record<PalworldPalStatId, number>> = {
  hp: 200,
  attack: 200,
  shotAttack: 200,
  meleeAttack: 200,
  defense: 200,
  stamina: 500,
  food: 10,
  walkSpeed: 3_000,
  moveSpeed: 3_000,
  runSpeed: 3_000,
  rideSprintSpeed: 3_500,
};

function optionalStat(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function statRow(
  id: PalworldPalStatId,
  label: PalworldPalStatLabel,
  value: number,
  group: PalworldPalStatGroup,
): PalworldPalStatRow {
  const scale = PALWORLD_PAL_STAT_GRAPH_SCALES[id];
  const percent = Math.min(100, Math.max(0, (value / scale) * 100));
  return { id, label, value, percent: Number(percent.toFixed(4)), group };
}

export function buildPalworldPalStatRows(stats: PalworldPalStats): PalworldPalStatRow[] {
  const rows = [statRow("hp", "hp", stats.hp, "combat")];
  const shotAttack = optionalStat(stats.shotAttack);
  rows.push(shotAttack === undefined
    ? statRow("attack", "attack", stats.attack, "combat")
    : statRow("shotAttack", "shotAttack", shotAttack, "combat"));

  const meleeAttack = optionalStat(stats.meleeAttack);
  if (meleeAttack !== undefined) rows.push(statRow("meleeAttack", "meleeAttack", meleeAttack, "combat"));
  rows.push(statRow("defense", "defense", stats.defense, "combat"));
  rows.push(statRow("stamina", "stamina", stats.stamina, "resource"));

  const food = optionalStat(stats.food);
  if (food !== undefined) rows.push(statRow("food", "food", food, "resource"));
  const walkSpeed = optionalStat(stats.walkSpeed);
  if (walkSpeed !== undefined) rows.push(statRow("walkSpeed", "walkSpeed", walkSpeed, "movement"));
  const runSpeed = optionalStat(stats.runSpeed);
  rows.push(runSpeed === undefined
    ? statRow("moveSpeed", "moveSpeed", stats.moveSpeed, "movement")
    : statRow("runSpeed", "runSpeed", runSpeed, "movement"));
  const rideSprintSpeed = optionalStat(stats.rideSprintSpeed);
  if (rideSprintSpeed !== undefined) {
    rows.push(statRow("rideSprintSpeed", "rideSprintSpeed", rideSprintSpeed, "movement"));
  }
  return rows;
}

export function PalworldPalStatsGraph({
  locale,
  stats,
}: {
  locale: PalworldLocale;
  stats: PalworldPalStats;
}) {
  const text = palworldI18n[locale];
  return (
    <dl className="palworld-stat-chart" data-testid="palworld-stat-chart">
      {buildPalworldPalStatRows(stats).map((row) => (
        <div className="palworld-stat-chart-row" data-stat={row.id} data-stat-group={row.group} key={row.id}>
          <dt data-ja={palworldI18n.ja[row.label]} data-ko={palworldI18n.ko[row.label]}>{text[row.label]}</dt>
          <dd>
            <span aria-hidden="true" className="palworld-stat-chart-track">
              <span className="palworld-stat-chart-fill" style={{ inlineSize: `${row.percent}%` }} />
            </span>
            <strong>{row.value.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR")}</strong>
          </dd>
        </div>
      ))}
    </dl>
  );
}
