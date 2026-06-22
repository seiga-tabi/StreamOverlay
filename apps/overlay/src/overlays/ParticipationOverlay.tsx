import type { CSSProperties } from "react";
import type {
  LolChampionSummary,
  LolMainRole,
  ParticipationQueueEntry,
  ParticipationStatusUpdateMessage,
  ParticipationTeamsUpdateMessage
} from "@streamops/shared";

const i18n = {
  ko: {
    selectedLabel: "다음 참가자",
    queueTitle: "롤 시참 대기열",
    teamTitle: "내전 팀",
    open: "모집 중",
    closed: "모집 종료",
    openDescription: "시참 참가자를 모집 중입니다.",
    closedDescription: "시참 모집이 종료되었습니다.",
    inGame: "게임 중",
    inGameDescription: "방송자가 현재 게임을 진행 중입니다.",
    gameEnded: "게임 종료",
    gameEndedDescription: "게임이 종료되었습니다. 다음 참가자를 준비합니다.",
    nextCandidate: "다음 후보",
    queueCount: (count: number) => `대기 ${count}/${MAX_VISIBLE_QUEUE_ROWS}`,
    moreCount: (count: number) => `외 ${count}명`,
    levelPrefix: "Lv.",
    mainRole: "주라인",
    lane: "라인",
    topChampion: "주사용 챔피언",
    emptyQueue: "대기 중인 참가자가 없습니다.",
    masteryPrefix: "숙련도",
    gamesSuffix: "게임",
    profileAnalyzing: "분석 중",
    winsLabel: "승",
    lossesLabel: "패",
    winRateLabel: "승률",
    checkIn: (seconds: number) => `${seconds}초 안에 !참가확인 / !checkin`,
    queueTypes: {
      RANKED_SOLO_5x5: "솔로랭크",
      RANKED_FLEX_SR: "자유랭크",
      UNRANKED: "일반"
    },
    statuses: {
      pending: "대기",
      verified: "확인됨",
      waitlisted: "대기",
      selected: "선정",
      checked_in: "확인 완료",
      invited: "초대됨",
      in_game: "게임 중",
      played: "완료",
      skipped: "건너뜀",
      cancelled: "취소",
      no_show: "노쇼",
      rejected: "거절",
      blocked: "차단"
    },
    mainRoles: {
      TOP: "탑",
      JUNGLE: "정글",
      MIDDLE: "미드",
      BOTTOM: "바텀",
      UTILITY: "서폿",
      FILL: "올라운더",
      UNKNOWN: "미정"
    }
  },
  ja: {
    selectedLabel: "次の参加者",
    queueTitle: "LoL 参加待機列",
    teamTitle: "カスタムチーム",
    open: "募集中",
    closed: "募集終了",
    openDescription: "参加者を募集しています。",
    closedDescription: "参加募集は終了しました。",
    inGame: "ゲーム中",
    inGameDescription: "配信者が現在試合中です。",
    gameEnded: "試合終了",
    gameEndedDescription: "試合が終了しました。次の参加者を準備します。",
    nextCandidate: "次の候補",
    queueCount: (count: number) => `待機 ${count}/${MAX_VISIBLE_QUEUE_ROWS}`,
    moreCount: (count: number) => `ほか ${count}人`,
    levelPrefix: "Lv.",
    mainRole: "主ロール",
    lane: "レーン",
    topChampion: "主使用チャンピオン",
    emptyQueue: "待機中の参加者はいません。",
    masteryPrefix: "熟練度",
    gamesSuffix: "試合",
    profileAnalyzing: "分析中",
    winsLabel: "勝",
    lossesLabel: "敗",
    winRateLabel: "勝率",
    checkIn: (seconds: number) => `${seconds}秒以内に !参加確認 / !checkin`,
    queueTypes: {
      RANKED_SOLO_5x5: "ソロランク",
      RANKED_FLEX_SR: "フレックス",
      UNRANKED: "一般"
    },
    statuses: {
      pending: "待機",
      verified: "確認済み",
      waitlisted: "待機",
      selected: "選出",
      checked_in: "参加確認完了",
      invited: "招待済み",
      in_game: "ゲーム中",
      played: "完了",
      skipped: "スキップ",
      cancelled: "取消",
      no_show: "不在",
      rejected: "拒否",
      blocked: "ブロック"
    },
    mainRoles: {
      TOP: "トップ",
      JUNGLE: "ジャングル",
      MIDDLE: "ミッド",
      BOTTOM: "ボット",
      UTILITY: "サポート",
      FILL: "オール",
      UNKNOWN: "未定"
    }
  }
} as const;

