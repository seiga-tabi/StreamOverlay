import type { ReactNode } from "react";
import { dashboardI18n, uiText } from "../i18n";

const pages = ["dashboard", "twitch", "overlayStatus", "overlayTest", "overlayRewards", "overlayAlerts", "followers", "events", "questions", "participation", "settings"] as const;

export type Page = (typeof pages)[number];

const navSections: Array<{ key: keyof typeof uiText.app.navGroups; items: Page[] }> = [
  { key: "operations", items: ["dashboard", "twitch"] },
  { key: "overlay", items: ["overlayStatus", "overlayTest", "overlayRewards", "overlayAlerts"] },
  { key: "community", items: ["followers", "questions", "participation", "events"] },
  { key: "system", items: ["settings"] }
];

export function Layout({
  page,
  setPage,
  onLogout,
  children
}: {
  page: Page;
  setPage: (page: Page) => void;
  onLogout?: () => void;
  children: ReactNode;
}) {
  const currentPage = uiText.pages[page];

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
          {navSections.map((section) => (
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
            <button className="secondary top-action" onClick={() => setPage("settings")}>{uiText.app.quickSettings}</button>
            {onLogout ? <button className="secondary top-action" onClick={onLogout}>{uiText.app.logout}</button> : null}
            <span className="top-chip">{uiText.app.liveSafety}</span>
          </div>
        </div>
        <section className="content-shell">{children}</section>
      </main>
    </div>
  );
}
