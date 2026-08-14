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
