import { valorantI18n } from "../i18n/valorant-i18n";
import type { ValorantPage } from "../utils/routes";

/* 상단 nav 와 하단 탭바가 공유하는 단일 원본 — 라벨·순서·활성 판정이 어긋나지 않게. */
export const valorantNavItems: Array<{ page: ValorantPage; ko: string; ja: string }> = [
  { page: "home", ko: valorantI18n.ko.home, ja: valorantI18n.ja.home },
  { page: "agents", ko: valorantI18n.ko.agents, ja: valorantI18n.ja.agents },
  { page: "weapons", ko: valorantI18n.ko.weapons, ja: valorantI18n.ja.weapons },
  { page: "maps", ko: valorantI18n.ko.maps, ja: valorantI18n.ja.maps },
  { page: "ranked", ko: valorantI18n.ko.ranked, ja: valorantI18n.ja.ranked },
];

export function ValorantNavIcon({ page }: { page: ValorantPage }) {
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
  if (page === "agents") return <svg {...commonProps}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" /></svg>;
  if (page === "weapons") return <svg {...commonProps}><path d="M3 17 17 3l4 4L7 21l-4-4Zm10-10 4 4M5 15l4 4" /></svg>;
  if (page === "maps") return <svg {...commonProps}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  return <svg {...commonProps}><path d="M8 21h8m-4-4v4M5 4h14v3a7 7 0 0 1-14 0V4Zm-2 2H1v1a4 4 0 0 0 4 4M21 6h2v1a4 4 0 0 1-4 4" /></svg>;
}
