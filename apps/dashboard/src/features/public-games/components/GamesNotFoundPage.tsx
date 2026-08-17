import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import { setGamesUrl } from "../utils/routes";

export function GamesNotFoundPage({ locale }: { locale: GamesLocale }) {
  const text = gamesI18n[locale];
  return (
    <div className="games-notfound">
      <strong>{text.notFoundTitle}</strong>
      <p>{text.notFoundDescription}</p>
      <button className="games-btn" onClick={() => setGamesUrl("/games")} type="button">{text.notFoundCta}</button>
    </div>
  );
}
