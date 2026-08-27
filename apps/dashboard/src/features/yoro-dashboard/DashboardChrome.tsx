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

const dashboardHeaderText = {
  ko: { publicHome: "공개 홈", mainMenu: "Dashboard 메뉴" },
  ja: { publicHome: "公開ホーム", mainMenu: "Dashboardメニュー" }
} as const;

/* 2행 그룹 서브내비 안의 "현재 위치" 판정. Organization/스트리머 그룹은
   하위 페이지(예: organizationBot, streamingFollowers)에 있을 때도 해당
   그룹 탭이 active로 보여야 하므로, YoroDashboardPage의 세부 page 값을
   최상위 그룹으로 접어 넘겨받습니다(그룹 판정 로직은 그대로 재사용). */
const SUBNAV_TAIL_WIDTH: Record<DashboardTopLevelPage, number> = {
  overview: 24,
  account: 46,
  organizations: 72,
  streaming: 46,
  settings: 46,
};

export function DashboardSubnav({ locale, activeGroup, onNavigate }: {
  locale: DashboardLocale;
  activeGroup: DashboardTopLevelPage | null;
  onNavigate: (page: DashboardTopLevelPage) => void;
}) {
  return (
    <nav aria-label={dashboardHeaderText[locale].mainMenu} className="yoro-lol-subnav">
      {dashboardTopLevelNavItems.map((item) => {
        const active = item.page === activeGroup;
        return (
          <a
            aria-current={active ? "page" : undefined}
            className={`yoro-lol-subnav-item${active ? " is-active" : ""}`}
            data-ja={item.ja}
            data-ko={item.ko}
            href={item.href}
            key={item.page}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate(item.page);
            }}
          >
            {locale === "ja" ? item.ja : item.ko}
            {active ? <TailUnderline className="yoro-lol-subnav-tail" height={6} width={SUBNAV_TAIL_WIDTH[item.page]} /> : null}
          </a>
        );
      })}
    </nav>
  );
}

/* Dashboard 상단바는 1행(HomeHeader, 메인 홈과 완전히 동일한 컴포넌트 재사용 —
 * 지구본 아이콘 언어 선택도 포함) + 2행(DashboardSubnav, 사이드바 최상위 5개
 * 그룹을 이동)으로 구성합니다. 좌측 groupnav(사이드바)는 각 그룹의 하위 항목
 * (Organization/스트리머 세부 메뉴, 개인 설정)만 남기고, 최상위 그룹 자체의
 * 진입점은 여기 2행이 담당합니다(2026-08-27 사용자 요청 — "사이드바 메뉴를
 * 상단 2행으로 옮기고"). 모바일 하단 탭바(DashboardBottomTabBar)는 계속
 * dashboardTopLevelNavItems/DashboardTopLevelPage를 재사용합니다. */
export function DashboardChrome({
  page,
  accountName,
  locale,
  onLocale,
  onLogout,
  onNavigate,
  onPublicHome,
  onToggleTheme
}: {
  page: DashboardTopLevelPage | null;
  accountName?: string;
  locale: DashboardLocale;
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
      <DashboardSubnav activeGroup={page} locale={locale} onNavigate={onNavigate} />
    </AppShellHeader>
  );
}
