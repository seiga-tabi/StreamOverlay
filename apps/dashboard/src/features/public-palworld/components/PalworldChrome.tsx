import type { MouseEvent, ReactNode } from "react";
import { AppShellHeader } from "../../../shared/ui/AppShell";
import { HomeHeader } from "../../public-home/components/HomeHeader";
import { TailUnderline } from "../../public-home/components/HomeMarks";
import { homeI18n } from "../../public-home/i18n/home-i18n";
import { localizedPublicUrl } from "../../public-lol/utils/public-locale-path";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { palworldPathForPage, setPalworldUrl, type PalworldPage } from "../utils/routes";
import { isPalworldNavItemActive, palworldNavItems } from "./PalworldHeader";

/* 팰월드 상단바 한 벌 — 메인 홈과 같은 1행(HomeHeader) + 팰월드 2행 메뉴.
 * LolChrome 과 같은 조립 문법(사용자 요청 2026-08-22: 팰월드 홈도 메인 홈
 * 상단바와 동일하게). 1행 규격은 docs/handoffs/2026-08-21-app-header-shared-prompt.md
 * 가 단일 원본이고, 2행은 LolSubnav 의 수묵 문법(.yoro-lol-subnav — 크롬 공용
 * 클래스로 재사용)을 팰월드 메뉴(palworldNavItems 단일 원본)로 채웁니다. */

/* 꼬리 밑줄 폭 — LolSubnav 와 같은 항목별 상수(라벨 폭 비례). */
const SUBNAV_TAIL_WIDTH: Record<Exclude<PalworldPage, "search">, number> = {
  home: 30,
  pals: 44,
  breeding: 48,
  items: 36,
  technology: 48,
  skills: 30,
  map: 30
};

export function PalworldSubnav({ locale, page }: {
  locale: PalworldLocale;
  page: PalworldPage;
}) {
  return (
    <nav aria-label={palworldI18n[locale].mainMenu} className="yoro-lol-subnav">
      {palworldNavItems.map((item) => {
        const active = isPalworldNavItemActive(item.page, page);
        const href = localizedPublicUrl(palworldPathForPage(item.page), locale);
        return (
          <a
            aria-current={active ? "page" : undefined}
            className={`yoro-lol-subnav-item${active ? " is-active" : ""}`}
            data-ja={item.ja}
            data-ko={item.ko}
            href={href}
            key={item.page}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              setPalworldUrl(palworldPathForPage(item.page));
            }}
          >
            {palworldI18n[locale][item.page]}
            {active ? <TailUnderline className="yoro-lol-subnav-tail" height={6} width={SUBNAV_TAIL_WIDTH[item.page]} /> : null}
          </a>
        );
      })}
    </nav>
  );
}

export function PalworldChrome({
  page,
  locale,
  accountName,
  connected,
  searchSlot,
  onLocale,
  onLoginOpen,
  onLogout,
  onToggleTheme
}: {
  page: PalworldPage;
  locale: PalworldLocale;
  accountName?: string;
  connected: boolean;
  /* 하위 페이지의 컴팩트 검색바 — HomeHeader searchSlot 로 그대로 전달(홈은 없음). */
  searchSlot?: ReactNode;
  onLocale: (locale: PalworldLocale) => void;
  onLoginOpen: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
}) {
  return (
    <AppShellHeader as="div" className="yoro-home-chrome palworld-chrome">
      <HomeHeader
        accountName={accountName}
        activeGame="palworld"
        connected={connected}
        locale={locale}
        onDashboard={() => window.location.assign("/dashboard")}
        onLocale={onLocale}
        onLoginOpen={onLoginOpen}
        onLogout={onLogout}
        onToggleTheme={onToggleTheme}
        searchSlot={searchSlot ? <div className="yoro-home-header-search">{searchSlot}</div> : undefined}
        text={homeI18n[locale]}
      />
      <PalworldSubnav locale={locale} page={page} />
    </AppShellHeader>
  );
}
