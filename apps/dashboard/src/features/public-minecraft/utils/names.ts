import type { MinecraftLocalizedName } from "@streamops/shared";
import type { MinecraftLocale } from "../i18n/minecraft-i18n";

export type ResolvedMinecraftName = {
  text: string;
  /** ko·ja 공식 명칭이 아직 없어 영문 원문을 표시하는 상태 */
  fallback: boolean;
};

export function resolveMinecraftName(
  name: MinecraftLocalizedName,
  locale: MinecraftLocale,
): ResolvedMinecraftName {
  return {
    text: name[locale],
    fallback: name.status[locale] === "source_language_fallback",
  };
}

/* 목록에 없는 ID 를 사람이 읽을 형태로 — 예: bane_of_arthropods → "Bane Of Arthropods".
 * 번역 명칭이 확보되면 그 명칭이 우선하고, 이 형태는 EN fallback 과 같은 지위입니다. */
export function minecraftNameFromId(id: string): string {
  return id
    .split("_")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/* 외부 텍스처가 없거나 로드에 실패했을 때 사용할 자체 fallback 색입니다. */
export function minecraftTileHue(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0;
  }
  return ((hash % 360) + 360) % 360;
}

/* minecraft-data enchantCategory 의 ko·ja 라벨 — 알려진 값만 번역하고
 * 미지 코드는 null 을 돌려 호출부가 코드 그대로(en) 표기하게 합니다(가짜 번역 금지). */
const ENCHANT_CATEGORY_LABELS: Record<string, { ko: string; ja: string }> = {
  armor: { ko: "갑옷", ja: "防具" },
  armor_chest: { ko: "갑옷(상체)", ja: "防具(胴)" },
  armor_feet: { ko: "갑옷(신발)", ja: "防具(足)" },
  armor_head: { ko: "갑옷(머리)", ja: "防具(頭)" },
  armor_legs: { ko: "갑옷(하체)", ja: "防具(脚)" },
  bow: { ko: "활", ja: "弓" },
  breakable: { ko: "내구 아이템", ja: "耐久あり" },
  crossbow: { ko: "석궁", ja: "クロスボウ" },
  digger: { ko: "도구", ja: "ツール" },
  fishing_rod: { ko: "낚싯대", ja: "釣り竿" },
  mace: { ko: "철퇴", ja: "メイス" },
  trident: { ko: "삼지창", ja: "トライデント" },
  vanishable: { ko: "소멸 가능", ja: "消滅可能" },
  weapon: { ko: "무기", ja: "武器" },
  wearable: { ko: "착용품", ja: "装着品" },
};

export function minecraftEnchantCategoryLabel(
  categoryId: string,
  locale: MinecraftLocale,
): string | null {
  return ENCHANT_CATEGORY_LABELS[categoryId]?.[locale] ?? null;
}
