import { useState } from "react";
import { dashboardI18n, type DashboardLocale } from "../i18n";
import {
  ADMIN_ALLOWED_PAGES,
  dashboardPathForPage,
  pagePermitted,
  pageVisible,
  type Page
} from "../routing/dashboard-routes";

/* 관리자 콘솔 상단바 — 1행(워드마크+ADMIN 킥커 / 계정칩+로그아웃) + 2행(중앙 정렬
 * 서브네비, 활성 항목 밑줄). 승인된 스펙 스냅샷:
 * .ai/growth/design-snapshots/admin-console-redesign-v3-2026-08-31.md
 *
 * 시각 문법은 메인 홈의 yoro-home-header / yoro-lol-subnav 규격을 그대로 따르되
 * 컴포넌트는 공유하지 않습니다 — 관리자 콘솔에는 로그인·공개 사이트 내비게이션이
 * 없고 계정칩과 로그아웃만 필요해서 HomeHeader 의 props 와 맞지 않습니다.
 * 스타일은 styles/pages/account/33-admin-console.css 의 .yoro-admin-* 참조. */

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

function permissionLabelFor(locale: DashboardLocale, permission: string): string | undefined {
  const labels = dashboardI18n[locale].app.permissionLabels as Record<string, string | undefined>;
  return labels[permission];
}

/* 권한 태그: full_admin(permissions === undefined)은 "전체 권한"(승색), 서브 계정은
   권한 하나면 그 이름을, 여럿이거나 이름을 모르는 키면 개수로 요약합니다(중간톤). */
function permissionTagText(locale: DashboardLocale, permissions?: readonly string[]): string {
  const text = dashboardI18n[locale].app;
  if (!permissions) return text.permissionFull;
  const only = permissions.length === 1 ? permissions[0] : undefined;
  if (only !== undefined) {
    const label = permissionLabelFor(locale, only);
    if (label) return label;
  }
  return text.permissionCount.replace("{count}", String(permissions.length));
}

function accountInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "A";
}

export function AdminConsoleChrome({
  page,
  setPage,
  locale,
  onLocaleChange,
  onLogout,
  onPublicHome,
  permissions,
  accountLabel
}: {
  page: Page;
  setPage: (page: Page) => void;
  locale: DashboardLocale;
  onLocaleChange: (locale: DashboardLocale) => void;
  onLogout?: () => void;
  onPublicHome?: () => void;
  permissions?: readonly string[];
  accountLabel?: string;
}) {
  const uiText = dashboardI18n[locale];
  const accountName = accountLabel?.trim() || uiText.app.adminAccountFallback;
  const permissionTag = permissionTagText(locale, permissions);
  const lockedTitle = uiText.app.permissionLocked;
  const navItems = ADMIN_ALLOWED_PAGES.filter((item) => pageVisible(item, permissions));

  const wordmark = (
    <>
      YORO<span>.gg</span>
    </>
  );

  return (
    <div className="yoro-admin-chrome">
      <header className="yoro-admin-header">
        {/* 공개 사이트로 돌아가는 유일한 출구입니다 — 스펙의 1행에는 별도
            내비게이션이 없어 워드마크가 그 역할을 겸합니다. */}
        {onPublicHome ? (
          <button
            className="yoro-admin-wordmark"
            data-ja-title={dashboardI18n.ja.app.publicHome}
            data-ko-title={dashboardI18n.ko.app.publicHome}
            onClick={onPublicHome}
            title={uiText.app.publicHome}
            type="button"
          >
            {wordmark}
          </button>
        ) : (
          <span className="yoro-admin-wordmark">{wordmark}</span>
        )}
        <span className="yoro-admin-kicker">ADMIN</span>

        <div className="yoro-admin-header-actions">
          <DashboardLocaleSelector locale={locale} onLocaleChange={onLocaleChange} />
          <span className="yoro-admin-account">
            <span aria-hidden="true" className="yoro-admin-avatar">{accountInitial(accountName)}</span>
            <span className="yoro-admin-account-name">{accountName}</span>
            <span className={`yoro-admin-permission${permissions ? " is-partial" : " is-full"}`}>
              {permissionTag}
            </span>
          </span>
          {onLogout ? (
            <button
              className="yoro-admin-logout"
              data-ja={dashboardI18n.ja.app.logout}
              data-ko={dashboardI18n.ko.app.logout}
              onClick={onLogout}
              type="button"
            >
              {uiText.app.logout}
            </button>
          ) : null}
        </div>
      </header>

      <nav aria-label={uiText.app.adminNavLabel} className="yoro-admin-subnav">
        {navItems.map((item) => {
          const active = item === page;
          const permitted = pagePermitted(item, permissions);
          const label = (
            <span data-ja={dashboardI18n.ja.pages[item].nav} data-ko={dashboardI18n.ko.pages[item].nav}>
              {uiText.pages[item].nav}
            </span>
          );
          if (!permitted) {
            /* disabled 버튼은 포커스를 받지 못해 안내(title)에 키보드로 닿을 수
               없습니다. aria-disabled 로 알리고 클릭만 무시합니다. */
            return (
              <button
                aria-disabled="true"
                className="yoro-admin-subnav-item is-locked"
                data-ja-title={dashboardI18n.ja.app.permissionLocked}
                data-ko-title={dashboardI18n.ko.app.permissionLocked}
                key={item}
                onClick={(event) => event.preventDefault()}
                title={lockedTitle}
                type="button"
              >
                <span aria-hidden="true" className="yoro-admin-lock-dot" />
                {label}
              </button>
            );
          }
          return (
            <a
              aria-current={active ? "page" : undefined}
              className={`yoro-admin-subnav-item${active ? " is-active" : ""}`}
              href={dashboardPathForPage(item)}
              key={item}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                setPage(item);
              }}
            >
              {label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
