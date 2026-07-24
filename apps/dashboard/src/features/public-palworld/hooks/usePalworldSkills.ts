import type { PalworldPaginatedResponse, PalworldSkillSummary } from "@streamops/shared";
import { getPalworldSkills } from "../api/palworld";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import { usePalworldInfiniteList } from "./usePalworldInfiniteList";

export const PALWORLD_SKILL_FILTER_KEYS = ["q", "type", "element", "sort", "order", "page"] as const;

export function usePalworldSkills(params: URLSearchParams, locale: PalworldLocale) {
  const routeQuery = PALWORLD_SKILL_FILTER_KEYS.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");
  const infinite = usePalworldInfiniteList<PalworldSkillSummary, PalworldPaginatedResponse<PalworldSkillSummary>>({
    initialPage: params.get("page") ?? "1",
    itemKey: (skill) => skill.id,
    loadPage: (page, signal) => {
      const apiParams = new URLSearchParams();
      PALWORLD_SKILL_FILTER_KEYS.forEach((key) => {
        if (key === "page") return;
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
  };
}
