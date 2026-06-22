import { useEffect, useState, type FormEvent } from "react";
import type { LolChampionSummary, LolGameMonitorSettings, ParticipationDashboardQueueEntry, ParticipationState } from "@streamops/shared";
import { apiGet, apiPost } from "../api/client";

type DashboardSnapshot = {
  participationState?: ParticipationState;
  participationQueue?: ParticipationDashboardQueueEntry[];
  status?: {
    participation?: string;
  };
};

const i18n = {
  ko: {
    title: "롤 시참 관리",
    commandHint: "채팅 명령어: !시참/!join/!参加 RiotID#태그 / !참가확인/!checkin/!参加確認 / !시참취소/!cancel/!参加取消",
    open: "모집 중",
    closed: "모집 종료",
    active: "진행 중",
    waiting: "대기",
    selected: "선정",
    checkedIn: "확인 완료",
    noShow: "노쇼",
    played: "완료",
    queueTitle: "대기열",
    empty: "대기자가 없습니다.",
    riotId: "Riot ID",
    rankStats: "랭크 전적",
    profileStatus: "분석 상태",
    profileFailureReason: "실패 이유",
    mainRole: "주라인",
    topChampions: "모스트",
    gameMonitorTitle: "게임 자동 감시",
    streamerRiotId: "방송자 Riot ID",
    gameMonitorEnabled: "자동 감시 사용",
    autoSelectNext: "게임 종료 후 다음 참가자 자동 선정",
    announceInChat: "채팅 안내 사용",
    saveGameMonitor: "저장",
    gameMonitorSaved: "게임 감시 설정을 저장했습니다.",
    gameMonitorSaveFailed: "게임 감시 설정 저장에 실패했습니다.",
    gameMonitorLoadFailed: "게임 감시 설정을 불러오지 못했습니다.",
    gameMonitorWaiting: "Riot ID가 비어 있으면 감시가 대기 상태로 유지됩니다.",
    refreshProfile: "프로필 새로고침",
    roleOverride: "수동 라인 보정",
    source: "신청 경로",
    checkInUntil: "확인 기한",
    createdAt: "신청 시간",
    none: "없음",
    unranked: "UNRANKED",
    soloRank: "솔로랭크",
    flexRank: "자유랭크",
    winRate: "승률",
    wins: "승",
    losses: "패",
    refreshing: "새로고침 요청 완료",
    refreshFailed: "프로필 새로고침 요청 실패",
    roleUpdated: "수동 라인 보정을 저장했습니다.",
    roleUpdateFailed: "수동 라인 보정에 실패했습니다.",
    mainRoles: {
      TOP: "탑",
      JUNGLE: "정글",
      MIDDLE: "미드",
      BOTTOM: "바텀",
      UTILITY: "서폿",
      FILL: "올라운더",
      UNKNOWN: "미정"
    },
    profileStatuses: {
      pending: "대기",
      analyzing: "분석 중",
      ready: "완료",
      failed: "실패",
      rate_limited: "Rate limit"
    },
    roles: {
      top: "탑",
      jungle: "정글",
      mid: "미드",
      adc: "원딜",
      support: "서폿",
      fill: "상관없음",
      unknown: "미정"
    },
    statuses: {
      pending: "대기",
      verified: "Riot 확인",
      waitlisted: "대기",
      selected: "참가 확인 대기",
      checked_in: "참가 확인 완료",
      invited: "초대됨",
      in_game: "게임 중",
      played: "완료",
      skipped: "건너뜀",
      cancelled: "취소",
      no_show: "노쇼",
      rejected: "거절",
      blocked: "차단"
    },
    sources: {
      chat_command: "채팅",
      channel_point: "채널 포인트",
      dashboard: "대시보드"
    }
  },
  ja: {
    title: "LoL 参加管理",
    commandHint: "チャットコマンド: !参加/!join/!시참 RiotID#タグ / !参加確認/!checkin/!참가확인 / !参加取消/!cancel/!시참취소",
    open: "募集作業中",
    closed: "募集終了",
    active: "進行中",
    waiting: "待機",
    selected: "選出",
    checkedIn: "確認完了",
    noShow: "不在",
    played: "完了",
    queueTitle: "待機列",
    empty: "待機者はいません。",
    riotId: "Riot ID",
    rankStats: "ランク戦績",
    profileStatus: "分析状態",
    profileFailureReason: "失敗理由",
    mainRole: "主ロール",
    topChampions: "得意",
    gameMonitorTitle: "試合自動監視",
    streamerRiotId: "配信者 Riot ID",
    gameMonitorEnabled: "自動監視を使用",
    autoSelectNext: "試合終了後に次の参加者を自動選出",
    announceInChat: "チャット案内を使用",
    saveGameMonitor: "保存",
    gameMonitorSaved: "試合監視設定を保存しました。",
    gameMonitorSaveFailed: "試合監視設定の保存に失敗しました。",
    gameMonitorLoadFailed: "試合監視設定を読み込めませんでした。",
    gameMonitorWaiting: "Riot ID が空の場合、監視は待機状態になります。",
    refreshProfile: "プロフィール更新",
    roleOverride: "手動ロール補正",
    source: "申請経路",
    checkInUntil: "確認期限",
    createdAt: "申請時間",
    none: "なし",
    unranked: "UNRANKED",
    soloRank: "ソロランク",
    flexRank: "フレックス",
    winRate: "勝率",
    wins: "勝",
    losses: "敗",
    refreshing: "更新をリクエストしました。",
    refreshFailed: "プロフィール更新リクエストに失敗しました。",
    roleUpdated: "手動ロール補正を保存しました。",
    roleUpdateFailed: "手動ロール補正に失敗しました。",
    mainRoles: {
      TOP: "トップ",
      JUNGLE: "ジャングル",
      MIDDLE: "ミッド",
      BOTTOM: "ボット",
      UTILITY: "サポート",
      FILL: "オール",
      UNKNOWN: "未定"
    },
    profileStatuses: {
      pending: "待機",
      analyzing: "分析中",
      ready: "完了",
      failed: "失敗",
      rate_limited: "Rate limit"
    },
    roles: {
      top: "トップ",
      jungle: "ジャングル",
      mid: "ミッド",
      adc: "ADC",
      support: "サポート",
      fill: "どこでも",
      unknown: "未定"
    },
    statuses: {
      pending: "待機",
      verified: "Riot 確認済み",
      waitlisted: "待機",
      selected: "参加確認待ち",
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
    sources: {
      chat_command: "チャット",
      channel_point: "チャンネルポイント",
      dashboard: "ダッシュボード"
    }
  }
} as const;

const t = i18n.ko;

function roleLabel(role: string | undefined): string {
  if (!role) return t.roles.unknown;
  return t.roles[role as keyof typeof t.roles] ?? role;
}

function statusLabel(status: string | undefined): string {
  if (!status) return t.none;
  return t.statuses[status as keyof typeof t.statuses] ?? status;
}

function sourceLabel(source: string | undefined): string {
  if (!source) return t.none;
  return t.sources[source as keyof typeof t.sources] ?? source;
}

function formatTime(value: string | undefined): string {
  if (!value) return t.none;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t.none;
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function profileStatusLabel(status: string | undefined): string {
  if (!status) return t.none;
  return t.profileStatuses[status as keyof typeof t.profileStatuses] ?? status;
}

function mainRoleLabel(role: string | undefined, confidence: number | undefined): string {
  if (!role) return t.none;
  const label = t.mainRoles[role as keyof typeof t.mainRoles] ?? role;
  return confidence === undefined ? label : `${label} ${confidence}%`;
}

function championLabel(champions: LolChampionSummary[] | undefined): string {
  if (!champions?.length) return t.none;
  return champions.slice(0, 3).map((champion) => champion.nameKo ?? champion.championKey ?? champion.championId).join(", ");
}

function primaryChampion(champions: LolChampionSummary[] | undefined): LolChampionSummary | undefined {
  return champions?.[0];
}

function championArtUrl(champion: LolChampionSummary | undefined): string | undefined {
  return champion?.splashUrl ?? champion?.loadingUrl ?? champion?.iconUrl;
}

function fallbackState(snapshot: DashboardSnapshot): ParticipationState {
  const queue = snapshot.participationQueue ?? [];
  return {
    isOpen: snapshot.status?.participation === "open",
    queue,
    activeQueue: queue,
    summary: {
      total: queue.length,
      active: queue.length,
      waiting: queue.filter((entry) => ["pending", "verified", "waitlisted"].includes(entry.status)).length,
      selected: queue.filter((entry) => entry.status === "selected").length,
      checkedIn: queue.filter((entry) => entry.status === "checked_in").length,
      noShow: queue.filter((entry) => entry.status === "no_show").length,
      played: queue.filter((entry) => entry.status === "played").length
    }
  };
}

export function ParticipationPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  const state = snapshot.participationState ?? fallbackState(snapshot);
  const queue = state.queue ?? [];
  const summary = state.summary;
  const [gameMonitor, setGameMonitor] = useState<LolGameMonitorSettings | null>(null);
  const [streamerRiotId, setStreamerRiotId] = useState("");
  const [monitorEnabled, setMonitorEnabled] = useState(true);
  const [autoSelectNextAfterGame, setAutoSelectNextAfterGame] = useState(true);
  const [announceInChat, setAnnounceInChat] = useState(true);
  const [monitorSaving, setMonitorSaving] = useState(false);
  const [monitorMessage, setMonitorMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    void apiGet<LolGameMonitorSettings>("/api/participation/game-monitor")
      .then((settings) => {
        if (!mounted) return;
        setGameMonitor(settings);
        setStreamerRiotId(settings.streamerRiotId);
        setMonitorEnabled(settings.enabled);
        setAutoSelectNextAfterGame(settings.autoSelectNextAfterGame);
        setAnnounceInChat(settings.announceInChat);
      })
      .catch(() => {
        if (mounted) setMonitorMessage(t.gameMonitorLoadFailed);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function saveGameMonitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMonitorSaving(true);
    setMonitorMessage("");
    try {
      const saved = await apiPost<LolGameMonitorSettings>("/api/participation/game-monitor", {
        streamerRiotId,
        enabled: monitorEnabled,
        autoSelectNextAfterGame,
        announceInChat
      });
      setGameMonitor(saved);
      setStreamerRiotId(saved.streamerRiotId);
      setMonitorEnabled(saved.enabled);
      setAutoSelectNextAfterGame(saved.autoSelectNextAfterGame);
      setAnnounceInChat(saved.announceInChat);
      setMonitorMessage(t.gameMonitorSaved);
    } catch {
      setMonitorMessage(t.gameMonitorSaveFailed);
    } finally {
      setMonitorSaving(false);
    }
  }

  async function refreshProfile(entryId: string) {
    try {
      await apiPost("/api/participation/profile/refresh", { entryId });
      alert(t.refreshing);
    } catch {
      alert(t.refreshFailed);
    }
  }

  async function overrideRole(entryId: string, role: string) {
    try {
      await apiPost("/api/participation/role-override", { entryId, role });
      alert(t.roleUpdated);
    } catch {
      alert(t.roleUpdateFailed);
    }
  }

  return (
    <>
      <div className="page-title-row page-header compact">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.commandHint}</p>
        </div>
        <span className={`queue-status ${state.isOpen ? "good" : "neutral"}`}>{state.isOpen ? t.open : t.closed}</span>
      </div>

      <div className="participation-summary">
        <div><span>{t.active}</span><strong>{summary.active}</strong></div>
        <div><span>{t.waiting}</span><strong>{summary.waiting}</strong></div>
        <div><span>{t.selected}</span><strong>{summary.selected}</strong></div>
        <div><span>{t.checkedIn}</span><strong>{summary.checkedIn}</strong></div>
        <div><span>{t.noShow}</span><strong>{summary.noShow}</strong></div>
        <div><span>{t.played}</span><strong>{summary.played}</strong></div>
      </div>

      <div className="card participation-monitor-card">
        <div className="card-title-row">
          <h2>{t.gameMonitorTitle}</h2>
          <span className={`queue-status ${monitorEnabled && streamerRiotId.trim() ? "good" : "neutral"}`}>
            {monitorEnabled && streamerRiotId.trim() ? t.active : t.closed}
          </span>
        </div>
        <form className="participation-monitor-form" onSubmit={(event) => void saveGameMonitor(event)}>
          <label className="field">
            <span>{t.streamerRiotId}</span>
            <input
              value={streamerRiotId}
              placeholder="StreamerName#KR1"
              onChange={(event) => setStreamerRiotId(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={monitorEnabled} onChange={(event) => setMonitorEnabled(event.target.checked)} />
            <span>{t.gameMonitorEnabled}</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={autoSelectNextAfterGame} onChange={(event) => setAutoSelectNextAfterGame(event.target.checked)} />
            <span>{t.autoSelectNext}</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={announceInChat} onChange={(event) => setAnnounceInChat(event.target.checked)} />
            <span>{t.announceInChat}</span>
          </label>
          <button className="secondary compact-button" disabled={monitorSaving} type="submit">{t.saveGameMonitor}</button>
        </form>
        <p className="muted">{gameMonitor?.streamerRiotId ? gameMonitor.streamerRiotId : t.gameMonitorWaiting}</p>
        {monitorMessage ? <p className="form-message">{monitorMessage}</p> : null}
      </div>

      <div className="card">
        <h2>{t.queueTitle}</h2>
        {queue.length === 0 ? <p className="muted">{t.empty}</p> : null}
        {queue.length > 0 ? (
          <div className="participation-table">
            {queue.map((entry) => (
              <div className="participation-row" key={entry.id}>
                <div className="queue-champion-card">
                  <span>#{entry.position}</span>
                  {championArtUrl(primaryChampion(entry.topChampions)) ? (
                    <img src={championArtUrl(primaryChampion(entry.topChampions))} alt="" />
                  ) : null}
                  <strong>{primaryChampion(entry.topChampions)?.nameKo ?? t.topChampions}</strong>
                </div>
                <div className="queue-user">
                  <strong>{entry.twitchUserName}</strong>
                  <span>{t.riotId}: {entry.riotId}</span>
                  <span>{t.profileStatus}: {profileStatusLabel(entry.profileStatus)}</span>
                  {entry.profileFailureReason ? <span>{t.profileFailureReason}: {entry.profileFailureReason}</span> : null}
                  <span>{t.mainRole}: {mainRoleLabel(entry.mainRole, entry.mainRoleConfidence)}</span>
                  <span>{t.topChampions}: {championLabel(entry.topChampions)}</span>
                </div>
                <div className="queue-role">
                  <span>{t.roleOverride}</span>
                  <select
                    aria-label={t.roleOverride}
                    value={entry.preferredRole ?? "unknown"}
                    onChange={(event) => void overrideRole(entry.id, event.target.value)}
                  >
                    {Object.keys(t.roles).map((role) => (
                      <option value={role} key={role}>{roleLabel(role)}</option>
                    ))}
                  </select>
                </div>
                <div className={`queue-status ${entry.status}`}>{statusLabel(entry.status)}</div>
                <div className="queue-meta">
                  <span>{t.source}: {sourceLabel(entry.source)}</span>
                  <span>{t.checkInUntil}: {formatTime(entry.checkInExpiresAt)}</span>
                  <span>{t.createdAt}: {formatTime(entry.createdAt)}</span>
                  <button className="secondary compact-button" onClick={() => void refreshProfile(entry.id)}>{t.refreshProfile}</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
