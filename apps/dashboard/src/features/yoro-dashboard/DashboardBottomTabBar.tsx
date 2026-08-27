import type { DashboardLocale } from "../../i18n";
import {
  dashboardTopLevelNavItems,
  type DashboardTopLevelPage
} from "./DashboardChrome";

function DashboardNavIcon({ page }: { page: DashboardTopLevelPage }) {
  if (page === "overview") {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24">
        <path d="m4 11 8-7 8 7v9H4Z" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }
  if (page === "account") {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-4 2.8-6.5 7-6.5s7 2.5 7 6.5" />
      </svg>
    );
  }
  if (page === "organizations") {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24">
        <rect height="12" rx="1.5" width="18" x="3" y="4" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    );
  }
  if (page === "streaming") {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24">
        <rect height="12" rx="1.5" width="18" x="3" y="4" />
        <path d="m10 8 5 2-5 2Z" />
        <path d="M8 20h8" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

export function DashboardBottomTabBar({
  locale,
  page,
  onNavigate
}: {
  locale: DashboardLocale;
  page: DashboardTopLevelPage;
  onNavigate: (page: DashboardTopLevelPage) => void;
}) {
  return (
    <nav
      aria-label={locale === "ja" ? "Dashboardモバイルメニュー" : "Dashboard 모바일 메뉴"}
      className="public-bottom-tab-bar dashboard-bottom-tab-bar"
      data-testid="dashboard-bottom-tab-bar"
    >
      {dashboardTopLevelNavItems.map((item) => {
        const active = item.page === page;
        return (
          <button
            aria-current={active ? "page" : undefined}
            className={`public-bottom-tab-bar__item${active ? " active" : ""}`}
            data-ja={item.ja}
            data-ko={item.ko}
            key={item.page}
            onClick={() => onNavigate(item.page)}
            type="button"
          >
            <DashboardNavIcon page={item.page} />
            <span>{locale === "ja" ? item.ja : item.ko}</span>
          </button>
        );
      })}
    </nav>
  );
}
