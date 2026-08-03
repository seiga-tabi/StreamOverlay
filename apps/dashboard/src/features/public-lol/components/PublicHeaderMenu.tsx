import { publicI18n, t } from "../i18n/public-lol-i18n";
import type { PublicMainPage, PublicNavTarget } from "../types/public-lol";
import { PublicHorizontalNav } from "../../../shared/PublicGameChrome";

export type PublicHeaderMenuProps = {
  activePage: PublicMainPage;
  activeTarget: PublicNavTarget;
  onPage: (page: PublicMainPage) => void;
};

type HeaderMenuItem = {
  icon: "home" | "streamers" | "participation" | "aram" | "community";
  page: PublicMainPage;
  pages: PublicMainPage[];
  ko: string;
  ja: string;
  label: string;
};

function PublicHeaderMenuIcon({ icon }: { icon: HeaderMenuItem["icon"] }) {
  const paths = {
    home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z" />,
    streamers: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-2.5A5.5 5.5 0 0 1 9 12h1a5.5 5.5 0 0 1 5.5 5.5V20M16 7a3 3 0 0 1 0 6M17 14a4 4 0 0 1 4 4v2" /></>,
    participation: <><circle cx="12" cy="7" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2M4 9H1m1.5-1.5v3M23 9h-3m1.5-1.5v3" /></>,
    aram: <><path d="M5 12h14M12 5v14M7 7l10 10M17 7 7 17" /><circle cx="12" cy="12" r="9" /></>,
    community: <><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M2 20v-2a6 6 0 0 1 12 0v2M10 20v-2a6 6 0 0 1 12 0v2" /></>,
  } satisfies Record<HeaderMenuItem["icon"], JSX.Element>;

  return (
    <svg
      aria-hidden="true"
      className="public-header-menu-icon"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[icon]}
    </svg>
  );
}

export function PublicHeaderMenu({
  activePage,
  activeTarget,
  onPage
}: PublicHeaderMenuProps) {
  const items: HeaderMenuItem[] = [
    {
      icon: "home",
      page: activePage === "palworld" ? "palworld" : "search",
      pages: ["search", "palworld"],
      ko: publicI18n.ko.home,
      ja: publicI18n.ja.home,
      label: t().home
    },
    {
      icon: "streamers",
      page: "subscriptions",
      pages: ["subscriptions"],
      ko: publicI18n.ko.streamersNav,
      ja: publicI18n.ja.streamersNav,
      label: t().streamersNav
    },
    {
      icon: "participation",
      page: "followJoin",
      pages: ["followJoin"],
      ko: publicI18n.ko.participationHeaderNav,
      ja: publicI18n.ja.participationHeaderNav,
      label: t().participationHeaderNav
    },
    {
      icon: "aram",
      page: "aram",
      pages: ["aram"],
      ko: publicI18n.ko.aramHeaderNav,
      ja: publicI18n.ja.aramHeaderNav,
      label: t().aramHeaderNav
    },
    {
      icon: "community",
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
    <PublicHorizontalNav ariaLabel={t().mainMenu} testId="lol-primary-nav">
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
            <PublicHeaderMenuIcon icon={item.icon} />
            <strong>{item.label}</strong>
          </button>
        );
      })}
    </PublicHorizontalNav>
  );
}