const t = i18n.ja;
const ko = i18n.ko;
const MAX_VISIBLE_QUEUE_ROWS = 4;

type BilingualValue = {
  ja: string;
  ko: string;
};

function BilingualText({ value, className }: { value: BilingualValue; className?: string }) {
  return (
    <span className={`bilingual-text ${className ?? ""}`}>
      <span className="bilingual-ja">{value.ja}</span>
    </span>
  );
}

function pair(ja: string, koText: string): BilingualValue {
  return { ja, ko: koText };
}

function statusLabel(status: string | undefined): BilingualValue {
  if (!status) return pair("", "");
  return pair(t.statuses[status as keyof typeof t.statuses] ?? status, ko.statuses[status as keyof typeof ko.statuses] ?? status);
}

function mainRoleLabel(role: LolMainRole | undefined): BilingualValue {
  if (!role) return pair(t.mainRoles.UNKNOWN, ko.mainRoles.UNKNOWN);
  return pair(t.mainRoles[role] ?? role, ko.mainRoles[role] ?? role);
}

function mainRoleShortLabel(role: LolMainRole | undefined): BilingualValue {
  switch (role) {
    case "TOP":
      return pair("TOP", "탑");
    case "JUNGLE":
      return pair("JG", "정글");
    case "MIDDLE":
      return pair("MID", "미드");
    case "BOTTOM":
      return pair("ADC", "원딜");
    case "UTILITY":
      return pair("SUP", "서폿");
    case "FILL":
      return pair("FILL", "올라운더");
    default:
      return pair("ANY", "미정");
  }
}

function championMasteryScore(champion: LolChampionSummary): number {
  return (champion.masteryPoints ?? 0) * 10 + (champion.masteryLevel ?? 0);
}

function primaryChampion(champions: LolChampionSummary[] | undefined): LolChampionSummary | undefined {
  if (!champions || champions.length === 0) return undefined;
  const firstChampion = champions[0];
  if (!firstChampion) return undefined;
  return champions.slice(1).reduce((best, champion) => {
    return championMasteryScore(champion) > championMasteryScore(best) ? champion : best;
  }, firstChampion);
}

function championArtUrl(champion: LolChampionSummary | undefined): string | undefined {
  if (!champion) return undefined;
  if (champion.splashUrl) return champion.splashUrl;
  if (champion.loadingUrl) return champion.loadingUrl;
  if (champion.iconUrl) return champion.iconUrl;
  return champion.championKey ? `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion.championKey}_0.jpg` : undefined;
}

