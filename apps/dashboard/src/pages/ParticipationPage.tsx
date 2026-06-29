import { useEffect, useState, type FormEvent } from "react";
import type { LolChampionSummary, ParticipationDashboardQueueEntry, ParticipationState, ParticipationStatus } from "@streamops/shared";
import { apiPost } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";

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
    manualControlTitle: "수동 상태 제어",
    manualControlHelp: "자동 게임 감지가 늦거나 챔피언 선택 단계일 때 대기열 표시 상태를 직접 전환합니다.",
    manualOpen: "모집 시작",
    manualShowQueue: "대기열 표시",
    manualMarkInGame: "앞 4명 게임 중",
    manualFinishGame: "게임 종료 처리",
    manualClose: "모집 종료",
    manualControlSaved: "시참 상태를 수동으로 갱신했습니다.",
    manualControlFailed: "시참 상태 수동 갱신에 실패했습니다.",
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
    profileSettingsTitle: "방송자 챔피언 스킨 설정",
    championSkinOverrides: "모스트 1 챔피언 스킨",
    championSkinOverridesHelp: "방송자 Riot ID가 등록되어 있고 Riot API key가 설정되어 있으면 숙련도 1등 챔피언의 스킨을 이미지로 선택할 수 있습니다.",
    saveProfileSettings: "선택 저장",
    reloadProfileSettings: "스킨 목록 새로고침",
    profileSettingsSaved: "스킨 설정을 저장했습니다.",
    profileSettingsLoadFailed: "스킨 설정을 불러오지 못했습니다.",
    profileSettingsSaveFailed: "스킨 설정 저장에 실패했습니다.",
    profileSettingsMissingStreamer: "방송자 Riot ID를 먼저 등록하세요.",
    profileSettingsRiotMissing: "Riot API key가 설정되어 있어야 스킨 목록을 불러올 수 있습니다.",
    profileSettingsNoChampion: "숙련도 1등 챔피언 정보를 찾지 못했습니다.",
    selectedSkin: "선택됨",
    refreshProfile: "프로필 새로고침",
    roleOverride: "수동 라인 보정",
    source: "신청 경로",
    checkInUntil: "확인 기한",
    createdAt: "신청 시간",
    none: "없음",
    unranked: "Unranked",
    soloRank: "솔로랭크",
    flexRank: "자유랭크",
    winRate: "승률",
    wins: "승",
    losses: "패",
    refreshing: "새로고침 요청 완료",
    refreshFailed: "프로필 새로고침 요청 실패",
    roleUpdated: "수동 라인 보정을 저장했습니다.",
    roleUpdateFailed: "수동 라인 보정에 실패했습니다.",
    entryStatusOverride: "수동 상태 변경",
    entryStatusUpdated: "참가자 상태를 변경했습니다.",
    entryStatusUpdateFailed: "참가자 상태 변경에 실패했습니다.",
    inviteMessage: "초대 링크/안내 메시지",
    invitePlaceholder: "초대 링크 또는 안내 메시지 입력",
    sendInvite: "전송",
    sendingInvite: "전송 중",
    inviteSent: "채팅으로 전송했습니다.",
    inviteFailed: "메시지 전송에 실패했습니다.",
    bulkInviteTitle: "대기열 일괄 전송",
    bulkInviteTargetCount: (count: number) => `대상 ${count}명`,
    bulkInvitePlaceholder: "대기열 참가자에게 보낼 공통 링크 또는 안내 메시지",
    sendBulkInvite: "대기열 일괄 전송",
    bulkInviteSent: (count: number, messages: number) => `${count}명에게 ${messages}개 채팅 메시지로 전송했습니다.`,
    bulkInviteNoTargets: "전송 가능한 대기열 참가자가 없습니다.",
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
    manualControlTitle: "手動状態制御",
    manualControlHelp: "自動試合検知が遅い場合やチャンピオン選択中に、待機列の表示状態を手動で切り替えます。",
    manualOpen: "募集開始",
    manualShowQueue: "待機列表示",
    manualMarkInGame: "先頭4人を試合中",
    manualFinishGame: "試合終了処理",
    manualClose: "募集終了",
    manualControlSaved: "参加状態を手動で更新しました。",
    manualControlFailed: "参加状態の手動更新に失敗しました。",
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
    profileSettingsTitle: "配信者チャンピオンスキン設定",
    championSkinOverrides: "得意1位チャンピオンスキン",
    championSkinOverridesHelp: "配信者 Riot ID が登録され、Riot API key が設定されている場合、熟練度1位チャンピオンのスキンを画像で選択できます。",
    saveProfileSettings: "選択を保存",
    reloadProfileSettings: "スキン一覧を更新",
    profileSettingsSaved: "スキン設定を保存しました。",
    profileSettingsLoadFailed: "スキン設定を読み込めませんでした。",
    profileSettingsSaveFailed: "スキン設定の保存に失敗しました。",
    profileSettingsMissingStreamer: "配信者 Riot ID を先に登録してください。",
    profileSettingsRiotMissing: "スキン一覧を読み込むには Riot API key が必要です。",
    profileSettingsNoChampion: "熟練度1位チャンピオン情報が見つかりませんでした。",
    selectedSkin: "選択中",
    refreshProfile: "プロフィール更新",
    roleOverride: "手動ロール補正",
    source: "申請経路",
    checkInUntil: "確認期限",
    createdAt: "申請時間",
    none: "なし",
    unranked: "Unranked",
    soloRank: "ソロランク",
    flexRank: "フレックス",
    winRate: "勝率",
    wins: "勝",
    losses: "敗",
    refreshing: "更新をリクエストしました。",
    refreshFailed: "プロフィール更新リクエストに失敗しました。",
    roleUpdated: "手動ロール補正を保存しました。",
    roleUpdateFailed: "手動ロール補正に失敗しました。",
    entryStatusOverride: "手動状態変更",
    entryStatusUpdated: "参加者の状態を変更しました。",
    entryStatusUpdateFailed: "参加者の状態変更に失敗しました。",
    inviteMessage: "招待リンク/案内メッセージ",
    invitePlaceholder: "招待リンクまたは案内メッセージを入力",
    sendInvite: "送信",
    sendingInvite: "送信中",
    inviteSent: "チャットに送信しました。",
    inviteFailed: "メッセージ送信に失敗しました。",
    bulkInviteTitle: "待機列一括送信",
    bulkInviteTargetCount: (count: number) => `対象 ${count}人`,
    bulkInvitePlaceholder: "待機列の参加者に送る共通リンクまたは案内メッセージ",
    sendBulkInvite: "待機列に一括送信",
    bulkInviteSent: (count: number, messages: number) => `${count}人に${messages}件のチャットメッセージで送信しました。`,
    bulkInviteNoTargets: "送信可能な待機列参加者がいません。",
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

