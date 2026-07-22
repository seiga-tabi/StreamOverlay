import type { PalworldItemSummary, PalworldPalSummary } from "@streamops/shared";
import type { PalworldLocale } from "../i18n/palworld-i18n";

export function normalizePalworldSearch(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function palName(pal: PalworldPalSummary, locale: PalworldLocale): string {
  return (locale === "ja" ? pal.nameJa : pal.nameKo)?.trim() || pal.nameEn;
}

export function itemName(item: PalworldItemSummary, locale: PalworldLocale): string {
  return (locale === "ja" ? item.nameJa : item.nameKo)?.trim() || item.nameEn;
}

export function matchesPalworldPal(pal: PalworldPalSummary, query: string): boolean {
  const normalized = normalizePalworldSearch(query);
  if (!normalized) return true;
  return [pal.id, String(pal.number), pal.nameKo, pal.nameJa, pal.nameEn]
    .filter((candidate): candidate is string => typeof candidate === "string")
    .some((candidate) => normalizePalworldSearch(candidate).includes(normalized));
}

export function matchesPalworldItem(item: PalworldItemSummary, query: string): boolean {
  const normalized = normalizePalworldSearch(query);
  if (!normalized) return true;
  return [item.id, item.nameKo, item.nameJa, item.nameEn]
    .filter((candidate): candidate is string => typeof candidate === "string")
    .some((candidate) => normalizePalworldSearch(candidate).includes(normalized));
}

export function formatPalNumber(number: number | string): string {
  const numeric = Number(number);
  return Number.isFinite(numeric) ? `No.${String(numeric).padStart(3, "0")}` : `No.${number}`;
}
