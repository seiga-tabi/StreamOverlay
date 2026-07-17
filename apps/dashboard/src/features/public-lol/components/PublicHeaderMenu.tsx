import { useState } from "react";
import { publicI18n, t } from "../i18n/public-lol-i18n";
import type { PublicMainPage, PublicNavTarget } from "../types/public-lol";

export type PublicHeaderMenuProps = {
  activePage: PublicMainPage;
  activeTarget: PublicNavTarget;
  showSubscriptions: boolean;
  onPage: (page: PublicMainPage) => void;
};

export function PublicHeaderMenu({
  activePage,
  activeTarget,
  showSubscriptions,
  onPage
}: PublicHeaderMenuProps) {
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const searchPages: PublicMainPage[] = ["search", "palworld"];
  const searchItems: Array<{
    page: Extract<PublicMainPage, "search" | "palworld">;
    logo: string;
    ko: string;
    ja: string;
    label: string;
  }> = [
    {
      page: "search",
      logo: "/images/games/league-of-legends.png",
      ko: publicI18n.ko.leagueOfLegends,
      ja: publicI18n.ja.leagueOfLegends,
      label: t().leagueOfLegends
    },
    {
      page: "palworld",
      logo: "/images/games/palworld.png",
      ko: publicI18n.ko.palworld,
      ja: publicI18n.ja.palworld,
      label: t().palworld
    }
  ];
  const contentPages: PublicMainPage[] = ["tournamentCalendar", "tournamentList", "tournamentNews", "tournamentTeams", "tournamentBracket", "tournamentSchedule"];
  const contentItems: Array<{ page: PublicMainPage; icon: string; ko: string; ja: string; label: string }> = [
    { page: "tournamentCalendar", icon: "◷", ko: publicI18n.ko.tournamentCalendar, ja: publicI18n.ja.tournamentCalendar, label: t().tournamentCalendar },
    { page: "tournamentList", icon: "▣", ko: publicI18n.ko.tournamentList, ja: publicI18n.ja.tournamentList, label: t().tournamentList }
  ];
  const communityPages: PublicMainPage[] = ["patch", "communityParty", "communityServerWrite", "communityPartyWrite", "communityDetail"];
  const communityItems: Array<{ page: PublicMainPage; icon: string; ko: string; ja: string; label: string }> = [
    { page: "patch", icon: "▤", ko: publicI18n.ko.communityServerRecruit, ja: publicI18n.ja.communityServerRecruit, label: t().communityServerRecruit },
    { page: "communityParty", icon: "♙", ko: publicI18n.ko.communityPartyRecruit, ja: publicI18n.ja.communityPartyRecruit, label: t().communityPartyRecruit }
  ];
  const followPages: PublicMainPage[] = showSubscriptions ? ["subscriptions", "followJoin"] : ["followJoin"];
  const followItems: Array<{ page: PublicMainPage; icon: string; ko: string; ja: string; label: string }> = [
    ...(showSubscriptions ? [{ page: "subscriptions" as const, icon: "◆", ko: publicI18n.ko.subscriptionStatus, ja: publicI18n.ja.subscriptionStatus, label: t().subscriptionStatus }] : []),
    { page: "followJoin", icon: "＋", ko: publicI18n.ko.followJoin, ja: publicI18n.ja.followJoin, label: t().followJoin }
  ];

  return (
    <nav className="public-header-nav" aria-label="YORO.gg">
      <div
        className={`public-header-menu-item public-header-game-menu${gameMenuOpen ? " is-open" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setGameMenuOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setGameMenuOpen(false);
          }
        }}
      >
        <button
          className={searchPages.includes(activePage) && (activePage === "palworld" || activeTarget === "search") ? "active" : ""}
          type="button"
          aria-haspopup="menu"
          aria-expanded={gameMenuOpen}
          onClick={() => setGameMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">⌕</span>
          <strong>{t().searchNav}</strong>
        </button>
        <div className="public-header-submenu" role="menu" aria-label={t().gameSearchMenu}>
          {searchItems.map((item) => (
            <button
              className={activePage === item.page ? "active" : ""}
              type="button"
              role="menuitem"
              aria-current={activePage === item.page ? "page" : undefined}
              data-ko={item.ko}
              data-ja={item.ja}
              onClick={() => {
                setGameMenuOpen(false);
                onPage(item.page);
              }}
              key={item.page}
            >
              <img className="public-header-game-logo" src={item.logo} alt="" aria-hidden="true" />
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
      <div className="public-header-menu-item">
        <button
          className={contentPages.includes(activePage) ? "active" : ""}
          type="button"
          aria-haspopup="menu"
          onClick={() => onPage("tournamentCalendar")}
        >
          <span aria-hidden="true">▦</span>
          <strong  >{t().contentMenu}</strong>
        </button>
        <div className="public-header-submenu" role="menu" aria-label={t().contentMenu}>
          {contentItems.map((item) => (
            <button className={activePage === item.page ? "active" : ""} type="button" role="menuitem" onClick={() => onPage(item.page)} key={item.page}>
              <span aria-hidden="true">{item.icon}</span>
              <strong  >{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
      <div className="public-header-menu-item">
        <button
          className={communityPages.includes(activePage) ? "active" : ""}
          type="button"
          aria-haspopup="menu"
          onClick={() => onPage("patch")}
        >
          <span aria-hidden="true">▣</span>
          <strong  >{t().community}</strong>
        </button>
        <div className="public-header-submenu" role="menu" aria-label={t().community}>
          {communityItems.map((item) => (
            <button className={activePage === item.page ? "active" : ""} type="button" role="menuitem" onClick={() => onPage(item.page)} key={item.page}>
              <span aria-hidden="true">{item.icon}</span>
              <strong  >{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
      <div className="public-header-menu-item">
        <button
          className={followPages.includes(activePage) ? "active" : ""}
          type="button"
          aria-haspopup="menu"
          onClick={() => onPage(showSubscriptions ? "subscriptions" : "followJoin")}
        >
          <span aria-hidden="true">◆</span>
          <strong  >{t().followMenu}</strong>
        </button>
        <div className="public-header-submenu" role="menu" aria-label={t().followMenu}>
          {followItems.map((item) => (
            <button className={activePage === item.page ? "active" : ""} type="button" role="menuitem" onClick={() => onPage(item.page)} key={item.page}>
              <span aria-hidden="true">{item.icon}</span>
              <strong  >{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
