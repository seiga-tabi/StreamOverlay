import { AppShellHeader } from "../../shared/ui/AppShell";
import { HomeHeader } from "../public-home/components/HomeHeader";
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
  ko: { publicHome: "공개 홈" },
  ja: { publicHome: "公開ホーム" }
} as const;

/* Dashboard 상단바는 1행(HomeHeader)만 씁니다. 좌측 groupnav(사이드바)가
 * 이미 같은 5개 그룹 내비게이션을 담당하므로, 예전에 있던 2행 서브내비
 * (DashboardSubnav)는 같은 메뉴를 두 번 보여주는 중복이라 제거했습니다
 * (2026-08-26 사용자 피드백 — "상단바 메뉴와 사이드바 메뉴 두개가 있어서
 * 디자인상 이상한 문제"). 모바일 하단 탭바(DashboardBottomTabBar)는 계속
 * 이 파일의 dashboardTopLevelNavItems/DashboardTopLevelPage를 재사용합니다. */
export function DashboardChrome({
  accountName,
  locale,
  onLocale,
  onLogout,
  onPublicHome,
  onToggleTheme
}: {
  accountName?: string;
  locale: DashboardLocale;
  onLocale: (locale: DashboardLocale) => void;
  onLogout: () => void;
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
    </AppShellHeader>
  );
}
