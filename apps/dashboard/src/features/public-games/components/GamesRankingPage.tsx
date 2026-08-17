import { useEffect, useMemo, useState } from "react";
import { fetchReactionLeaderboard, type ReactionLeaderboard, type ReactionLeaderboardEntry } from "../api";
import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import { MINI_GAMES, miniGameName, reactionTierLabel, REACTION_TIER_TABLE, syncMiniGameBestFromServer } from "../registry";
import { setGamesUrl } from "../utils/routes";
import { TierDot } from "./ReactionTest";

/* 랭킹 페이지 /games/ranking — 목업 reaction-test.html v6 §④-6.
 * TOP 3 포디움 → TOP 100 테이블 → 내 순위 고정 바 → 티어 분포.
 * 데이터는 리더보드 API 의 확장분(?limit=100 + total·tierDistribution)이며,
 * 확장분이 아직 없는 서버에서도 entries/me 만으로 동작합니다(부가 정보만 생략). */

const RANKING_LIMIT = 100;

function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function entryName(entry: ReactionLeaderboardEntry, locale: GamesLocale): string {
  const text = gamesI18n[locale];
  return entry.displayName ?? formatTemplate(text.leaderboardAnonymous, { label: entry.anonymousLabel ?? "" });
}

function EntryAvatar({ entry }: { entry: ReactionLeaderboardEntry }) {
  return (
    <i aria-hidden="true" className={entry.displayName ? "" : "is-mask"}>
      {entry.avatarUrl ? <img alt="" src={entry.avatarUrl} /> : entry.displayName ? entry.displayName.slice(0, 1).toUpperCase() : "🎭"}
    </i>
  );
}

/* 티어 표기 — 이모지 대신 색 dot 단일 배지(목업 v7.2 §⑥-1, 전 games 화면 공통). */
function EntryTier({ entry, locale }: { entry: ReactionLeaderboardEntry; locale: GamesLocale }) {
  const tier = entry.tierKey ? REACTION_TIER_TABLE.find((item) => item.key === entry.tierKey) : undefined;
  if (!tier) return null;
  return <><TierDot tier={tier} />{reactionTierLabel(tier, locale)}</>;
}

