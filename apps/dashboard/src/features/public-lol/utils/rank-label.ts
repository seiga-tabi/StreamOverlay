import type { LolRankedStats } from "@streamops/shared";
import { publicRankText as t } from "../i18n/public-rank-i18n";

export const tierLabels: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
  UNRANKED: "Unranked"
};

/** LP 를 뺀 티어 이름입니다. LP 를 별도 요소로 두는 화면에서 씁니다. */
export function rankTierLabel(stats: LolRankedStats | undefined): string {
  if (!stats || stats.tier === "UNRANKED") return t().unranked;
  return `${tierLabels[stats.tier] ?? stats.tier} ${stats.rank ?? ""}`.trim();
}

export function rankLabel(stats: LolRankedStats | undefined): string {
  if (!stats || stats.tier === "UNRANKED") return t().unranked;
  return `${tierLabels[stats.tier] ?? stats.tier} ${stats.rank ?? ""} ${stats.leaguePoints} LP`.trim();
}

