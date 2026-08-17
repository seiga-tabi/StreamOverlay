import { useMemo } from "react";
import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import {
  MINI_GAMES,
  miniGameDescription,
  miniGameName,
  readMiniGameBest,
  reactionTierLabel,
  REACTION_TIER_TABLE,
} from "../registry";
import { setGamesUrl } from "../utils/routes";

/* 미니게임 허브 — 목업 reaction-test.html v3 §③. 레지스트리(MINI_GAMES)가 그리는
 * 카드 그리드: live 카드 = 내 최고 기록 + CTA, coming 카드 = 대시 테두리·비활성. */
export function GamesHub({ locale }: { locale: GamesLocale }) {
  const text = gamesI18n[locale];
  const bests = useMemo(() => new Map(MINI_GAMES.map((game) => [game.id, readMiniGameBest(game.id)])), []);

  return (
    <div className="games-hub">
      <div className="games-hero">
        <h1>{text.hubTitle}</h1>
        <p>{text.hubSubtitle}</p>
      </div>
      <div className="games-hub-grid">
        {MINI_GAMES.map((game) => {
          const best = bests.get(game.id) ?? null;
          const bestTier = best?.tierKey ? REACTION_TIER_TABLE.find((tier) => tier.key === best.tierKey) : undefined;
          if (game.status === "coming") {
            return (
              <article className="games-card is-coming" key={game.id}>
                <span className="games-card-badge is-soon">{text.comingSoon}</span>
                <div aria-hidden="true" className="games-card-art">{game.icon}</div>
                <div className="games-card-body">
                  <b>{miniGameName(game, locale)}</b>
                  <small>{miniGameDescription(game, locale)}</small>
                  <div className="games-card-meta"><span className="games-card-soon">{text.comingSoonNote}</span></div>
                </div>
              </article>
            );
          }
          return (
            <article className="games-card" key={game.id}>
              <span className="games-card-badge is-new">{text.newBadge}</span>
              <div aria-hidden="true" className="games-card-art">{game.icon}</div>
              <div className="games-card-body">
                <b>{miniGameName(game, locale)}</b>
                <small>{miniGameDescription(game, locale)}</small>
                <div className="games-card-meta">
                  {best ? (
                    <span className="games-card-record">
                      {text.myBest} <b>{Math.round(best.score)}ms{bestTier ? ` · ${reactionTierLabel(bestTier, locale)}` : ""}</b>
                    </span>
                  ) : null}
                  <button className="games-card-cta" onClick={() => game.path && setGamesUrl(game.path)} type="button">
                    {text.challenge}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        <article className="games-card is-coming">
          <span className="games-card-badge is-soon">{text.comingSoon}</span>
          <div aria-hidden="true" className="games-card-art">🎯</div>
          <div className="games-card-body">
            <b>{text.teaserTitle}</b>
            <small>{text.teaserDescription}</small>
          </div>
        </article>
      </div>
    </div>
  );
}