export function GamesRankingPage({ locale }: { locale: GamesLocale }) {
  const text = gamesI18n[locale];
  const [board, setBoard] = useState<ReactionLeaderboard | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchReactionLeaderboard(RANKING_LIMIT).then((result) => {
      if (!cancelled) setBoard(result);
      /* 계정 기록을 로컬 캐시에 합류 — 허브·프로필 배너가 읽는 값도 함께 최신화됩니다. */
      if (result?.me) {
        const reaction = MINI_GAMES.find((game) => game.id === "reaction")!;
        syncMiniGameBestFromServer(reaction, { score: result.me.averageMs, tierKey: result.me.tierKey });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const podium = board?.entries.slice(0, 3) ?? [];
  const rest = board?.entries.slice(3) ?? [];
  /* 내 순위 바의 "앞 순위와 -Nms" — 바로 앞 순위가 목록에 있을 때만 계산합니다. */
  const myDelta = useMemo(() => {
    if (!board?.me || board.me.rank <= 1) return undefined;
    const ahead = board.entries.find((entry) => entry.rank === board.me!.rank - 1);
    if (!ahead) return undefined;
    const delta = Math.round(board.me.averageMs - ahead.averageMs);
    return delta > 0 ? delta : undefined;
  }, [board]);
  const totalGames = board?.tierDistribution?.reduce((sum, item) => sum + item.count, 0) ?? 0;

  return (
    <div className="games-ranking" data-testid="games-ranking-page">
      <div className="games-hero">
        <div>
          <h1>{text.rankingTitle}</h1>
          <p>{text.rankingSubtitle}</p>
        </div>
      </div>

      {/* 게임 칩 — 레지스트리 기반(미니게임이 늘면 자동 확장). 현재 live 는 reaction 뿐. */}
      <div className="games-ranking-chips">
        {MINI_GAMES.map((game) => (
          <span className={`games-ranking-chip${game.status === "live" ? " is-on" : ""}`} key={game.id}>
            {game.icon} {miniGameName(game, locale)}
            {game.status === "coming" ? <small>{text.comingSoon}</small> : null}
          </span>
        ))}
      </div>

      {board === undefined ? null : board === null ? (
        <div className="games-notfound" data-testid="games-ranking-unavailable">
          <strong>{text.rankingUnavailableTitle}</strong>
          <p>{text.rankingUnavailableBody}</p>
          <button className="games-btn" onClick={() => setGamesUrl("/games/reaction")} type="button">{text.navReaction}</button>
        </div>
      ) : board.entries.length === 0 ? (
        <div className="games-notfound">
          <strong>{text.rankingEmpty}</strong>
          <button className="games-btn" onClick={() => setGamesUrl("/games/reaction")} type="button">{text.rankingChallengeCta}</button>
        </div>
      ) : (
        <>
          <div className="games-podium">
            {[podium[1], podium[0], podium[2]].map((entry, position) => entry ? (
              <div className={`games-podium-card is-p${entry.rank}`} key={entry.rank}>
                <span aria-hidden="true" className="games-podium-medal">{entry.rank === 1 ? "👑" : entry.rank === 2 ? "🥈" : "🥉"}</span>
                <span className="games-podium-avatar"><EntryAvatar entry={entry} /></span>
                <b>{entryName(entry, locale)}</b>
                <span className="games-podium-ms">{Math.round(entry.averageMs)}ms</span>
                <span className="games-podium-tier"><EntryTier entry={entry} locale={locale} /></span>
              </div>
            ) : <span aria-hidden="true" key={`empty-${position}`} />)}
          </div>

          {rest.length > 0 ? (
            <div className="games-ranking-table">
              <div aria-hidden="true" className="games-ranking-head">
                <span>{text.rankingColRank}</span>
                <span>{text.rankingColName}</span>
                <span>{text.rankingColRecord}</span>
                <span>{text.rankingColTier}</span>
              </div>
              {rest.map((entry) => (
                <div className={`games-lb-row${board.me && entry.rank === board.me.rank ? " is-me" : ""}`} data-rank={entry.rank} key={entry.rank}>
                  <span className="games-lb-rank">{entry.rank}</span>
                  <span className="games-lb-name">
                    <EntryAvatar entry={entry} />
                    <b>{entryName(entry, locale)}</b>
                    {board.me && entry.rank === board.me.rank ? <small>{text.leaderboardMe}</small> : null}
                  </span>
                  <span className="games-lb-ms">{Math.round(entry.averageMs)}ms</span>
                  <span className="games-ranking-tier"><EntryTier entry={entry} locale={locale} /></span>
                </div>
              ))}
              <p className="games-ranking-foot">{formatTemplate(text.rankingFoot, { count: String(RANKING_LIMIT) })}</p>
            </div>
          ) : null}

          {/* 내 순위 고정 바 — 기록이 없으면 도전 CTA(목업 규칙). */}
          {board.me ? (
            <div className="games-ranking-me" data-testid="games-ranking-me">
              <span className="games-lb-rank">{board.me.rank}</span>
              <span className="games-lb-name">
                <EntryAvatar entry={board.me} />
                <b>{entryName(board.me, locale)}</b>
                {myDelta !== undefined ? <small>{formatTemplate(text.rankingMyDelta, { ms: String(myDelta) })}</small> : null}
              </span>
              <span className="games-lb-ms">{Math.round(board.me.averageMs)}ms</span>
              <span className="games-ranking-tier"><EntryTier entry={board.me} locale={locale} /></span>
            </div>
          ) : (
            <button className="games-ranking-me is-cta" onClick={() => setGamesUrl("/games/reaction")} type="button">
              {text.rankingChallengeCta}
            </button>
          )}

          {board.tierDistribution && board.tierDistribution.length > 0 && totalGames > 0 ? (
            <div className="games-ranking-table games-ranking-dist">
              <div aria-hidden="true" className="games-ranking-head">
                <span />
                <span>{text.rankingDistribution}</span>
                <span />
                <span>{formatTemplate(text.rankingTotal, { count: String(board.total ?? totalGames) })}</span>
              </div>
              {REACTION_TIER_TABLE.map((tier) => {
                const count = board.tierDistribution!.find((item) => item.tierKey === tier.key)?.count ?? 0;
                if (count === 0) return null;
                const percent = Math.round((count / totalGames) * 100);
                return (
                  <div className="games-ranking-dist-row" key={tier.key}>
                    <b><TierDot tier={tier} />{reactionTierLabel(tier, locale)}</b>
                    <span className="games-ranking-dist-bar"><i style={{ width: `${percent}%` }} /></span>
                    <span className="games-ranking-dist-pct">{percent}%</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
