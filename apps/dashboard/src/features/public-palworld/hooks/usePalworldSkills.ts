import { useEffect, useState } from "react";
import type { PalworldPaginatedResponse, PalworldSkillSummary } from "@streamops/shared";
import { getPalworldSkills } from "../api/palworld";

export const PALWORLD_SKILL_FILTER_KEYS = ["q", "type", "element", "sort", "order", "page"] as const;

export function usePalworldSkills(params: URLSearchParams) {
  const [response, setResponse] = useState<PalworldPaginatedResponse<PalworldSkillSummary> | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const routeQuery = PALWORLD_SKILL_FILTER_KEYS.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");

  useEffect(() => {
    const controller = new AbortController();
    const apiParams = new URLSearchParams();
    PALWORLD_SKILL_FILTER_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) apiParams.set(key, value);
    });
    apiParams.set("limit", "24");
    setResponse(null);
    setError(false);
    void getPalworldSkills(apiParams, controller.signal).then(setResponse).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    });
    return () => controller.abort();
  }, [revision, routeQuery]);

  return {
    error,
    response,
    retry: () => setRevision((value) => value + 1),
    routeQuery,
  };
}
