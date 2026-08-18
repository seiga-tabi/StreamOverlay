import { activePublicLocale, t } from "../i18n/public-lol-i18n";
import type { PublicLolArenaTeam, PublicLolArenaTeamPlayer } from "../types/public-lol";
import { LolAugmentIcon } from "./LolAugmentIcon";

/* 아레나 확장 상세 = 순위표 — docs/mockups/lol-arena-match-row.html §④·④-1.
 *
 * 5v5 의 두 팀 테이블 대신 1위→N위 팀 그룹을 쌓습니다. 각 팀 3행(1700계는 2행):
 * 챔피언·이름 · KDA · 딜량 · 골드 · 아이템 6 · 증강 6. 아이템은 장신구 없는 6칸
 * 고정 — 미구매 칸은 빈 프레임으로 유지해 열이 흔들리지 않게 합니다(목업 §⑦).
 * 모바일은 CSS 에서 플레이어당 2줄(신원·KDA / 아이템|증강)로 재배치합니다.
 * riotId 마스킹은 5v5 상세와 같은 토글(hideRiotIds)을 따릅니다. */

function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function formatK(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return `${(value / 1_000).toFixed(1)}k`;
}

function placementToneClass(placement: number): string {
  if (placement === 1) return "is-first";
  return placement <= 3 ? "is-top" : "is-bottom";
}

function playerName(player: PublicLolArenaTeamPlayer, hideRiotIds: boolean): string {
  if (hideRiotIds || !player.riotId) {
    const ja = player.champion.nameJa;
    return activePublicLocale === "ja" && ja ? ja : player.champion.nameKo;
  }
  return player.riotId;
}

function ItemCells({ player }: { player: PublicLolArenaTeamPlayer }) {
  const items = player.items ?? [];
  return (
    <span className="lol-arena-items" aria-label={t().arenaColItems}>
      {Array.from({ length: 6 }, (_, index) => {
        const item = items[index];
        return item?.iconUrl
          ? <span key={index} title={(activePublicLocale === "ja" ? item.nameJa ?? item.nameKo : item.nameKo ?? item.nameJa) ?? undefined}><img src={item.iconUrl} alt="" /></span>
          : <span className="is-empty" key={index} />;
      })}
    </span>
  );
}

export function ArenaStandings({ teams, hideRiotIds }: { teams: PublicLolArenaTeam[]; hideRiotIds: boolean }) {
  const sorted = [...teams].sort((a, b) => a.placement - b.placement);
  return (
    <div className="lol-arena-standings" aria-label={t().arenaStandings}>
      {sorted.map((team) => {
        const mine = team.players.some((player) => player.isTarget);
        const teamKills = team.players.reduce((sum, player) => sum + player.kills, 0);
        const teamGold = team.players.reduce((sum, player) => sum + (player.goldEarned ?? 0), 0);
        return (
          <section className={`lol-arena-team${mine ? " is-me" : ""}`} key={team.placement}>
            <header className="lol-arena-team-head">
              <b className={placementToneClass(team.placement)}>
                {formatTemplate(t().arenaPlacement, { n: String(team.placement) })}
              </b>
              <small>{formatTemplate(t().arenaTeamSummary, { kills: String(teamKills), gold: formatK(teamGold) })}</small>
              {mine ? <span className="lol-arena-my-tag">{t().arenaMyTeam}</span> : null}
            </header>
            <div aria-hidden="true" className="lol-arena-cols">
              <span>{t().arenaColPlayer}</span>
              <span className="is-num">KDA</span>
              <span className="is-num">{t().arenaColDamage}</span>
              <span className="is-num">{t().arenaColGold}</span>
              <span>{t().arenaColItems}</span>
              <span>{t().arenaColAugments}</span>
            </div>
            {team.players.map((player, index) => (
              <div className={`lol-arena-player${player.isTarget ? " is-target" : ""}`} key={`${team.placement}:${index}`}>
                <span className="lol-arena-who">
                  {player.champion.iconUrl
                    ? <img src={player.champion.iconUrl} alt="" />
                    : <i aria-hidden="true">{(player.champion.nameKo ?? "?").slice(0, 1)}</i>}
                  <span className="lol-arena-who-copy">
                    <b>{playerName(player, hideRiotIds)}</b>
                    <small>{t().arenaColDamage} {formatK(player.damageDealtToChampions)} · {t().arenaColGold} {formatK(player.goldEarned)}</small>
                  </span>
                </span>
                <span className="lol-arena-kda">
                  {player.kills} / <i>{player.deaths}</i> / {player.assists}
                </span>
                <span className="lol-arena-num">{formatK(player.damageDealtToChampions)}</span>
                <span className="lol-arena-num">{formatK(player.goldEarned)}</span>
                <ItemCells player={player} />
                <span className="lol-arena-augs" aria-label={t().arenaColAugments}>
                  {(player.augments ?? []).slice(0, 6).map((augmentId, augmentIndex) => (
                    <LolAugmentIcon id={augmentId} key={`${augmentId}:${augmentIndex}`} />
                  ))}
                </span>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
