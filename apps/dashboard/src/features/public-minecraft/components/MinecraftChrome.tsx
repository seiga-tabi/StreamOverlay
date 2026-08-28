import type { MouseEvent } from "react";
import { AppShellHeader } from "../../../shared/ui/AppShell";
import { HomeHeader } from "../../public-home/components/HomeHeader";
import { TailUnderline } from "../../public-home/components/HomeMarks";
import { homeI18n } from "../../public-home/i18n/home-i18n";
import { publicContentLocale } from "../../public-lol/i18n/public-lol-i18n";
import { localizedPublicUrl } from "../../public-lol/utils/public-locale-path";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { minecraftPathForPage, setMinecraftUrl, type MinecraftPage } from "../utils/routes";
import { minecraftNavItems } from "./MinecraftHeader";

/* 마인크래프트 상단바 한 벌 — 메인 홈과 같은 1행(HomeHeader) + 마인크래프트 2행 메뉴.
 * PalworldChrome/ValorantChrome과 같은 조립 문법(LoL/Palworld/Valorant는 이미
 * 이 크롬으로 전환됨 — 마인크래프트만 구형 MinecraftHeader/PublicGameHeaderFrame이
 * 남아 있던 결함 수정, 2026-08-28). 2행은 공용 .yoro-lol-subnav 클래스를 그대로
 * 재사용하고, 항목 원본(minecraftNavItems)은 MinecraftHeader.tsx에 남겨
 * MinecraftBottomTabBar와 계속 공유합니다. */

const SUBNAV_TAIL_WIDTH: Record<MinecraftPage, number> = {
  home: 30,
  recipes: 36,
  items: 30,
  enchants: 36,
  library: 30,
  patchNotes: 44
};

export function MinecraftSubnav({ locale, page }: {
  locale: MinecraftLocale;
  page: MinecraftPage | null;
}) {
  return (
    <nav aria-label={minecraftI18n[locale].mainMenu} className="yoro-lol-subnav">
      {minecraftNavItems.map((item) => {
        const active = item.page === page;
        const href = localizedPublicUrl(minecraftPathForPage(item.page), locale);
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
              setMinecraftUrl(minecraftPathForPage(item.page));
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

export function MinecraftChrome({
  page,
  locale,
  accountName,
  connected,
  onLocale,
  onLoginOpen,
  onLogout,
  onToggleTheme,
}: {
  page: MinecraftPage | null;
  locale: MinecraftLocale;
  accountName?: string;
  connected: boolean;
  onLocale: (locale: MinecraftLocale) => void;
  onLoginOpen: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
}) {
  return (
    <AppShellHeader as="div" className="yoro-home-chrome minecraft-chrome">
      <HomeHeader
        accountName={accountName}
        activeGame="minecraft"
        connected={connected}
        locale={locale}
        onDashboard={() => window.location.assign("/dashboard")}
        onLocale={(nextLocale) => onLocale(publicContentLocale(nextLocale))}
        onLoginOpen={onLoginOpen}
        onLogout={onLogout}
        onToggleTheme={onToggleTheme}
        text={homeI18n[locale]}
      />
      <MinecraftSubnav locale={locale} page={page} />
    </AppShellHeader>
  );
}
