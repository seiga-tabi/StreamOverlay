import type { LolChampionSummary } from "@streamops/shared";
import { activePublicLocale, type PublicLocale } from "../i18n/public-lol-i18n";

/**
 * 챔피언 표시 이름 — 전적 화면·전체 챔피언 목록·챔피언 빌드 통계가 함께 씁니다.
 *
 * en 은 응답에 영문 표시명이 따로 없어 Data Dragon championKey("MissFortune")를
 * 대문자 경계로 띄웁니다. 아포스트로피류(Kha'Zix 등)는 근사 표기입니다.
 */
export function championName(champion: LolChampionSummary | undefined, locale: PublicLocale = activePublicLocale): string {
  if (!champion) return "-";
  if (locale === "ja") return champion.nameJa ?? champion.nameKo ?? champion.championKey ?? `Champion ${champion.championId}`;
  if (locale === "en") {
    const englishName = champion.championKey?.replace(/([a-z])([A-Z])/g, "$1 $2");
    return englishName ?? champion.nameKo ?? champion.nameJa ?? `Champion ${champion.championId}`;
  }
  return champion.nameKo ?? champion.nameJa ?? champion.championKey ?? `Champion ${champion.championId}`;
}