function championName(champion: LolChampionSummary | undefined): BilingualValue {
  if (!champion) return pair(t.profileAnalyzing, ko.profileAnalyzing);
  return pair(champion.nameJa ?? champion.championKey ?? champion.nameKo, champion.nameKo);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function masterySummary(champion: LolChampionSummary | undefined): BilingualValue {
  if (!champion) return pair(t.profileAnalyzing, ko.profileAnalyzing);
  if (champion.masteryPoints !== undefined && champion.masteryLevel !== undefined) {
    return pair(
      `${t.masteryPrefix} ${t.levelPrefix}${champion.masteryLevel} · ${formatNumber(champion.masteryPoints)}pt`,
      `${ko.masteryPrefix} ${ko.levelPrefix}${champion.masteryLevel} · ${formatNumber(champion.masteryPoints)}점`
    );
  }
  if (champion.masteryPoints !== undefined) {
    return pair(
      `${t.masteryPrefix} ${formatNumber(champion.masteryPoints)}pt`,
      `${ko.masteryPrefix} ${formatNumber(champion.masteryPoints)}점`
    );
  }
  if (champion.masteryLevel !== undefined) {
    return pair(
      `${t.masteryPrefix} ${t.levelPrefix}${champion.masteryLevel}`,
      `${ko.masteryPrefix} ${ko.levelPrefix}${champion.masteryLevel}`
    );
  }
  if (champion.games !== undefined) {
    return pair(`${formatNumber(champion.games)}${t.gamesSuffix}`, `${formatNumber(champion.games)}${ko.gamesSuffix}`);
  }
  return pair(t.profileAnalyzing, ko.profileAnalyzing);
}

function rankedSummary(entry: ParticipationQueueEntry): BilingualValue {
  const stats = entry.rankedStats;
  if (!stats) return pair(t.profileAnalyzing, ko.profileAnalyzing);
  if (stats.tier === "UNRANKED") return pair(t.queueTypes.UNRANKED, ko.queueTypes.UNRANKED);
  const rank = [stats.tier, stats.rank, `${stats.leaguePoints}LP`].filter(Boolean).join(" ");
  return pair(rank, rank);
}

function recordSummary(entry: ParticipationQueueEntry): BilingualValue {
  const stats = entry.rankedStats;
  if (!stats) return pair(t.profileAnalyzing, ko.profileAnalyzing);
  return pair(
    `${stats.wins}${t.winsLabel} ${stats.losses}${t.lossesLabel} · ${t.winRateLabel} ${stats.winRate}%`,
    `${stats.wins}${ko.winsLabel} ${stats.losses}${ko.lossesLabel} · ${ko.winRateLabel} ${stats.winRate}%`
  );
}

function statusValue(status: ParticipationStatusUpdateMessage | undefined): BilingualValue {
  if (status?.phase === "in_game") return pair(t.inGame, ko.inGame);
  if (status?.phase === "game_ended") return pair(t.gameEnded, ko.gameEnded);
  if (!status) return pair(t.closed, ko.closed);
  return status.isOpen ? pair(t.open, ko.open) : pair(t.closed, ko.closed);
}

function statusDescription(status: ParticipationStatusUpdateMessage | undefined): BilingualValue {
  if (status?.phase === "in_game") return pair(t.inGameDescription, ko.inGameDescription);
  if (status?.phase === "game_ended") return pair(t.gameEndedDescription, ko.gameEndedDescription);
  if (!status) return pair(t.closedDescription, ko.closedDescription);
  return status.isOpen ? pair(t.openDescription, ko.openDescription) : pair(t.closedDescription, ko.closedDescription);
}

function queueCount(count: number): BilingualValue {
  return pair(t.queueCount(count), ko.queueCount(count));
}

export function ParticipationOverlay({
  queue,
  status,
  teams
}: {
  queue: ParticipationQueueEntry[];
  status?: ParticipationStatusUpdateMessage;
  teams?: ParticipationTeamsUpdateMessage;
}) {
  const shouldShowQueueCard = queue.length > 0 || status?.isOpen || Boolean(teams);
  const visibleQueue = queue.slice(0, MAX_VISIBLE_QUEUE_ROWS);
  const hiddenQueueCount = Math.max(0, queue.length - visibleQueue.length);
  const nextCandidate = status?.nextCandidate;

  return (
    <>
      {shouldShowQueueCard ? (
        <div className={`queue-card compact ${status?.isOpen ? "open" : "closed"}`}>
          <div className="queue-header">
            <div>
              <div className="label"><BilingualText value={pair(t.queueTitle, ko.queueTitle)} /></div>
              <div className="queue-status-line"><BilingualText value={statusDescription(status)} /></div>
            </div>
            <div className={`queue-status-pill ${status?.isOpen ? "open" : "closed"}`}>
              <BilingualText value={statusValue(status)} />
            </div>
          </div>
          <div className="queue-count"><BilingualText value={queueCount(visibleQueue.length)} /></div>
          {nextCandidate ? (
            <div className="queue-next-candidate">
              <BilingualText value={pair(t.nextCandidate, ko.nextCandidate)} />
              <strong>#{nextCandidate.position} {nextCandidate.twitchUserName}</strong>
              <BilingualText value={statusLabel(nextCandidate.status)} />
            </div>
          ) : null}
          {queue.length > 0 ? (
            <div className="queue-list" aria-label={`${t.queueTitle} / ${ko.queueTitle}`}>
              {visibleQueue.map((entry, index) => (
                <QueueEntryRow
                  entry={entry}
                  slot={index + 1}
                  key={`${entry.position}-${entry.twitchUserName}`}
                />
              ))}
            </div>
          ) : (
            <div className="queue-empty">
              <strong><BilingualText value={statusValue(status)} /></strong>
              <span><BilingualText value={pair(t.emptyQueue, ko.emptyQueue)} /></span>
            </div>
          )}
          {hiddenQueueCount > 0 ? (
            <div className="queue-more">
              <BilingualText value={pair(t.moreCount(hiddenQueueCount), ko.moreCount(hiddenQueueCount))} />
            </div>
          ) : null}
        </div>
      ) : null}
      {teams ? (
        <div className="teams-card">
          <div className="label"><BilingualText value={pair(t.teamTitle, ko.teamTitle)} /></div>
          <div className="teams-grid">
            <TeamColumn name="A" players={teams.teams.a} />
            <TeamColumn name="B" players={teams.teams.b} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function QueueEntryRow({
  entry,
  slot
}: {
  entry: ParticipationQueueEntry;
  slot: number;
}) {
  const champion = primaryChampion(entry.topChampions);
  const artUrl = championArtUrl(champion);
  const name = championName(champion);
  const role = mainRoleLabel(entry.mainRole);
  const roleShort = mainRoleShortLabel(entry.mainRole);
  const artStyle = artUrl ? ({ "--queue-art": `url("${artUrl}")` } as CSSProperties) : undefined;
  return (
    <div
      className={`queue-row nameplate mastery-card slot-${slot} ${artUrl ? "has-art" : "empty-art"}`}
      aria-label={`${entry.twitchUserName} ${role.ja} / ${role.ko}`}
      data-status={entry.status}
    >
      <div className="queue-row-surface">
        <div className="queue-art-panel" style={artStyle} aria-hidden="true">
          <div className="queue-art-overlay">
            <span className="queue-hero-champion"><BilingualText value={name} /></span>
            <span className="queue-mastery"><BilingualText value={masterySummary(champion)} /></span>
          </div>
        </div>
        <span className="queue-row-index" aria-hidden="true"><BilingualText value={roleShort} /></span>
        <div className="queue-detail-panel">
          <div className="queue-player-line">
            <strong className="queue-name">{entry.twitchUserName}</strong>
          </div>
          <div className="queue-stat-line">
            <span><BilingualText value={recordSummary(entry)} /></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role, confidence }: { role?: LolMainRole; confidence?: number }) {
  const normalizedRole = role ?? "UNKNOWN";
  const roleText = mainRoleShortLabel(role);
  return (
    <div className={`role-badge role-${normalizedRole.toLowerCase()}`}>
      <span className="role-icon" aria-hidden="true"><span /></span>
      <span className="role-copy">
        <strong><BilingualText value={roleText} /></strong>
        <span>{confidence === undefined ? <BilingualText value={pair(t.lane, ko.lane)} /> : `${confidence}%`}</span>
      </span>
    </div>
  );
}

function TeamColumn({ name, players }: { name: string; players: Array<{ twitchUserName: string }> }) {
  return (
    <div className="team-column">
      <strong><BilingualText value={pair(`チーム ${name}`, `팀 ${name}`)} /></strong>
      {players.map((player, index) => (
        <span key={`${name}-${player.twitchUserName}-${index}`}>
          {player.twitchUserName}
        </span>
      ))}
    </div>
  );
}
