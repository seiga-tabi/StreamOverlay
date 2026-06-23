import type { CSSProperties } from "react";
import type {
  LolChampionSummary,
  LolMainRole,
  ParticipationQueueEntry,
  ParticipationStatusUpdateMessage,
  ParticipationTeamsUpdateMessage
} from "@streamops/shared";

const MAX_VISIBLE_QUEUE_ROWS = 4;
const QUEUE_SLOT_NUMBERS = Array.from({ length: MAX_VISIBLE_QUEUE_ROWS }, (_, index) => index + 1);

const i18n = {
  ko: {
    selectedLabel: "다음 참가자",
    queueTitle: "롤 시참 대기열",
    queueHeroTitle: "참가 대기열",
    teamTitle: "내전 팀",
    broadcasterLabel: "방송자",
    liveBadge: "LIVE",
    waitingLabel: "대기 중",
    emptySlotMeta: "참가 대기",
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
    queueHeroTitle: "参加待機列",
    teamTitle: "カスタムチーム",
    broadcasterLabel: "配信者",
    liveBadge: "LIVE",
    waitingLabel: "待機中",
    emptySlotMeta: "参加待機",
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

function LocalizedText({ value, className }: { value: BilingualValue; className?: string }) {
  return (
    <span className={className} data-ko={value.ko} data-ja={value.ja}>
      {value.ja}
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

function queueSlotNumber(slot: number): string {
  return String(slot).padStart(2, "0");
}

function cssUrl(url: string): string {
  return `url("${url.replaceAll("\"", "%22")}")`;
}

function firstQueueArtUrl(queue: ParticipationQueueEntry[]): string | undefined {
  for (const entry of queue) {
    const artUrl = championArtUrl(primaryChampion(entry.topChampions));
    if (artUrl) return artUrl;
  }
  return undefined;
}

function queueSlotStatus(entry: ParticipationQueueEntry | undefined): BilingualValue {
  if (!entry) return pair(t.waitingLabel, ko.waitingLabel);
  return statusLabel(entry.status);
}

function queueSlotMeta(entry: ParticipationQueueEntry | undefined): BilingualValue {
  if (!entry) return pair(t.emptySlotMeta, ko.emptySlotMeta);
  const role = mainRoleLabel(entry.mainRole);
  return pair(role.ja, role.ko);
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
  const broadcasterArtUrl = firstQueueArtUrl(visibleQueue);

  return (
    <>
      {shouldShowQueueCard ? (
        <div className={`queue-card compact streamer-queue ${status?.isOpen ? "open" : "closed"}`}>
          <QueueBroadcasterPanel artUrl={broadcasterArtUrl} status={status} visibleCount={visibleQueue.length} />
          <div className="streamer-queue-slots" aria-label={t.queueTitle}>
            {QUEUE_SLOT_NUMBERS.map((slot) => (
              <QueueSlotRow
                entry={visibleQueue[slot - 1]}
                fallbackArtUrl={broadcasterArtUrl}
                slot={slot}
                key={`queue-slot-${slot}-${visibleQueue[slot - 1]?.position ?? "empty"}`}
              />
            ))}
          </div>
          {hiddenQueueCount > 0 ? (
            <div className="streamer-queue-more">
              <LocalizedText value={pair(t.moreCount(hiddenQueueCount), ko.moreCount(hiddenQueueCount))} />
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

function QueueBroadcasterPanel({
  artUrl,
  status,
  visibleCount
}: {
  artUrl?: string;
  status?: ParticipationStatusUpdateMessage;
  visibleCount: number;
}) {
  const artStyle = artUrl ? ({ "--streamer-queue-art": cssUrl(artUrl) } as CSSProperties) : undefined;
  const statusText = statusValue(status);
  const statusSubline = statusDescription(status);
  return (
    <div className="queue-broadcaster-card" style={artStyle}>
      <div className="queue-broadcaster-crest" aria-hidden="true">
        <span data-ko={ko.liveBadge} data-ja={t.liveBadge}>{ko.liveBadge}</span>
      </div>
      <div className="queue-broadcaster-copy">
        <LocalizedText className="queue-broadcaster-kicker" value={pair(t.broadcasterLabel, ko.broadcasterLabel)} />
        <LocalizedText className="queue-broadcaster-title" value={pair(t.queueHeroTitle, ko.queueHeroTitle)} />
        <LocalizedText className="queue-broadcaster-subline" value={statusSubline} />
      </div>
      <div className={`queue-broadcaster-status ${status?.isOpen ? "open" : "closed"}`}>
        <LocalizedText value={statusText} />
        <LocalizedText value={queueCount(visibleCount)} />
      </div>
    </div>
  );
}

function QueueSlotRow({
  entry,
  fallbackArtUrl,
  slot
}: {
  entry?: ParticipationQueueEntry;
  fallbackArtUrl?: string;
  slot: number;
}) {
  const champion = primaryChampion(entry?.topChampions);
  const artUrl = championArtUrl(champion) ?? fallbackArtUrl;
  const artStyle = artUrl ? ({ "--streamer-queue-art": cssUrl(artUrl) } as CSSProperties) : undefined;
  const slotStatus = queueSlotStatus(entry);
  const slotMeta = queueSlotMeta(entry);
  const ariaLabel = entry
    ? `${queueSlotNumber(slot)} ${entry.twitchUserName} ${slotMeta.ja}`
    : `${queueSlotNumber(slot)} ${t.waitingLabel}`;
  return (
    <div
      className={`streamer-queue-row slot-${slot} ${entry ? "filled-slot" : "empty-slot"} ${artUrl ? "has-art" : "empty-art"}`}
      aria-label={ariaLabel}
      data-status={entry?.status ?? "waiting"}
      style={artStyle}
    >
      <div className="streamer-queue-row-art" aria-hidden="true" />
      <div className="streamer-queue-index" aria-hidden="true">{queueSlotNumber(slot)}</div>
      <div className="streamer-queue-divider" aria-hidden="true" />
      <div className="streamer-queue-copy">
        <strong className="streamer-queue-name">
          {entry?.twitchUserName ?? <LocalizedText value={pair(t.waitingLabel, ko.waitingLabel)} />}
        </strong>
        <span className="streamer-queue-meta"><LocalizedText value={slotMeta} /></span>
      </div>
      <div className="streamer-queue-state">
        <LocalizedText value={slotStatus} />
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
