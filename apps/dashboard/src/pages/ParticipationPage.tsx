import { useEffect, useState, type FormEvent } from "react";
import type { LolChampionSummary, ParticipationDashboardQueueEntry, ParticipationState, ParticipationStatus } from "@streamops/shared";
import { apiPost } from "../api/client";
import { createDashboardLocaleProxy, dashboardLocale } from "../i18n";
import {
  AppShell,
  AppShellHeader,
  AppShellMain,
} from "../shared/ui/AppShell";
import { Button } from "../shared/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../shared/ui/Card";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../shared/ui/EmptyState";
import { FormControl, FormField, FormLabel, Input, Select } from "../shared/ui/Form";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../shared/ui/Modal";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle,
} from "../shared/ui/PageHeader";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill, type StatusTone } from "../shared/ui/Status";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastTone,
} from "../shared/ui/Toast";

export type DashboardSnapshot = {
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
    studio: "Participation Studio",
    current: "현재",
    close: "닫기",
    confirm: "확인",
    cancelAction: "취소",
    confirmTitle: "작업 확인",
    confirmManualDescription: "방송 중 대기열 상태가 즉시 변경됩니다. 계속 진행할까요?",
    confirmStatusDescription: "참가자 상태를 변경합니다. 오버레이와 대기열 표시가 함께 갱신될 수 있습니다.",
    confirmInviteDescription: "Twitch 채팅으로 안내 메시지를 전송합니다.",
    skipLink: "시참 관리 본문으로 이동",
    loading: "시참 대기열을 불러오는 중입니다.",
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
    manualStatuses: {
      waitlisted: "대기 중",
      in_game: "게임 중",
      played: "완료",
      cancelled: "취소"
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
    studio: "Participation Studio",
    current: "現在",
    close: "閉じる",
    confirm: "確認",
    cancelAction: "キャンセル",
    confirmTitle: "操作確認",
    confirmManualDescription: "配信中の待機列状態がすぐに変更されます。続行しますか？",
    confirmStatusDescription: "参加者の状態を変更します。オーバーレイと待機列表示も更新される場合があります。",
    confirmInviteDescription: "Twitch チャットに案内メッセージを送信します。",
    skipLink: "参加管理本文へ移動",
    loading: "参加待機列を読み込んでいます。",
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
    manualStatuses: {
      waitlisted: "待機中",
      in_game: "ゲーム中",
      played: "完了",
      cancelled: "取消"
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
type ManualEntryStatus = Extract<ParticipationStatus, "waitlisted" | "in_game" | "played" | "cancelled">;
const ENTRY_STATUS_OPTIONS: ManualEntryStatus[] = ["waitlisted", "in_game", "played", "cancelled"];
const CANCELLED_ENTRY_STATUSES = new Set<ParticipationStatus>(["skipped", "cancelled", "no_show", "rejected", "blocked"]);
type ManualParticipationAction = "open" | "show_queue" | "mark_in_game" | "finish_game" | "close";

type ParticipationToast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type PendingParticipationAction =
  | {
      kind: "manual";
      action: ManualParticipationAction;
      title: string;
      description: string;
      confirmLabel: string;
      tone: "danger" | "primary" | "secondary";
    }
  | {
      kind: "entryStatus";
      entry: ParticipationDashboardQueueEntry;
      status: ParticipationStatus;
      title: string;
      description: string;
      confirmLabel: string;
      tone: "danger" | "primary" | "secondary";
    }
  | {
      kind: "invite";
      entry: ParticipationDashboardQueueEntry;
      message: string;
      title: string;
      description: string;
      confirmLabel: string;
      tone: "danger" | "primary" | "secondary";
    }
  | {
      kind: "bulkInvite";
      message: string;
      title: string;
      description: string;
      confirmLabel: string;
      tone: "danger" | "primary" | "secondary";
    };

function manualActionLabel(action: ManualParticipationAction): string {
  if (action === "open") return t.manualOpen;
  if (action === "show_queue") return t.manualShowQueue;
  if (action === "mark_in_game") return t.manualMarkInGame;
  if (action === "finish_game") return t.manualFinishGame;
  return t.manualClose;
}

function manualActionTone(action: ManualParticipationAction): "danger" | "primary" | "secondary" {
  if (action === "close" || action === "mark_in_game" || action === "finish_game") return "danger";
  if (action === "open") return "primary";
  return "secondary";
}

function participationStatusTone(status: string | undefined): StatusTone {
  if (status === "verified" || status === "checked_in" || status === "played") return "success";
  if (status === "selected" || status === "invited" || status === "in_game") return "info";
  if (status === "no_show" || status === "skipped" || status === "rejected" || status === "blocked" || status === "cancelled") return "danger";
  if (status === "pending" || status === "waitlisted") return "warning";
  return "neutral";
}

function profileStatusTone(status: string | undefined): StatusTone {
  if (status === "ready") return "success";
  if (status === "failed" || status === "rate_limited") return "danger";
  if (status === "analyzing") return "info";
  return "neutral";
}

function isDestructiveStatus(status: ParticipationStatus): boolean {
  return ["cancelled", "no_show", "rejected", "blocked", "skipped"].includes(status);
}

function roleLabel(role: string | undefined): string {
  if (!role) return t.roles.unknown;
  return t.roles[role as keyof typeof t.roles] ?? role;
}

function normalizeManualEntryStatus(status: ParticipationStatus): ManualEntryStatus {
  if (status === "in_game" || status === "played") return status;
  if (CANCELLED_ENTRY_STATUSES.has(status)) return "cancelled";
  return "waitlisted";
}

function manualStatusLabel(status: ManualEntryStatus): string {
  return t.manualStatuses[status];
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

function championDisplayName(champion: LolChampionSummary | undefined): string {
  if (!champion) return t.none;
  if (dashboardLocale === "ja") return champion.nameJa ?? champion.nameKo ?? champion.championKey ?? String(champion.championId);
  return champion.nameKo ?? champion.nameJa ?? champion.championKey ?? String(champion.championId);
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

export function ParticipationPage({
  snapshot,
  embedded = false,
  onStateChange,
}: {
  snapshot: DashboardSnapshot;
  embedded?: boolean;
  onStateChange?: (state: ParticipationState) => void;
}) {
  const snapshotState = snapshot.participationState ?? fallbackState(snapshot);
  const [localState, setLocalState] = useState<ParticipationState>(snapshotState);
  const state = localState;
  const queue = state.queue ?? [];
  const summary = state.summary;
  const cancelledCount = queue.filter((entry) => entry.status === "cancelled").length;
  const isSnapshotLoading = !snapshot.participationState && !snapshot.participationQueue && !snapshot.status?.participation;
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
  const [pendingAction, setPendingAction] = useState<PendingParticipationAction | null>(null);
  const [toast, setToast] = useState<ParticipationToast | null>(null);
  const bulkInviteTargets = queue.filter((entry) => INVITE_TARGET_STATUSES.has(entry.status));

  useEffect(() => {
    setLocalState(snapshot.participationState ?? fallbackState(snapshot));
  }, [snapshot]);

  useEffect(() => {
    onStateChange?.(localState);
  }, [localState, onStateChange]);

  function showToast(tone: ToastTone, title: string, description?: string): void {
    setToast({ id: Date.now(), tone, title, description });
  }

  async function refreshProfile(entryId: string) {
    try {
      const nextState = await apiPost<ParticipationState>("/api/participation/profile/refresh", { entryId });
      setLocalState(nextState);
      showToast("success", t.refreshing);
    } catch {
      showToast("danger", t.refreshFailed);
    }
  }

  async function overrideRole(entryId: string, role: string) {
    try {
      const nextState = await apiPost<ParticipationState>("/api/participation/role-override", { entryId, role });
      setLocalState(nextState);
      showToast("success", t.roleUpdated);
    } catch {
      showToast("danger", t.roleUpdateFailed);
    }
  }

  async function applyManualControl(action: ManualParticipationAction) {
    setManualBusyAction(action);
    setManualMessage("");
    try {
      const result = await apiPost<{ ok: boolean; action: ManualParticipationAction; phase: string; state: ParticipationState }>("/api/participation/manual-control", { action });
      setLocalState(result.state);
      setManualMessage(t.manualControlSaved);
      showToast("success", t.manualControlSaved, manualActionLabel(action));
    } catch (error) {
      const message = apiErrorDetail(error, "/api/participation/manual-control", t.manualControlFailed);
      setManualMessage(message);
      showToast("danger", t.manualControlFailed, message);
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
      showToast("success", t.entryStatusUpdated, `${entry.twitchUserName} · ${manualStatusLabel(normalizeManualEntryStatus(status))}`);
    } catch (error) {
      const message = apiErrorDetail(error, "/api/participation/entry-status", t.entryStatusUpdateFailed);
      setEntryStatusMessages((previous) => ({ ...previous, [entry.id]: message }));
      showToast("danger", t.entryStatusUpdateFailed, message);
    } finally {
      setEntryStatusBusyId(null);
    }
  }

  async function sendInviteMessage(entry: ParticipationDashboardQueueEntry, message: string) {
    setInviteBusyId(entry.id);
    setInviteMessages((previous) => ({ ...previous, [entry.id]: "" }));
    try {
      await apiPost<{ ok: boolean }>("/api/participation/invite-message", {
        entryId: entry.id,
        message
      });
      setInviteMessages((previous) => ({ ...previous, [entry.id]: t.inviteSent }));
      showToast("success", t.inviteSent, entry.twitchUserName);
    } catch (error) {
      const detail = apiErrorDetail(error, "/api/participation/invite-message", t.inviteFailed);
      setInviteMessages((previous) => ({ ...previous, [entry.id]: detail }));
      showToast("danger", t.inviteFailed, detail);
    } finally {
      setInviteBusyId(null);
    }
  }

  async function sendBulkInviteMessage(message: string) {
    if (!message || bulkInviteTargets.length === 0) {
      setBulkInviteMessage(t.bulkInviteNoTargets);
      showToast("warning", t.bulkInviteNoTargets);
      return;
    }
    setBulkInviteSending(true);
    setBulkInviteMessage("");
    try {
      const result = await apiPost<{ ok: boolean; targetCount: number; sentMessages: number }>("/api/participation/invite-message/bulk", {
        entryIds: bulkInviteTargets.map((entry) => entry.id),
        message
      });
      const resultMessage = t.bulkInviteSent(result.targetCount, result.sentMessages);
      setBulkInviteMessage(resultMessage);
      showToast("success", resultMessage);
    } catch (error) {
      const detail = apiErrorDetail(error, "/api/participation/invite-message/bulk", t.inviteFailed);
      setBulkInviteMessage(detail);
      showToast("danger", t.inviteFailed, detail);
    } finally {
      setBulkInviteSending(false);
    }
  }

  function requestManualControl(action: ManualParticipationAction): void {
    setPendingAction({
      kind: "manual",
      action,
      title: manualActionLabel(action),
      description: t.confirmManualDescription,
      confirmLabel: manualActionLabel(action),
      tone: manualActionTone(action)
    });
  }

  function requestEntryStatus(entry: ParticipationDashboardQueueEntry, status: ParticipationStatus): void {
    if (entry.status === status) return;
    setPendingAction({
      kind: "entryStatus",
      entry,
      status,
      title: `${entry.twitchUserName} · ${manualStatusLabel(normalizeManualEntryStatus(status))}`,
      description: t.confirmStatusDescription,
      confirmLabel: t.confirm,
      tone: isDestructiveStatus(status) ? "danger" : "primary"
    });
  }

  function requestInviteMessage(event: FormEvent<HTMLFormElement>, entry: ParticipationDashboardQueueEntry): void {
    event.preventDefault();
    const message = (inviteDrafts[entry.id] ?? "").trim();
    if (!message) return;
    setPendingAction({
      kind: "invite",
      entry,
      message,
      title: `${entry.twitchUserName} · ${t.sendInvite}`,
      description: t.confirmInviteDescription,
      confirmLabel: t.sendInvite,
      tone: "primary"
    });
  }

  function requestBulkInviteMessage(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const message = bulkInviteDraft.trim();
    if (!message || bulkInviteTargets.length === 0) {
      setBulkInviteMessage(t.bulkInviteNoTargets);
      showToast("warning", t.bulkInviteNoTargets);
      return;
    }
    setPendingAction({
      kind: "bulkInvite",
      message,
      title: t.bulkInviteTitle,
      description: t.confirmInviteDescription,
      confirmLabel: t.sendBulkInvite,
      tone: "primary"
    });
  }

  async function confirmPendingAction(): Promise<void> {
    if (!pendingAction) return;
    const action = pendingAction;
    if (action.kind === "manual") {
      await applyManualControl(action.action);
    } else if (action.kind === "entryStatus") {
      await updateEntryStatus(action.entry, action.status);
    } else if (action.kind === "invite") {
      await sendInviteMessage(action.entry, action.message);
    } else {
      await sendBulkInviteMessage(action.message);
    }
    setPendingAction(null);
  }

  const pendingActionBusy = manualBusyAction !== null || entryStatusBusyId !== null || inviteBusyId !== null || bulkInviteSending;

  return (
    <>
      <AppShell
        as="section"
        className={`participation-shared-shell${embedded ? " lol-operations-embedded" : ""}`}
        mainId="participation-shared-main"
        skipLinkLabel={t.skipLink}
        variant="streamer"
      >
        {!embedded ? (
          <AppShellHeader className="participation-shared-header">
            <PageHeader className="participation-shared-page-header" layout="split">
              <PageHeaderEyebrow>{t.studio}</PageHeaderEyebrow>
              <PageHeaderTitle>{t.title}</PageHeaderTitle>
              <PageHeaderDescription>{t.commandHint}</PageHeaderDescription>
              <PageHeaderStatus>
                <StatusPill tone={state.isOpen ? "success" : "neutral"}>
                  {state.isOpen ? t.open : t.closed}
                </StatusPill>
              </PageHeaderStatus>
              <PageHeaderActions>
                <Badge tone="info">{t.current}</Badge>
              </PageHeaderActions>
            </PageHeader>
          </AppShellHeader>
        ) : null}

        <AppShellMain className="participation-shared-main" id="participation-shared-main">
          <div className="participation-shared-grid">
            <div className="participation-shared-metrics" aria-label={t.queueTitle}>
              <Metric label={t.active} value={summary.active} tone="info" />
              <Metric label={t.waiting} value={summary.waiting} tone="warning" />
              <Metric label={t.selected} value={summary.selected} tone="streamer" />
              <Metric label={t.checkedIn} value={summary.checkedIn} tone="success" />
              <Metric label={t.noShow} value={summary.noShow} tone="danger" />
              <Metric label={t.played} value={summary.played} tone="neutral" />
              <Metric label={t.statuses.cancelled} value={cancelledCount} tone={cancelledCount > 0 ? "danger" : "neutral"} />
            </div>

            {isSnapshotLoading ? (
              <SkeletonCard loadingLabel={t.loading} size="lg">
                <SkeletonText lines={4} size="md" />
              </SkeletonCard>
            ) : null}

            <Card as="section" className="participation-shared-card participation-shared-control" id="participation-shared-control" padding="lg" variant="glass">
              <CardHeader className="participation-shared-card-header">
                <div>
                  <CardTitle as="h2">{t.manualControlTitle}</CardTitle>
                  <CardDescription>{t.manualControlHelp}</CardDescription>
                </div>
                <StatusPill tone={state.isOpen ? "success" : "neutral"}>{state.isOpen ? t.open : t.closed}</StatusPill>
              </CardHeader>
              <CardContent>
                <div className="participation-shared-action-row">
                  {(["open", "show_queue", "mark_in_game", "finish_game", "close"] as const).map((action) => (
                    <Button
                      key={action}
                      disabled={manualBusyAction !== null}
                      loading={manualBusyAction === action}
                      onClick={() => requestManualControl(action)}
                      variant={manualActionTone(action)}
                    >
                      {manualBusyAction === action ? t.sendingInvite : manualActionLabel(action)}
                    </Button>
                  ))}
                </div>
                {manualMessage ? <StatusPill tone={manualMessage === t.manualControlSaved ? "success" : "danger"}>{manualMessage}</StatusPill> : null}
              </CardContent>
            </Card>

            <Card as="section" className="participation-shared-card participation-shared-queue-card" id="participation-shared-queue" padding="lg" variant="glass">
              <CardHeader className="participation-shared-card-header">
                <div>
                  <CardTitle as="h2">{t.queueTitle}</CardTitle>
                  <CardDescription>{t.bulkInviteTargetCount(bulkInviteTargets.length)}</CardDescription>
                </div>
                <Badge tone={queue.length > 0 ? "streamer" : "neutral"}>{queue.length}</Badge>
              </CardHeader>
              <CardContent className="participation-shared-queue-content">
                {queue.length === 0 ? (
                  <EmptyState className="participation-shared-empty" variant="streamer">
                    <EmptyStateIcon>Q</EmptyStateIcon>
                    <EmptyStateTitle as="h3">{t.empty}</EmptyStateTitle>
                    <EmptyStateDescription>{t.commandHint}</EmptyStateDescription>
                  </EmptyState>
                ) : null}

                {queue.length > 0 ? (
                  <form className="participation-shared-bulk-invite" id="participation-shared-invite" onSubmit={requestBulkInviteMessage}>
                    <div className="participation-shared-bulk-head">
                      <strong>{t.bulkInviteTitle}</strong>
                      <Badge tone={bulkInviteTargets.length > 0 ? "info" : "warning"}>{t.bulkInviteTargetCount(bulkInviteTargets.length)}</Badge>
                    </div>
                    <FormField className="participation-shared-form-field" controlId="participation-bulk-invite">
                      <FormLabel>{t.inviteMessage}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          id="participation-bulk-invite"
                          onChange={(event) => setBulkInviteDraft(event.target.value)}
                          placeholder={t.bulkInvitePlaceholder}
                          value={bulkInviteDraft}
                        />
                      </FormControl>
                    </FormField>
                    <Button disabled={bulkInviteSending || !bulkInviteDraft.trim() || bulkInviteTargets.length === 0} loading={bulkInviteSending} type="submit" variant="secondary">
                      {bulkInviteSending ? t.sendingInvite : t.sendBulkInvite}
                    </Button>
                    {bulkInviteMessage ? <StatusPill tone={bulkInviteMessage === t.bulkInviteNoTargets || bulkInviteMessage === t.inviteFailed ? "warning" : "success"}>{bulkInviteMessage}</StatusPill> : null}
                  </form>
                ) : null}

                {queue.length > 0 ? (
                  <div className="participation-shared-queue-list">
                    {queue.map((entry) => {
                      const champion = primaryChampion(entry.topChampions);
                      const artUrl = championArtUrl(champion);
                      const manualStatus = normalizeManualEntryStatus(entry.status);
                      return (
                        <Card as="article" className="participation-shared-queue-row" key={entry.id} padding="md" variant="elevated">
                          <div className="participation-shared-champion-card">
                            <span>#{entry.position}</span>
                            {artUrl ? <img src={artUrl} alt="" /> : null}
                            {champion ? <strong>{championDisplayName(champion)}</strong> : null}
                          </div>

                          <div className="participation-shared-user">
                            <strong>{entry.twitchUserName}</strong>
                            <span>{t.riotId}: {entry.riotId}</span>
                            <div className="participation-shared-chip-row">
                              <StatusPill size="sm" tone={participationStatusTone(manualStatus)}>{manualStatusLabel(manualStatus)}</StatusPill>
                              <Badge size="sm" tone={profileStatusTone(entry.profileStatus)}>{profileStatusLabel(entry.profileStatus)}</Badge>
                              <Badge size="sm" tone="info">{mainRoleLabel(entry.mainRole, entry.mainRoleConfidence)}</Badge>
                              <span className="participation-shared-created-at">{t.createdAt}: {formatTime(entry.createdAt)}</span>
                            </div>
                            {entry.profileFailureReason ? <span>{t.profileFailureReason}: {entry.profileFailureReason}</span> : null}
                          </div>

                          <div className="participation-shared-controls">
                            <FormField controlId={`participation-role-${entry.id}`}>
                              <FormLabel>{t.roleOverride}</FormLabel>
                              <FormControl>
                                <Select
                                  aria-label={t.roleOverride}
                                  id={`participation-role-${entry.id}`}
                                  onChange={(event) => void overrideRole(entry.id, event.target.value)}
                                  value={entry.preferredRole ?? "unknown"}
                                >
                                  {Object.keys(t.roles).map((role) => (
                                    <option value={role} key={role}>{roleLabel(role)}</option>
                                  ))}
                                </Select>
                              </FormControl>
                            </FormField>
                            <FormField controlId={`participation-status-${entry.id}`} loading={entryStatusBusyId === entry.id}>
                              <FormLabel>{t.entryStatusOverride}</FormLabel>
                              <FormControl>
                                <Select
                                  aria-label={t.entryStatusOverride}
                                  disabled={entryStatusBusyId === entry.id}
                                  id={`participation-status-${entry.id}`}
                                  onChange={(event) => requestEntryStatus(entry, event.target.value as ManualEntryStatus)}
                                  value={manualStatus}
                                >
                                  {ENTRY_STATUS_OPTIONS.map((status) => (
                                    <option value={status} key={status}>{manualStatusLabel(status)}</option>
                                  ))}
                                </Select>
                              </FormControl>
                            </FormField>
                            <Button className="participation-shared-refresh-button" onClick={() => void refreshProfile(entry.id)} size="sm" variant="secondary">
                              {t.refreshProfile}
                            </Button>
                            {entryStatusMessages[entry.id] ? <StatusPill size="sm" tone={entryStatusMessages[entry.id] === t.entryStatusUpdated ? "success" : "danger"}>{entryStatusMessages[entry.id]}</StatusPill> : null}
                          </div>

                          <form className="participation-shared-invite" onSubmit={(event) => requestInviteMessage(event, entry)}>
                            <FormField className="participation-shared-form-field" controlId={`participation-invite-${entry.id}`}>
                              <FormLabel>{t.inviteMessage}</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="off"
                                  id={`participation-invite-${entry.id}`}
                                  onChange={(event) => setInviteDrafts((previous) => ({ ...previous, [entry.id]: event.target.value }))}
                                  placeholder={t.invitePlaceholder}
                                  value={inviteDrafts[entry.id] ?? ""}
                                />
                              </FormControl>
                            </FormField>
                            <Button disabled={inviteBusyId === entry.id || !(inviteDrafts[entry.id] ?? "").trim()} loading={inviteBusyId === entry.id} size="sm" type="submit" variant="secondary">
                              {inviteBusyId === entry.id ? t.sendingInvite : t.sendInvite}
                            </Button>
                            {inviteMessages[entry.id] ? <StatusPill size="sm" tone={inviteMessages[entry.id] === t.inviteSent ? "success" : "danger"}>{inviteMessages[entry.id]}</StatusPill> : null}
                          </form>
                        </Card>
                      );
                    })}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </AppShellMain>
      </AppShell>

      <Modal
        closeOnBackdrop
        onOpenChange={(open) => {
          if (!open && !pendingActionBusy) setPendingAction(null);
        }}
        open={Boolean(pendingAction)}
        size="md"
      >
        <ModalHeader>
          <ModalTitle>{pendingAction?.title ?? t.confirmTitle}</ModalTitle>
          <ModalDescription>{pendingAction?.description ?? t.confirmManualDescription}</ModalDescription>
        </ModalHeader>
        <ModalContent>
          {pendingAction?.kind === "invite" || pendingAction?.kind === "bulkInvite" ? (
            <div className="participation-shared-modal-message">
              <Badge tone="info">{t.inviteMessage}</Badge>
              <p>{pendingAction.message}</p>
            </div>
          ) : null}
        </ModalContent>
        <ModalFooter>
          <Button disabled={!pendingAction} loading={pendingActionBusy} onClick={() => void confirmPendingAction()} variant={pendingAction?.tone ?? "primary"}>
            {pendingAction?.confirmLabel ?? t.confirm}
          </Button>
          <ModalCloseButton aria-label={t.close} disabled={pendingActionBusy}>
            {t.cancelAction}
          </ModalCloseButton>
        </ModalFooter>
      </Modal>

      <ToastProvider position="bottom-right">
        <ToastViewport className="participation-shared-toast-viewport">
          {toast ? (
            <Toast
              autoDismiss
              key={toast.id}
              onOpenChange={(open) => {
                if (!open) setToast(null);
              }}
              tone={toast.tone}
            >
              <ToastTitle>{toast.title}</ToastTitle>
              {toast.description ? <ToastDescription>{toast.description}</ToastDescription> : null}
              <ToastCloseButton aria-label={t.close}>×</ToastCloseButton>
            </Toast>
          ) : null}
        </ToastViewport>
      </ToastProvider>
    </>
  );
}