const t = createDashboardLocaleProxy(i18n);
const INVITE_TARGET_STATUSES = new Set(["pending", "verified", "waitlisted", "selected", "checked_in", "invited"]);
const ENTRY_STATUS_OPTIONS: ParticipationStatus[] = [
  "pending",
  "verified",
  "waitlisted",
  "selected",
  "checked_in",
  "invited",
  "in_game",
  "played",
  "skipped",
  "cancelled",
  "no_show",
  "rejected",
  "blocked"
];
type ManualParticipationAction = "open" | "show_queue" | "mark_in_game" | "finish_game" | "close";

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

function apiErrorDetail(error: unknown, path: string, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return error.message.replace(new RegExp(`^${escapedPath} failed: \\d+(?: - )?`), "");
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
  const snapshotState = snapshot.participationState ?? fallbackState(snapshot);
  const [localState, setLocalState] = useState<ParticipationState>(snapshotState);
  const state = localState;
  const queue = state.queue ?? [];
  const summary = state.summary;
  const [inviteDrafts, setInviteDrafts] = useState<Record<string, string>>({});
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [inviteMessages, setInviteMessages] = useState<Record<string, string>>({});
  const [bulkInviteDraft, setBulkInviteDraft] = useState("");
  const [bulkInviteSending, setBulkInviteSending] = useState(false);
  const [bulkInviteMessage, setBulkInviteMessage] = useState("");
  const [manualBusyAction, setManualBusyAction] = useState<ManualParticipationAction | null>(null);
  const [manualMessage, setManualMessage] = useState("");
  const [entryStatusBusyId, setEntryStatusBusyId] = useState<string | null>(null);
  const [entryStatusMessages, setEntryStatusMessages] = useState<Record<string, string>>({});
  const bulkInviteTargets = queue.filter((entry) => INVITE_TARGET_STATUSES.has(entry.status));

  useEffect(() => {
    setLocalState(snapshot.participationState ?? fallbackState(snapshot));
  }, [snapshot]);

  async function refreshProfile(entryId: string) {
    try {
      const nextState = await apiPost<ParticipationState>("/api/participation/profile/refresh", { entryId });
      setLocalState(nextState);
      alert(t.refreshing);
    } catch {
      alert(t.refreshFailed);
    }
  }

  async function overrideRole(entryId: string, role: string) {
    try {
      const nextState = await apiPost<ParticipationState>("/api/participation/role-override", { entryId, role });
      setLocalState(nextState);
      alert(t.roleUpdated);
    } catch {
      alert(t.roleUpdateFailed);
    }
  }

  async function applyManualControl(action: ManualParticipationAction) {
    setManualBusyAction(action);
    setManualMessage("");
    try {
      const result = await apiPost<{ ok: boolean; action: ManualParticipationAction; phase: string; state: ParticipationState }>("/api/participation/manual-control", { action });
      setLocalState(result.state);
      setManualMessage(t.manualControlSaved);
    } catch (error) {
      setManualMessage(apiErrorDetail(error, "/api/participation/manual-control", t.manualControlFailed));
    } finally {
      setManualBusyAction(null);
    }
  }

  async function updateEntryStatus(entry: ParticipationDashboardQueueEntry, status: ParticipationStatus) {
    if (entry.status === status) return;
    setEntryStatusBusyId(entry.id);
    setEntryStatusMessages((previous) => ({ ...previous, [entry.id]: "" }));
    try {
      const nextState = await apiPost<ParticipationState>("/api/participation/entry-status", { entryId: entry.id, status });
      setLocalState(nextState);
      setEntryStatusMessages((previous) => ({ ...previous, [entry.id]: t.entryStatusUpdated }));
    } catch (error) {
      setEntryStatusMessages((previous) => ({ ...previous, [entry.id]: apiErrorDetail(error, "/api/participation/entry-status", t.entryStatusUpdateFailed) }));
    } finally {
      setEntryStatusBusyId(null);
    }
  }

  async function sendInviteMessage(event: FormEvent<HTMLFormElement>, entry: ParticipationDashboardQueueEntry) {
    event.preventDefault();
    const message = (inviteDrafts[entry.id] ?? "").trim();
    if (!message) return;
    setInviteBusyId(entry.id);
    setInviteMessages((previous) => ({ ...previous, [entry.id]: "" }));
    try {
      await apiPost<{ ok: boolean }>("/api/participation/invite-message", {
        entryId: entry.id,
        message
      });
      setInviteMessages((previous) => ({ ...previous, [entry.id]: t.inviteSent }));
    } catch (error) {
      setInviteMessages((previous) => ({ ...previous, [entry.id]: apiErrorDetail(error, "/api/participation/invite-message", t.inviteFailed) }));
    } finally {
      setInviteBusyId(null);
    }
  }

  async function sendBulkInviteMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = bulkInviteDraft.trim();
    if (!message || bulkInviteTargets.length === 0) {
      setBulkInviteMessage(t.bulkInviteNoTargets);
      return;
    }
    setBulkInviteSending(true);
    setBulkInviteMessage("");
    try {
      const result = await apiPost<{ ok: boolean; targetCount: number; sentMessages: number }>("/api/participation/invite-message/bulk", {
        entryIds: bulkInviteTargets.map((entry) => entry.id),
        message
      });
      setBulkInviteMessage(t.bulkInviteSent(result.targetCount, result.sentMessages));
    } catch (error) {
      setBulkInviteMessage(apiErrorDetail(error, "/api/participation/invite-message/bulk", t.inviteFailed));
    } finally {
      setBulkInviteSending(false);
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

      <div className="card participation-manual-card">
        <div>
          <h2>{t.manualControlTitle}</h2>
          <p className="muted">{t.manualControlHelp}</p>
        </div>
        <div className="participation-manual-actions">
          <button className="secondary compact-button" disabled={manualBusyAction !== null} onClick={() => void applyManualControl("open")}>{manualBusyAction === "open" ? t.sendingInvite : t.manualOpen}</button>
          <button className="secondary compact-button" disabled={manualBusyAction !== null} onClick={() => void applyManualControl("show_queue")}>{manualBusyAction === "show_queue" ? t.sendingInvite : t.manualShowQueue}</button>
          <button className="secondary compact-button" disabled={manualBusyAction !== null} onClick={() => void applyManualControl("mark_in_game")}>{manualBusyAction === "mark_in_game" ? t.sendingInvite : t.manualMarkInGame}</button>
          <button className="secondary compact-button" disabled={manualBusyAction !== null} onClick={() => void applyManualControl("finish_game")}>{manualBusyAction === "finish_game" ? t.sendingInvite : t.manualFinishGame}</button>
          <button className="secondary compact-button" disabled={manualBusyAction !== null} onClick={() => void applyManualControl("close")}>{manualBusyAction === "close" ? t.sendingInvite : t.manualClose}</button>
        </div>
        {manualMessage ? <p className="form-message">{manualMessage}</p> : null}
      </div>

      <div className="card">
        <h2>{t.queueTitle}</h2>
        {queue.length === 0 ? <p className="muted">{t.empty}</p> : null}
        {queue.length > 0 ? (
          <form className="queue-bulk-invite" onSubmit={(event) => void sendBulkInviteMessage(event)}>
            <div className="queue-bulk-invite-heading">
              <strong>{t.bulkInviteTitle}</strong>
              <span>{t.bulkInviteTargetCount(bulkInviteTargets.length)}</span>
            </div>
            <label className="field">
              <span>{t.inviteMessage}</span>
              <input
                value={bulkInviteDraft}
                placeholder={t.bulkInvitePlaceholder}
                onChange={(event) => setBulkInviteDraft(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button className="secondary compact-button" disabled={bulkInviteSending || !bulkInviteDraft.trim() || bulkInviteTargets.length === 0} type="submit">
              {bulkInviteSending ? t.sendingInvite : t.sendBulkInvite}
            </button>
            {bulkInviteMessage ? <p className="form-message">{bulkInviteMessage}</p> : null}
          </form>
        ) : null}
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
                <div className="queue-status-control">
                  <span className={`queue-status ${entry.status}`}>{statusLabel(entry.status)}</span>
                  <label className="queue-status-select">
                    <span>{t.entryStatusOverride}</span>
                    <select
                      aria-label={t.entryStatusOverride}
                      value={entry.status}
                      disabled={entryStatusBusyId === entry.id}
                      onChange={(event) => void updateEntryStatus(entry, event.target.value as ParticipationStatus)}
                    >
                      {ENTRY_STATUS_OPTIONS.map((status) => (
                        <option value={status} key={status}>{statusLabel(status)}</option>
                      ))}
                    </select>
                  </label>
                  {entryStatusMessages[entry.id] ? <p className="form-message">{entryStatusMessages[entry.id]}</p> : null}
                </div>
                <div className="queue-meta">
                  <span>{t.source}: {sourceLabel(entry.source)}</span>
                  <span>{t.checkInUntil}: {formatTime(entry.checkInExpiresAt)}</span>
                  <span>{t.createdAt}: {formatTime(entry.createdAt)}</span>
                  <button className="secondary compact-button" onClick={() => void refreshProfile(entry.id)}>{t.refreshProfile}</button>
                </div>
                <form className="queue-invite" onSubmit={(event) => void sendInviteMessage(event, entry)}>
                  <label className="field">
                    <span>{t.inviteMessage}</span>
                    <input
                      value={inviteDrafts[entry.id] ?? ""}
                      placeholder={t.invitePlaceholder}
                      onChange={(event) => setInviteDrafts((previous) => ({ ...previous, [entry.id]: event.target.value }))}
                      autoComplete="off"
                    />
                  </label>
                  <button className="secondary compact-button" disabled={inviteBusyId === entry.id || !(inviteDrafts[entry.id] ?? "").trim()} type="submit">
                    {inviteBusyId === entry.id ? t.sendingInvite : t.sendInvite}
                  </button>
                  {inviteMessages[entry.id] ? <p className="form-message">{inviteMessages[entry.id]}</p> : null}
                </form>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
