import {
  PALWORLD_ELEMENTS,
  type PalworldElement,
  type PalworldPalReference,
  type PalworldPalSummary,
} from "@streamops/shared";

const RECENT_PAL_STORAGE_KEY = "yoro.palworld.recent-pals.v1";
const MAX_RECENT_PALS = 6;
const PAL_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const PAL_IMAGE_PREFIX = "/images/palworld/";

/**
 * localStorage 값은 사용자가 임의로 바꿀 수 있으므로 필드 단위로 검증하고,
 * 형식을 벗어난 항목은 조용히 버립니다. 이미지 경로는 로컬 palworld 자산만 허용합니다.
 */
export function parseRecentPals(raw: string | null): PalworldPalReference[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const result: PalworldPalReference[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Partial<PalworldPalReference>;
    if (typeof candidate.id !== "string" || !PAL_ID_PATTERN.test(candidate.id)) continue;
    if (typeof candidate.number !== "number" || !Number.isSafeInteger(candidate.number) || candidate.number < 0) continue;
    if (typeof candidate.nameKo !== "string" || !candidate.nameKo.trim()) continue;
    if (typeof candidate.nameJa !== "string" || !candidate.nameJa.trim()) continue;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    const elements = Array.isArray(candidate.elements)
      ? candidate.elements
        .filter((element): element is PalworldElement => PALWORLD_ELEMENTS.includes(element as PalworldElement))
        .slice(0, 2)
      : [];
    const imageUrl = typeof candidate.imageUrl === "string" && candidate.imageUrl.startsWith(PAL_IMAGE_PREFIX)
      ? candidate.imageUrl
      : undefined;
    result.push({
      id: candidate.id,
      number: candidate.number,
      nameKo: candidate.nameKo,
      nameJa: candidate.nameJa,
      ...(typeof candidate.nameEn === "string" && candidate.nameEn.trim() ? { nameEn: candidate.nameEn } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(typeof candidate.imageWidth === "number" && Number.isSafeInteger(candidate.imageWidth)
        ? { imageWidth: candidate.imageWidth }
        : {}),
      ...(typeof candidate.imageHeight === "number" && Number.isSafeInteger(candidate.imageHeight)
        ? { imageHeight: candidate.imageHeight }
        : {}),
      elements,
    });
    if (result.length >= MAX_RECENT_PALS) break;
  }
  return result;
}

export function readRecentPals(): PalworldPalReference[] {
  try {
    return parseRecentPals(window.localStorage.getItem(RECENT_PAL_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveRecentPal(pal: PalworldPalReference | PalworldPalSummary): void {
  try {
    const entry: PalworldPalReference = {
      id: pal.id,
      number: pal.number,
      nameKo: pal.nameKo,
      nameJa: pal.nameJa,
      ...(pal.nameEn ? { nameEn: pal.nameEn } : {}),
      ...(pal.imageUrl ? { imageUrl: pal.imageUrl } : {}),
      ...(pal.imageWidth !== undefined ? { imageWidth: pal.imageWidth } : {}),
      ...(pal.imageHeight !== undefined ? { imageHeight: pal.imageHeight } : {}),
      elements: pal.elements,
    };
    const next = [entry, ...readRecentPals().filter((item) => item.id !== entry.id)].slice(0, MAX_RECENT_PALS);
    window.localStorage.setItem(RECENT_PAL_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 최근 사용 저장 실패는 교배 검색 흐름을 막지 않습니다.
  }
}
