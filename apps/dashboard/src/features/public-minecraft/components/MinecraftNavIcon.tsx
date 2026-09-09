import type { MinecraftPage } from "../utils/routes";

export function MinecraftNavIcon({ page }: { page: MinecraftPage }) {
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

  if (page === "home") return <svg {...commonProps}><path d="M4 8h16v12H4Zm0 0 8-5 8 5M9 13h2v2H9Zm4 0h2v2h-2Z" /></svg>;
  if (page === "recipes") return <svg {...commonProps}><path d="M4 4h16v16H4Zm5.3 0v16M14.6 4v16M4 9.3h16M4 14.6h16" /></svg>;
  if (page === "items") return <svg {...commonProps}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Zm0 0v9m8-4.5L12 12M4 7.5 12 12" /></svg>;
  if (page === "enchants") return <svg {...commonProps}><path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>;
  if (page === "library") return <svg {...commonProps}><path d="M4 7h16v13H4Zm0 0 2-4h12l2 4M10 11h4" /></svg>;
  return <svg {...commonProps}><path d="M6 3h9l4 4v14H6Zm9 0v4h4M9 12h6M9 16h6" /></svg>;
}

