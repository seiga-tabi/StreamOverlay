import type { MouseEvent } from "react";
import { AppShellHeader } from "../../../shared/ui/AppShell";
import { HomeHeader } from "../../public-home/components/HomeHeader";
import { TailUnderline } from "../../public-home/components/HomeMarks";
import { homeI18n } from "../../public-home/i18n/home-i18n";
import { publicContentLocale } from "../../public-lol/i18n/public-lol-i18n";
import { localizedPublicUrl } from "../../public-lol/utils/public-locale-path";
import { valorantI18n, type ValorantLocale } from "../i18n/valorant-i18n";
import { setValorantUrl, valorantPathForPage, type ValorantPage } from "../utils/routes";
import { valorantNavItems } from "./ValorantHeader";

/* 발로란트 상단바 한 벌 — 메인 홈과 같은 1행(HomeHeader) + 발로란트 2행 메뉴.
 * PalworldChrome과 같은 조립 문법을 사용하고, 2행은 공용
 * .yoro-lol-subnav 클래스를 그대로 재사용합니다. */

const SUBNAV_TAIL_WIDTH: Record<ValorantPage, number> = {
  home: 30,
  agents: 36,
  weapons: 36,
  maps: 30,
  ranked: 36,
};

export function ValorantSubnav({ locale, page }: {
  locale: ValorantLocale;
  page: ValorantPage | null;
}) {
  return (
    <nav aria-label={valorantI18n[locale].mainMenu} className="yoro-lol-subnav">
      {valorantNavItems.map((item) => {
        const active = item.page === page;
        const href = localizedPublicUrl(valorantPathForPage(item.page), locale);
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
              setValorantUrl(valorantPathForPage(item.page));
            }}
          >
            {valorantI18n[locale][item.page]}
            {active ? <TailUnderline className="yoro-lol-subnav-tail" height={6} width={SUBNAV_TAIL_WIDTH[item.page]} /> : null}
          </a>
        );
      })}
    </nav>
  );
}

export function ValorantChrome({
  page,
  locale,
  accountName,
  connected,
  onLocale,
  onLoginOpen,
  onLogout,
  onToggleTheme,
}: {
  page: ValorantPage | null;
  locale: ValorantLocale;
  accountName?: string;
  connected: boolean;
  onLocale: (locale: ValorantLocale) => void;
  onLoginOpen: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
}) {
  return (
    <AppShellHeader as="div" className="yoro-home-chrome valorant-chrome">
      <HomeHeader
        accountName={accountName}
        activeGame="valorant"
        connected={connected}
        locale={locale}
        onDashboard={() => window.location.assign("/dashboard")}
        onLocale={(nextLocale) => onLocale(publicContentLocale(nextLocale))}
        onLoginOpen={onLoginOpen}
        onLogout={onLogout}
        onToggleTheme={onToggleTheme}
        text={homeI18n[locale]}
      />
      <ValorantSubnav locale={locale} page={page} />
    </AppShellHeader>
  );
}
