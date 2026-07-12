import type { PointerEvent } from "react";
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
  const searchItem: { key: PublicMainPage; icon: string; ko: string; ja: string; label: string } = {
    key: "search",
    icon: "⌕",
    ko: publicI18n.ko.searchNav,
    ja: publicI18n.ja.searchNav,
    label: t().searchNav
  };
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

  const handleMobilePointerPage = (page: PublicMainPage, event: PointerEvent<HTMLButtonElement>) => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    event.preventDefault();
    event.stopPropagation();
    onPage(page);
  };

  return (
    <nav className="public-header-nav" aria-label="YORO.gg">
      <button className={activePage === "search" && activeTarget === "search" ? "active" : ""} type="button" onPointerDown={(event) => handleMobilePointerPage("search", event)} onClick={() => onPage("search")}>
        <span aria-hidden="true">{searchItem.icon}</span>
        <strong data-ko={searchItem.ko} data-ja={searchItem.ja}>{searchItem.label}</strong>
      </button>
      <div className="public-header-menu-item">
        <button
          className={contentPages.includes(activePage) ? "active" : ""}
          type="button"
          aria-haspopup="menu"
          onPointerDown={(event) => handleMobilePointerPage("tournamentCalendar", event)}
          onClick={() => onPage("tournamentCalendar")}
        >
          <span aria-hidden="true">▦</span>
          <strong data-ko={publicI18n.ko.contentMenu} data-ja={publicI18n.ja.contentMenu}>{t().contentMenu}</strong>
        </button>
        <div className="public-header-submenu" role="menu" aria-label={t().contentMenu}>
          {contentItems.map((item) => (
            <button className={activePage === item.page ? "active" : ""} type="button" role="menuitem" onPointerDown={(event) => handleMobilePointerPage(item.page, event)} onClick={() => onPage(item.page)} key={item.page}>
              <span aria-hidden="true">{item.icon}</span>
              <strong data-ko={item.ko} data-ja={item.ja}>{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
      <div className="public-header-menu-item">
        <button
          className={communityPages.includes(activePage) ? "active" : ""}
          type="button"
          aria-haspopup="menu"
          onPointerDown={(event) => handleMobilePointerPage("patch", event)}
          onClick={() => onPage("patch")}
        >
          <span aria-hidden="true">▣</span>
          <strong data-ko={publicI18n.ko.community} data-ja={publicI18n.ja.community}>{t().community}</strong>
        </button>
        <div className="public-header-submenu" role="menu" aria-label={t().community}>
          {communityItems.map((item) => (
            <button className={activePage === item.page ? "active" : ""} type="button" role="menuitem" onPointerDown={(event) => handleMobilePointerPage(item.page, event)} onClick={() => onPage(item.page)} key={item.page}>
              <span aria-hidden="true">{item.icon}</span>
              <strong data-ko={item.ko} data-ja={item.ja}>{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
      <div className="public-header-menu-item">
        <button
          className={followPages.includes(activePage) ? "active" : ""}
          type="button"
          aria-haspopup="menu"
          onPointerDown={(event) => handleMobilePointerPage(showSubscriptions ? "subscriptions" : "followJoin", event)}
          onClick={() => onPage(showSubscriptions ? "subscriptions" : "followJoin")}
        >
          <span aria-hidden="true">◆</span>
          <strong data-ko={publicI18n.ko.followMenu} data-ja={publicI18n.ja.followMenu}>{t().followMenu}</strong>
        </button>
        <div className="public-header-submenu" role="menu" aria-label={t().followMenu}>
          {followItems.map((item) => (
            <button className={activePage === item.page ? "active" : ""} type="button" role="menuitem" onPointerDown={(event) => handleMobilePointerPage(item.page, event)} onClick={() => onPage(item.page)} key={item.page}>
              <span aria-hidden="true">{item.icon}</span>
              <strong data-ko={item.ko} data-ja={item.ja}>{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
