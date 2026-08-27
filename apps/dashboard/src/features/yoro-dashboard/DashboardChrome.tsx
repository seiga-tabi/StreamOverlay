import type { MouseEvent } from "react";
import { AppShellHeader } from "../../shared/ui/AppShell";
import { HomeHeader } from "../public-home/components/HomeHeader";
import { TailUnderline } from "../public-home/components/HomeMarks";
import { homeI18n } from "../public-home/i18n/home-i18n";
import type { DashboardLocale } from "../../i18n";

export type DashboardTopLevelPage =
  | "overview"
  | "account"
  | "organizations"
  | "streaming"
  | "settings";

export const dashboardTopLevelNavItems: ReadonlyArray<{
  page: DashboardTopLevelPage;
  ko: string;
  ja: string;
  href: string;
}> = [
  { page: "overview", ko: "홈", ja: "ホーム", href: "/dashboard" },
  { page: "account", ko: "연결 계정", ja: "連携アカウント", href: "/dashboard/account" },
  { page: "organizations", ko: "Organization", ja: "Organization", href: "/dashboard/organizations" },
  { page: "streaming", ko: "스트리머", ja: "ストリーマー", href: "/dashboard/streaming" },
  { page: "settings", ko: "개인 설정", ja: "個人設定", href: "/dashboard/settings" }
];

const SUBNAV_TAIL_WIDTH: Record<DashboardTopLevelPage, number> = {
  overview: 30,
  account: 48,
  organizations: 72,
  streaming: 48,
  settings: 48
};

const dashboardHeaderText = {
  ko: { publicHome: "공개 홈" },
  ja: { publicHome: "公開ホーム" }
} as const;

export function DashboardSubnav({
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
      aria-label={locale === "ja" ? "Dashboardメインメニュー" : "Dashboard 주요 메뉴"}
      className="yoro-lol-subnav dashboard-subnav"
    >
      {dashboardTopLevelNavItems.map((item) => {
        const active = item.page === page;
        return (
          <a
            aria-current={active ? "page" : undefined}
            className={`yoro-lol-subnav-item${active ? " is-active" : ""}`}
            data-ja={item.ja}
            data-ko={item.ko}
            href={item.href}
            key={item.page}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate(item.page);
            }}
          >
            {locale === "ja" ? item.ja : item.ko}
            {active ? (
              <TailUnderline
                className="yoro-lol-subnav-tail"
                height={6}
                width={SUBNAV_TAIL_WIDTH[item.page]}
              />
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}

export function DashboardChrome({
  page,
  locale,
  accountName,
  onLocale,
  onLogout,
  onNavigate,
  onPublicHome,
  onToggleTheme
}: {
  page: DashboardTopLevelPage;
  locale: DashboardLocale;
  accountName?: string;
  onLocale: (locale: DashboardLocale) => void;
  onLogout: () => void;
  onNavigate: (page: DashboardTopLevelPage) => void;
  onPublicHome: () => void;
  onToggleTheme: () => void;
}) {
  const homeText = {
    ...homeI18n[locale],
    navDashboard: dashboardHeaderText[locale].publicHome
  };

  return (
    <AppShellHeader as="div" className="yoro-home-chrome dashboard-chrome">
      <HomeHeader
        accountName={accountName}
        connected
        locale={locale}
        onDashboard={onPublicHome}
        onLocale={(nextLocale) => onLocale(nextLocale === "ja" ? "ja" : "ko")}
        onLoginOpen={() => undefined}
        onLogout={onLogout}
        onToggleTheme={onToggleTheme}
        text={homeText}
      />
      <DashboardSubnav locale={locale} onNavigate={onNavigate} page={page} />
    </AppShellHeader>
  );
}
