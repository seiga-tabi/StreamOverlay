import { type ReactNode } from "react";
import { AdminConsoleChrome } from "./AdminConsoleChrome";
import { type DashboardLocale } from "../i18n";
import { type Page } from "../routing/dashboard-routes";

export type { Page } from "../routing/dashboard-routes";

/* 관리자 콘솔 셸 — 좌측 사이드바(app-sidebar/nav-group)를 걷어내고 메인 홈과 같은
   1행+2행 상단바로 바꿨습니다(admin-console-redesign-v3 승인 스펙).
   .yoro-admin-shell 이 홈 토큰(--home-*)을 다크 값으로 선언하는 스코프이고,
   app-shell 은 legacy 의 일본어 서체 규칙(.app-shell[data-locale="ja"])과 본문
   페이지 스타일을 계속 쓰기 위해 함께 답니다. */
export function Layout({
  page,
  setPage,
  locale,
  onLocaleChange,
  onLogout,
  onPublicHome,
  permissions,
  accountLabel,
  children
}: {
  page: Page;
  setPage: (page: Page) => void;
  locale: DashboardLocale;
  onLocaleChange: (locale: DashboardLocale) => void;
  onLogout?: () => void;
  onPublicHome?: () => void;
  permissions?: readonly string[];
  accountLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`yoro-admin-shell app-shell app-shell-${page}`}
      data-locale={locale}
      data-page={page}
      lang={locale === "ja" ? "ja" : "ko"}
    >
      <AdminConsoleChrome
        accountLabel={accountLabel}
        locale={locale}
        onLocaleChange={onLocaleChange}
        onLogout={onLogout}
        onPublicHome={onPublicHome}
        page={page}
        permissions={permissions}
        setPage={setPage}
      />
      <main className="app-main">
        <section className="content-shell">{children}</section>
      </main>
    </div>
  );
}
