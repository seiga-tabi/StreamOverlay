import { useState, type ReactNode } from "react";
import { dashboardI18n, type DashboardLocale } from "../i18n";
import { pageAllowedForRole, type DashboardRole, type Page } from "../routing/dashboard-routes";

export type { DashboardRole, Page } from "../routing/dashboard-routes";

const navSections: Array<{ key: keyof typeof dashboardI18n.ko.app.navGroups; items: Page[] }> = [
  { key: "operations", items: ["serverStatus", "dashboard", "twitch"] },
  { key: "overlay", items: ["overlayStatus", "overlayTest", "overlayRewards", "overlayAlerts"] },
  { key: "lol", items: ["myRiotAccount", "soloRank", "participation", "tournaments", "streamerRiotRequests"] },
  { key: "community", items: ["followers", "communityModeration", "events"] },
  { key: "system", items: ["supportInbox", "settings"] }
];

function DashboardLocaleSelector({
  locale,
  onLocaleChange
}: {
  locale: DashboardLocale;
  onLocaleChange: (locale: DashboardLocale) => void;
}) {
  const [open, setOpen] = useState(false);
  const text = dashboardI18n[locale].app;
  const options: Array<{ locale: DashboardLocale; code: string; label: string }> = [
    { locale: "ko", code: "KR", label: text.languageKo },
    { locale: "ja", code: "JP", label: text.languageJa }
  ];
  const activeCode = locale === "ja" ? "JP" : "KR";

  function selectLocale(nextLocale: DashboardLocale): void {
    onLocaleChange(nextLocale);
    setOpen(false);
  }

  return (
    <div className="public-locale-menu dashboard-locale-menu">
      <button
        type="button"
        className="public-locale-button dashboard-locale-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={text.languageMenu}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="public-globe-icon" aria-hidden="true"><span /></span>
        <strong>{activeCode}</strong>
        <i aria-hidden="true" />
      </button>
      {open ? (
        <div className="public-locale-popover dashboard-locale-popover" role="menu" aria-label={text.language}>
          {options.map((option) => (
            <button
              key={option.locale}
              type="button"
              className={option.locale === locale ? "active" : ""}
              role="menuitemradio"
              aria-checked={option.locale === locale}
              aria-label={`${option.code} ${option.label}`}
              onClick={() => selectLocale(option.locale)}
            >
              <strong>{option.code}</strong>
              <em aria-hidden="true">✓</em>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Layout({
  page,
  setPage,
  role = "admin",
  locale,
  onLocaleChange,
  onLogout,
  onPublicHome,
  children
}: {
  page: Page;
  setPage: (page: Page) => void;
  role?: DashboardRole;
  locale: DashboardLocale;
  onLocaleChange: (locale: DashboardLocale) => void;
  onLogout?: () => void;
  onPublicHome?: () => void;
  children: ReactNode;
}) {
  const uiText = dashboardI18n[locale];
  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => pageAllowedForRole(item, role))
    }))
    .filter((section) => section.items.length > 0);
  const topActions = (
    <div className="top-actions dashboard-menu-actions">
      <DashboardLocaleSelector locale={locale} onLocaleChange={onLocaleChange} />
      {onPublicHome ? <button className="secondary top-action" onClick={onPublicHome} data-ko={dashboardI18n.ko.app.publicHome} data-ja={dashboardI18n.ja.app.publicHome}>{uiText.app.publicHome}</button> : null}
      {onLogout ? <button className="secondary top-action" onClick={onLogout} data-ko={dashboardI18n.ko.app.logout} data-ja={dashboardI18n.ja.app.logout}>{uiText.app.logout}</button> : null}
      <span className="top-chip" data-ko={dashboardI18n.ko.app.liveSafety} data-ja={dashboardI18n.ja.app.liveSafety}>{uiText.app.liveSafety}</span>
    </div>
  );

  return (
    <div className={`app-shell app-shell-${page}`} data-locale={locale} data-page={page} lang={locale === "ja" ? "ja" : "ko"}>
      <aside className="app-sidebar">
        <div className="brand-block">
          <img className="brand-logo" src="/images/yorogg-topbar-logo.webp" alt="YORO.gg" />
        </div>
        <div className="sidebar-profile">
          <span data-ko={dashboardI18n.ko.app.workspaceKicker} data-ja={dashboardI18n.ja.app.workspaceKicker}>{uiText.app.workspaceKicker}</span>
          <strong data-ko={dashboardI18n.ko.app.workspaceLabel} data-ja={dashboardI18n.ja.app.workspaceLabel}>{uiText.app.workspaceLabel}</strong>
          <p data-ko={dashboardI18n.ko.app.workspaceDescription} data-ja={dashboardI18n.ja.app.workspaceDescription}>{uiText.app.workspaceDescription}</p>
        </div>
        <nav aria-label={uiText.app.navLabel}>
          {visibleNavSections.map((section) => (
            <div className="nav-group" key={section.key}>
              <div
                className="nav-section-title"
                data-ko={dashboardI18n.ko.app.navGroups[section.key]}
                data-ja={dashboardI18n.ja.app.navGroups[section.key]}
              >
                {uiText.app.navGroups[section.key]}
              </div>
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
                    <span data-ko={dashboardI18n.ko.pages[item].label} data-ja={dashboardI18n.ja.pages[item].label}>{uiText.pages[item].label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        {topActions}
      </aside>
      <main className="app-main">
        <section className="content-shell">{children}</section>
      </main>
    </div>
  );
}
