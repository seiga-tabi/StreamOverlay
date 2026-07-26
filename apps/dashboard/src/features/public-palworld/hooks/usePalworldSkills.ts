import {
  PALWORLD_SKILL_TYPES,
  type PalworldSkillListResponse,
  type PalworldSkillSummary,
  type PalworldSkillType,
} from "@streamops/shared";
import { getPalworldSkills } from "../api/palworld";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import { usePalworldInfiniteList } from "./usePalworldInfiniteList";

export const PALWORLD_SKILL_FILTER_KEYS = [
  "q",
  "type",
  "element",
  "partnerElement",
  "passiveEffect",
  "passiveTier",
  "sort",
  "order",
  "page",
] as const;

function isSkillType(value: string | null): value is PalworldSkillType {
  return value !== null && PALWORLD_SKILL_TYPES.includes(value as PalworldSkillType);
}

export function usePalworldSkills(params: URLSearchParams, locale: PalworldLocale) {
  const rawType = params.get("type");
  const selectedType: PalworldSkillType = isSkillType(rawType) ? rawType : "active";
  const routeQuery = PALWORLD_SKILL_FILTER_KEYS.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");
  const infinite = usePalworldInfiniteList<PalworldSkillSummary, PalworldSkillListResponse>({
    initialPage: params.get("page") ?? "1",
    itemKey: (skill) => skill.id,
    loadPage: (page, signal) => {
      const apiParams = new URLSearchParams();
      PALWORLD_SKILL_FILTER_KEYS.forEach((key) => {
        if (key === "page") return;
        if (key === "type") {
          apiParams.set("type", selectedType);
          return;
        }
        if (key === "element" && selectedType !== "active") return;
        if (key === "partnerElement" && selectedType !== "partner") return;
        if ((key === "passiveEffect" || key === "passiveTier") && selectedType !== "passive") return;
        const value = params.get(key);
        if (value) apiParams.set(key, value);
      });
      apiParams.set("page", String(page));
      apiParams.set("locale", locale);
      apiParams.set("limit", "24");
      return getPalworldSkills(apiParams, signal);
    },
    paused: Boolean(params.get("pal") || params.get("item") || params.get("skill")),
    queryKey: `${locale}:${routeQuery}`,
  });

  return {
    ...infinite,
    routeQuery,
    selectedType,
  };
}
