import { publicI18n, t } from "../i18n/public-lol-i18n";
import type { PublicMainPage, PublicNavTarget } from "../types/public-lol";

export type PublicHeaderMenuProps = {
  activePage: PublicMainPage;
  activeTarget: PublicNavTarget;
  onPage: (page: PublicMainPage) => void;
};

type HeaderMenuItem = {
  page: PublicMainPage;
  pages: PublicMainPage[];
  ko: string;
  ja: string;
  label: string;
};

export function PublicHeaderMenu({
  activePage,
  activeTarget,
  onPage
}: PublicHeaderMenuProps) {
  const items: HeaderMenuItem[] = [
    {
      page: activePage === "palworld" ? "palworld" : "search",
      pages: ["search", "palworld"],
      ko: publicI18n.ko.home,
      ja: publicI18n.ja.home,
      label: t().home
    },
    {
      page: "subscriptions",
      pages: ["subscriptions"],
      ko: publicI18n.ko.streamersNav,
      ja: publicI18n.ja.streamersNav,
      label: t().streamersNav
    },
    {
      page: "followJoin",
      pages: ["followJoin"],
      ko: publicI18n.ko.participationNav,
      ja: publicI18n.ja.participationNav,
      label: t().participationNav
    },
    {
      page: "tournamentCalendar",
      pages: [
        "tournamentCalendar",
        "tournamentList",
        "tournamentNews",
        "tournamentTeams",
        "tournamentBracket",
        "tournamentSchedule"
      ],
      ko: publicI18n.ko.tournamentCalendar,
      ja: publicI18n.ja.tournamentCalendar,
      label: t().tournamentCalendar
    },
    {
      page: "patch",
      pages: [
        "patch",
        "communityParty",
        "communityServerWrite",
        "communityPartyWrite",
        "communityDetail"
      ],
      ko: publicI18n.ko.community,
      ja: publicI18n.ja.community,
      label: t().community
    }
  ];

  return (
    <nav className="public-header-nav" aria-label={t().mobileMenu}>
      {items.map((item) => {
        const isActive = item.pages.includes(activePage)
          && (item.page !== "search" || activeTarget === "search");

        return (
          <button
            className={isActive ? "active" : ""}
            type="button"
            aria-current={isActive ? "page" : undefined}
            data-ko={item.ko}
            data-ja={item.ja}
            onClick={() => onPage(item.page)}
            key={item.page}
          >
            <strong>{item.label}</strong>
          </button>
        );
      })}
    </nav>
  );
}
