import type { ReactNode } from "react";
import { dashboardI18n, uiText } from "../i18n";

const pages = ["dashboard", "twitch", "overlayStatus", "overlayTest", "overlayRewards", "overlayAlerts", "myRiotAccount", "soloRank", "participation", "streamerRiotRequests", "followers", "events", "questions", "settings"] as const;

export type Page = (typeof pages)[number];
export type DashboardRole = "admin" | "streamer";

export const STREAMER_ALLOWED_PAGES: Page[] = [
  "dashboard",
  "overlayStatus",
  "overlayAlerts",
  "myRiotAccount",
  "soloRank",
  "participation",
  "followers",
  "questions",
  "events"
];

export function pageAllowedForRole(page: Page, role: DashboardRole): boolean {
  return role === "admin" || STREAMER_ALLOWED_PAGES.includes(page);
}

const navSections: Array<{ key: keyof typeof uiText.app.navGroups; items: Page[] }> = [
  { key: "operations", items: ["dashboard", "twitch"] },
  { key: "overlay", items: ["overlayStatus", "overlayTest", "overlayRewards", "overlayAlerts"] },
  { key: "lol", items: ["myRiotAccount", "soloRank", "participation", "streamerRiotRequests"] },
  { key: "community", items: ["followers", "questions", "events"] },
  { key: "system", items: ["settings"] }
];

export function Layout({
  page,
  setPage,
  role = "admin",
  onLogout,
  onPublicHome,
  children
}: {
  page: Page;
  setPage: (page: Page) => void;
  role?: DashboardRole;
  onLogout?: () => void;
  onPublicHome?: () => void;
  children: ReactNode;
}) {
  const currentPage = uiText.pages[page];
  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => pageAllowedForRole(item, role))
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand">StreamOps</div>
            <div className="brand-subtitle">{uiText.app.brandSubtitle}</div>
          </div>
        </div>
        <div className="sidebar-profile">
          <span>{uiText.app.workspaceKicker}</span>
          <strong>{uiText.app.workspaceLabel}</strong>
          <p>{uiText.app.workspaceDescription}</p>
        </div>
        <nav aria-label={uiText.app.navLabel}>
          {visibleNavSections.map((section) => (
            <div className="nav-group" key={section.key}>
              <div className="nav-section-title">{uiText.app.navGroups[section.key]}</div>
              <div className="nav-group-items">
                {section.items.map((item) => (
                  <button
                    key={item}
                    className={`nav-item ${page === item ? "active" : ""}`}
                    data-ko={dashboardI18n.ko.pages[item].label}
                    data-ja={dashboardI18n.ja.pages[item].label}
                    onClick={() => setPage(item)}
                  >
                    <span className="nav-marker" />
                    <span>{uiText.pages[item].label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="app-main">
        <div className="top-bar">
          <div>
            <span className="eyebrow">{uiText.app.currentView}</span>
            <strong>{currentPage.short}</strong>
          </div>
          <div className="top-actions">
            {onPublicHome ? <button className="secondary top-action" onClick={onPublicHome}>{uiText.app.publicHome}</button> : null}
            {role === "admin" ? <button className="secondary top-action" onClick={() => setPage("settings")}>{uiText.app.quickSettings}</button> : null}
            {onLogout ? <button className="secondary top-action" onClick={onLogout}>{uiText.app.logout}</button> : null}
            <span className="top-chip">{uiText.app.liveSafety}</span>
          </div>
        </div>
        <section className="content-shell">{children}</section>
      </main>
    </div>
  );
}
