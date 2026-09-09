import { activePublicLocale } from "./public-locale";

// 홈·스트리머 카드에서도 쓰는 랭크 문구의 단일 원본입니다.
export const publicRankI18n = {
  ko: { unranked: "언랭크" },
  ja: { unranked: "アンランク" },
  en: { unranked: "Unranked" },
} as const;

export function publicRankText() {
  return publicRankI18n[activePublicLocale];
}
