import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import { gamesPathForPage, setGamesUrl, type GamesPage } from "../utils/routes";
import { gamesNavItems, GamesNavIcon } from "./GamesHeader";

export function GamesBottomTabBar({ locale, page }: {
  locale: GamesLocale;
  page: GamesPage | null;
}) {
  const text = gamesI18n[locale];
  return (
    <nav aria-label={text.mainMenu} className="public-bottom-tab-bar" data-testid="games-bottom-tab-bar">
      {gamesNavItems.map((item) => {
        const isActive = item.page === page;
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={`public-bottom-tab-bar__item ${isActive ? "active" : ""}`}
            data-ja={item.ja}
            data-ko={item.ko}
            key={item.page}
            onClick={() => setGamesUrl(gamesPathForPage(item.page))}
            type="button"
          >
            <GamesNavIcon page={item.page} />
            <span>{locale === "ja" ? item.ja : item.ko}</span>
          </button>
        );
      })}
    </nav>
  );
}
