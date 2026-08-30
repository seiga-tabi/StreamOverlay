import type { PalworldPage } from "../utils/routes";
import { palworldI18n } from "../i18n/palworld-i18n";

/* 하단 탭바(PalworldBottomTabBar)와 항목 데이터·아이콘을 공유합니다 —
   라벨·순서·활성 판정이 두 곳에서 어긋나지 않게 하는 단일 원본입니다. */
export const palworldNavItems: Array<{ page: Exclude<PalworldPage, "search">; ko: string; ja: string }> = [
  { page: "home", ko: palworldI18n.ko.home, ja: palworldI18n.ja.home },
  { page: "pals", ko: palworldI18n.ko.pals, ja: palworldI18n.ja.pals },
  { page: "breeding", ko: palworldI18n.ko.breeding, ja: palworldI18n.ja.breeding },
  { page: "items", ko: palworldI18n.ko.items, ja: palworldI18n.ja.items },
  { page: "technology", ko: palworldI18n.ko.technology, ja: palworldI18n.ja.technology },
  { page: "skills", ko: palworldI18n.ko.skills, ja: palworldI18n.ja.skills },
  { page: "map", ko: palworldI18n.ko.map, ja: palworldI18n.ja.map },
];

export function isPalworldNavItemActive(
  itemPage: Exclude<PalworldPage, "search">,
  page: PalworldPage
): boolean {
  return itemPage === page || (page === "search" && itemPage === "home");
}

export function PalworldNavIcon({ page }: { page: Exclude<PalworldPage, "search"> }) {
  const commonProps = {
    "aria-hidden": true,
    className: "public-header-menu-icon",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (page === "home") return <svg {...commonProps}><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z" /></svg>;
  if (page === "pals") return <svg {...commonProps}><circle cx="12" cy="13" r="4" /><circle cx="6" cy="8" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="18" cy="8" r="2" /></svg>;
  if (page === "breeding") return <svg {...commonProps}><path d="M8.5 8.5 5 5m10.5 3.5L19 5M8 16l-3 3m11-3 3 3" /><circle cx="12" cy="12" r="5" /></svg>;
  if (page === "items") return <svg {...commonProps}><path d="m4 8 8-4 8 4-8 4-8-4Zm0 0v8l8 4 8-4V8M12 12v8" /></svg>;
  if (page === "technology") return <svg {...commonProps}><path d="M8 3v3m8-3v3M8 18v3m8-3v3M3 8h3m12 0h3M3 16h3m12 0h3" /><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M10 10h4v4h-4z" /></svg>;
  if (page === "skills") return <svg {...commonProps}><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" /></svg>;
  return <svg {...commonProps}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
