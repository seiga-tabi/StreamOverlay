import {
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";
import { DiscordSymbolIcon } from "../../shared/DiscordSymbolIcon";
import { TwitchGlitchIcon } from "../../shared/TwitchGlitchIcon";
import { detectDashboardLocale, setDashboardLocale, type DashboardLocale } from "../../i18n";
import { AuthRequiredState } from "../../shared/ui/AuthRequiredState";
import { FollowersPage, safeFollowerOAuthUrl } from "../../pages/FollowersPage";
import { MyRiotAccountPage } from "../../pages/MyRiotAccountPage";
import type { DashboardStreamerInfo } from "../../api/client";
import { BotManagementPage } from "../bot-management/BotManagementPage";
import { DiscordSetupPage } from "../discord-onboarding/DiscordSetupPage";
import { LolChrome } from "../public-home/components/LolChrome";
import type {
  BotManagementGameServer,
  DiscordBotControlOverview,
  ParticipationState
} from "@streamops/shared";
import {
  getManagementBotControl,
  getManagementSession,
  listManagementGameServers,
  type BotManagementSession
} from "../bot-management/api";
import { YoroAccountPage } from "../yoro-account/YoroAccountPage";
import {
  accountOAuthUrl,
  logoutAccount,
  updateAccountPreferences,
  type YoroDashboardPage,
  type YoroUserPreferences
} from "../yoro-account/api";
import {
  authenticatedYoroIdentity,
  useYoroAccountSession
} from "../yoro-account/useYoroAccountSession";
import {
  applyForStreamer,
  getYoroFollowers,
  getYoroParticipation,
  getYoroStreamerStatus,
  refreshYoroFollowers,
  startFollowerPermission,
  updateYoroRiotId,
  type YoroStreamerStatus
} from "./api";
import { DashboardBottomTabBar } from "./DashboardBottomTabBar";
import {
  DashboardChrome,
  type DashboardTopLevelPage
} from "./DashboardChrome";
import { ParticipationManagementPage } from "./ParticipationManagementPage";

type UnifiedDashboardPage =
  | YoroDashboardPage
  | "organizationBot"
  | "organizationServers"
  | "streaming"
  | "streamingParticipation"
  | "streamingFollowers"
  | "streamingRiot";

const copy = {
  ko: {
    brand: "YORO.gg Dashboard",
    overview: "홈",
    account: "연결 계정",
    organizationGroup: "Organization",
    organizations: "개요",
    organizationBot: "Discord Bot 제어",
    organizationServers: "Palworld 서버",
    streamingGroup: "스트리머",
    streaming: "이용 상태",
    streamingParticipation: "시청자 참여",
    streamingFollowers: "Followers",
    streamingRiot: "Riot ID",
    settings: "개인 설정",
    loginTitle: "YORO.gg 로그인이 필요합니다.",
    loginDescription: "Discord 또는 Twitch 계정으로 로그인하면 공통 Dashboard를 이용할 수 있습니다.",
    login: "로그인",
    loading: "Dashboard를 불러오는 중입니다.",
    failed: "Dashboard 정보를 불러오지 못했습니다.",
    identityTitle: "로그인 계정",
    organizationTitle: "Organization",
    organizationEmptyDescription: "Discord 계정을 연결하고 YORO Bot이 설치된 서버를 선택해 시작하세요.",
    organizationManage: "Organization 관리",
    roleOwner: "소유자",
    roleManager: "관리자",
    roleViewer: "조회자",
    manage: "관리",
    connected: "연결됨",
    notConnected: "미연결",
    actionRequired: "필요",
    setupTitle: "설정을 마치면 스트리머 기능이 열립니다",
    stepAccountHint: "스트리머 신청에 Twitch 계정이 필요합니다.",
    stepApplicationHint: "Riot ID로 승인을 신청합니다.",
    stepApprovalHint: "관리자 검토가 끝나면 열립니다.",
    stepPermissionHint: "Followers 조회 권한만 별도로 승인합니다.",
    opsParticipationOpen: "시청자 참여 열림",
    opsParticipationClosed: "시청자 참여 닫힘",
    opsQueueDetail: "대기 {waiting}명 · 선정 {selected}명",
    opsParticipationIdle: "참여를 시작하면 대기열이 열립니다",
    opsFollowerTitle: "Followers 최근 갱신",
    opsFollowerNever: "아직 갱신하지 않았습니다",
    opsFollowerAction: "지금 갱신하기",
    opsFollowerFresh: "최신 상태입니다",
    opsSectionLabel: "운영 상태",
    opsBotInstalled: "Discord Bot 설치됨",
    opsBotMissing: "Discord Bot 미설치",
    opsBotModuleOff: "Palworld 상태 기능 꺼짐",
    opsBotInstall: "서버에 Bot을 추가하세요",
    opsServerReady: "게임 서버 연결 정상",
    opsServerPending: "게임 서버 연결 확인 중",
    opsServerUnavailable: "게임 서버 연결 실패",
    opsServerRevoked: "게임 서버 인증 만료",
    opsServerNotConfigured: "게임 서버 연결 미설정",
    opsServerNone: "등록한 게임 서버 없음",
    opsServerAdd: "Palworld 서버를 등록하세요",
    followerDelta7d: "7일 신규 +{n}",
    timeJustNow: "방금",
    timeMinutes: "{n}분 전",
    timeHours: "{n}시간 전",
    timeDays: "{n}일 전",
    participationCount: "참여 신청",
    participationDetail: "오늘 {played}명 참여",
    organizationCount: "Organization",
    organizationDetail: "소유 {owner} · 그 외 {other}",
    connectedAccounts: "연결된 계정",
    streamerNotRequested: "미신청",
    streamerPending: "승인 대기",
    streamerApproved: "승인 완료",
    streamerRejected: "재신청 필요",
    followerCount: "Followers",
    unavailable: "미등록",
    stepAccount: "계정 연결",
    stepApplication: "스트리머 신청",
    stepApproval: "승인 완료",
    stepPermission: "권한 승인",
    complete: "완료",
    waiting: "대기",
    streamerTitle: "스트리머 이용 상태",
    streamerDescription: "Twitch 계정 연결 후 Riot ID로 스트리머 승인을 요청할 수 있습니다.",
    twitchConnectionRequired: "Twitch 계정 연결이 필요합니다.",
    twitchConnectionDescription: "이미 연결한 계정은 다시 연결할 필요가 없습니다. 연결 정보가 만료된 경우에만 권한을 다시 승인합니다.",
    connectTwitch: "Twitch 계정 연결",
    permissionRefresh: "Twitch 기본 권한 다시 승인",
    riotIdLabel: "Riot ID",
    riotIdPlaceholder: "게임명#태그",
    apply: "스트리머 승인 신청",
    applying: "신청 중",
    applyDone: "스트리머 승인 신청을 접수했습니다.",
    applyFailed: "스트리머 승인 신청에 실패했습니다.",
    pendingDescription: "관리자 검토가 끝나면 스트리머 메뉴를 사용할 수 있습니다.",
    approvedDescription: "스트리머 기능을 사용할 수 있습니다. Followers 조회는 별도 최소 권한 승인이 필요합니다.",
    rejectedDescription: "Riot ID를 확인한 뒤 다시 신청해주세요.",
    permissionDescription: "Followers 조회에 필요한 moderator:read:followers 권한만 별도로 승인합니다.",
    permissionConnected: "권한 승인 완료",
    permissionRequired: "권한 승인 필요",
    permissionAction: "Twitch 권한 승인",
    permissionRenew: "Twitch 권한 다시 승인",
    permissionOpening: "Twitch로 이동 중",
    permissionFailed: "Twitch 권한 승인 화면을 열지 못했습니다.",
    approvalRequired: "스트리머 승인 후 사용할 수 있습니다.",
    streamerLoadFailed: "스트리머 이용 상태를 불러오지 못했습니다.",
    settingsEyebrow: "계정 환경설정",
    settingsTitle: "개인 설정",
    settingsDescription: "이 설정은 YORO 계정에 저장되어 다른 기기에서도 적용됩니다.",
    settingsAccount: "현재 계정",
    settingsSynced: "계정 동기화",
    settingsSyncedDescription: "저장한 설정은 로그인한 모든 기기에 안전하게 적용됩니다.",
    generalSettings: "일반 설정",
    generalSettingsDescription: "Dashboard에서 사용할 기본 표시 언어를 선택합니다.",
    dashboardSettings: "Dashboard 설정",
    dashboardSettingsDescription: "로그인 직후 처음 표시할 화면을 지정합니다.",
    accessibilitySettings: "접근성",
    accessibilitySettingsDescription: "화면 움직임을 줄여 더 편안하게 이용할 수 있습니다.",
    language: "표시 언어",
    languageDescription: "Dashboard 메뉴와 안내 문구에 적용됩니다.",
    languageKo: "한국어",
    languageJa: "日本語",
    startPage: "기본 Dashboard 화면",
    startPageDescription: "Dashboard 로그인 후 가장 먼저 열리는 페이지입니다.",
    reduceMotion: "화면 전환 효과 줄이기",
    reduceMotionDescription: "슬라이드와 화면 전환 애니메이션을 최소화합니다.",
    enabled: "사용",
    disabled: "사용 안 함",
    settingsPreview: "현재 설정 미리보기",
    settingsPreviewDescription: "저장하면 아래 구성으로 계정에 적용됩니다.",
    previewLanguage: "언어",
    previewStartPage: "시작 화면",
    previewMotion: "화면 전환 효과",
    motionReduced: "최소화",
    motionStandard: "기본",
    changesPending: "저장되지 않은 변경사항이 있습니다.",
    allChangesSaved: "모든 변경사항이 저장되어 있습니다.",
    cancelChanges: "변경 취소",
    save: "설정 저장",
    saving: "저장 중",
    saved: "개인 설정을 저장했습니다.",
    saveFailed: "개인 설정을 저장하지 못했습니다."
  },
  ja: {
    brand: "YORO.gg Dashboard",
    overview: "ホーム",
    account: "連携アカウント",
    organizationGroup: "Organization",
    organizations: "概要",
    organizationBot: "Discord Bot コントロール",
    organizationServers: "Palworldサーバー",
    streamingGroup: "ストリーマー",
    streaming: "利用状況",
    streamingParticipation: "視聴者参加",
    streamingFollowers: "Followers",
    streamingRiot: "Riot ID",
    settings: "個人設定",
    loginTitle: "YORO.gg へのログインが必要です。",
    loginDescription: "Discord または Twitch アカウントでログインすると共通Dashboardを利用できます。",
    login: "ログイン",
    loading: "Dashboardを読み込んでいます。",
    failed: "Dashboard情報を読み込めませんでした。",
    identityTitle: "ログインアカウント",
    organizationTitle: "Organization",
    organizationEmptyDescription: "Discordアカウントを連携し、YORO Botを導入したサーバーを選択して開始してください。",
    organizationManage: "Organizationを管理",
    roleOwner: "所有者",
    roleManager: "管理者",
    roleViewer: "閲覧者",
    manage: "管理",
    connected: "連携済み",
    notConnected: "未連携",
    actionRequired: "必要",
    setupTitle: "設定を完了するとストリーマー機能を利用できます",
    stepAccountHint: "ストリーマー申請にはTwitchアカウントが必要です。",
    stepApplicationHint: "Riot IDで承認を申請します。",
    stepApprovalHint: "管理者の確認が完了すると利用できます。",
    stepPermissionHint: "Followers参照の権限のみ別途承認します。",
    opsParticipationOpen: "視聴者参加 受付中",
    opsParticipationClosed: "視聴者参加 停止中",
    opsQueueDetail: "待機 {waiting}人 · 選出 {selected}人",
    opsParticipationIdle: "参加を開始すると待機列が開きます",
    opsFollowerTitle: "Followers 最終更新",
    opsFollowerNever: "まだ更新していません",
    opsFollowerAction: "今すぐ更新",
    opsFollowerFresh: "最新の状態です",
    opsSectionLabel: "運用状況",
    opsBotInstalled: "Discord Bot 導入済み",
    opsBotMissing: "Discord Bot 未導入",
    opsBotModuleOff: "Palworld ステータス機能 オフ",
    opsBotInstall: "サーバーにBotを追加してください",
    opsServerReady: "ゲームサーバー接続 正常",
    opsServerPending: "ゲームサーバー接続 確認中",
    opsServerUnavailable: "ゲームサーバー接続 失敗",
    opsServerRevoked: "ゲームサーバー認証 失効",
    opsServerNotConfigured: "ゲームサーバー接続 未設定",
    opsServerNone: "登録済みゲームサーバーなし",
    opsServerAdd: "Palworldサーバーを登録してください",
    followerDelta7d: "7日 新規 +{n}",
    timeJustNow: "たった今",
    timeMinutes: "{n}分前",
    timeHours: "{n}時間前",
    timeDays: "{n}日前",
    participationCount: "参加申請",
    participationDetail: "本日 {played}人が参加",
    organizationCount: "Organization",
    organizationDetail: "所有 {owner} · その他 {other}",
    connectedAccounts: "連携アカウント",
    streamerNotRequested: "未申請",
    streamerPending: "承認待ち",
    streamerApproved: "承認済み",
    streamerRejected: "再申請が必要",
    followerCount: "Followers",
    unavailable: "未登録",
    stepAccount: "アカウント連携",
    stepApplication: "ストリーマー申請",
    stepApproval: "承認完了",
    stepPermission: "権限承認",
    complete: "完了",
    waiting: "待機",
    streamerTitle: "ストリーマー利用状況",
    streamerDescription: "Twitchアカウント連携後、Riot IDでストリーマー承認を申請できます。",
    twitchConnectionRequired: "Twitchアカウントの連携が必要です。",
    twitchConnectionDescription: "すでに連携済みのアカウントを再連携する必要はありません。連携情報が失効した場合のみ権限を再承認します。",
    connectTwitch: "Twitchアカウントを連携",
    permissionRefresh: "Twitch基本権限を再承認",
    riotIdLabel: "Riot ID",
    riotIdPlaceholder: "ゲーム名#タグ",
    apply: "ストリーマー承認を申請",
    applying: "申請中",
    applyDone: "ストリーマー承認申請を受け付けました。",
    applyFailed: "ストリーマー承認申請に失敗しました。",
    pendingDescription: "管理者の確認が完了するとストリーマーメニューを利用できます。",
    approvedDescription: "ストリーマー機能を利用できます。Followersの参照には別途最小権限の承認が必要です。",
    rejectedDescription: "Riot IDを確認して再度申請してください。",
    permissionDescription: "Followers参照に必要なmoderator:read:followers権限のみを別途承認します。",
    permissionConnected: "権限承認済み",
    permissionRequired: "権限承認が必要",
    permissionAction: "Twitch権限を承認",
    permissionRenew: "Twitch権限を再承認",
    permissionOpening: "Twitchへ移動中",
    permissionFailed: "Twitch権限承認画面を開けませんでした。",
    approvalRequired: "ストリーマー承認後に利用できます。",
    streamerLoadFailed: "ストリーマー利用状況を読み込めませんでした。",
    settingsEyebrow: "アカウント設定",
    settingsTitle: "個人設定",
    settingsDescription: "この設定はYOROアカウントに保存され、別の端末にも適用されます。",
    settingsAccount: "現在のアカウント",
    settingsSynced: "アカウント同期",
    settingsSyncedDescription: "保存した設定はログイン中のすべての端末に安全に反映されます。",
    generalSettings: "一般設定",
    generalSettingsDescription: "Dashboardで使用する表示言語を選択します。",
    dashboardSettings: "Dashboard設定",
    dashboardSettingsDescription: "ログイン直後に最初に表示する画面を指定します。",
    accessibilitySettings: "アクセシビリティ",
    accessibilitySettingsDescription: "画面の動きを抑え、より快適に利用できます。",
    language: "表示言語",
    languageDescription: "Dashboardのメニューと案内文に適用されます。",
    languageKo: "한국어",
    languageJa: "日本語",
    startPage: "既定のDashboard画面",
    startPageDescription: "Dashboardへのログイン後、最初に開くページです。",
    reduceMotion: "画面切り替え効果を減らす",
    reduceMotionDescription: "スライドと画面切り替えアニメーションを最小限にします。",
    enabled: "使用",
    disabled: "使用しない",
    settingsPreview: "現在の設定プレビュー",
    settingsPreviewDescription: "保存すると、以下の構成でアカウントに適用されます。",
    previewLanguage: "言語",
    previewStartPage: "開始画面",
    previewMotion: "画面切り替え効果",
    motionReduced: "最小限",
    motionStandard: "標準",
    changesPending: "保存されていない変更があります。",
    allChangesSaved: "すべての変更が保存されています。",
    cancelChanges: "変更を取り消す",
    save: "設定を保存",
    saving: "保存中",
    saved: "個人設定を保存しました。",
    saveFailed: "個人設定を保存できませんでした。"
  }
} as const;

const paths: Record<YoroDashboardPage, string> = {
  overview: "/dashboard",
  account: "/dashboard/account",
  organizations: "/dashboard/organizations",
  settings: "/dashboard/settings"
};

const unifiedPaths: Record<UnifiedDashboardPage, string> = {
  ...paths,
  organizationBot: "/dashboard/organizations/bot",
  organizationServers: "/dashboard/organizations/servers",
  streaming: "/dashboard/streaming",
  streamingParticipation: "/dashboard/streaming/participation",
  streamingFollowers: "/dashboard/streaming/followers",
  streamingRiot: "/dashboard/streaming/riot-id"
};

const legacyDashboardPaths: Record<string, UnifiedDashboardPage> = {
  "/dashboard/streaming/permissions": "streaming",
  "/dashboard/followers": "streamingFollowers",
  "/dashboard/riot-id": "streamingRiot",
  "/dashboard/riot-account": "streamingRiot",
  "/dashboard/lol/account": "streamingRiot",
  "/dashboard/lol": "streaming",
  "/dashboard/lol/automation": "streaming",
  "/dashboard/lol/participation": "streamingParticipation",
  "/dashboard/palworld/server": "streaming",
  "/dashboard/solo-rank": "streaming",
  "/dashboard/participation": "streamingParticipation"
};

function normalizedDashboardPath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

function legacyTenantDashboardPage(pathname: string): UnifiedDashboardPage | undefined {
  const segments = pathname.split("/");
  if (
    segments[1] !== "dashboard"
    || segments.length < 4
    || !/^sdk_[A-Za-z0-9_-]{8,128}$/u.test(segments[3] ?? "")
  ) return undefined;
  const suffix = segments.slice(4).join("/");
  if (suffix === "participation" || suffix === "lol/participation") {
    return "streamingParticipation";
  }
  if (suffix === "followers") return "streamingFollowers";
  if (
    suffix === "riot-id"
    || suffix === "riot-account"
    || suffix === "lol/account"
  ) return "streamingRiot";
  return "streaming";
}

export function canonicalYoroDashboardPath(pathname: string): string {
  const normalized = normalizedDashboardPath(pathname);
  const current = (
    Object.entries(unifiedPaths) as Array<[UnifiedDashboardPage, string]>
  ).find(([, path]) => path === normalized);
  if (current) return current[1];
  const legacyPage = legacyDashboardPaths[normalized]
    ?? legacyTenantDashboardPage(normalized);
  return legacyPage ? unifiedPaths[legacyPage] : unifiedPaths.overview;
}

export function yoroDashboardPageFromPath(pathname: string): UnifiedDashboardPage {
  const normalized = canonicalYoroDashboardPath(pathname);
  const matched = (
    Object.entries(unifiedPaths) as Array<[UnifiedDashboardPage, string]>
  ).find(([, path]) => path === normalized);
  if (matched) return matched[0];
  return "overview";
}

const organizationPages = new Set<UnifiedDashboardPage>([
  "organizations",
  "organizationBot",
  "organizationServers"
]);

function dashboardTopLevelPage(page: UnifiedDashboardPage): DashboardTopLevelPage {
  if (
    page === "organizations"
    || page === "organizationBot"
    || page === "organizationServers"
  ) return "organizations";
  if (
    page === "streaming"
    || page === "streamingParticipation"
    || page === "streamingFollowers"
    || page === "streamingRiot"
  ) return "streaming";
  return page;
}

function organizationSearch(search: string): string {
  const organizationId = new URLSearchParams(search).get("organization");
  return organizationId
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(organizationId)
    ? `?organization=${encodeURIComponent(organizationId)}`
    : "";
}

function dashboardUrl(page: UnifiedDashboardPage): string {
  const path = unifiedPaths[page];
  return organizationPages.has(page)
    ? `${path}${organizationSearch(window.location.search)}`
    : path;
}

function navigate(page: UnifiedDashboardPage, replace = false): void {
  const destination = dashboardUrl(page);
  if (`${window.location.pathname}${window.location.search}` === destination) return;
  if (replace) window.history.replaceState({}, "", destination);
  else window.history.pushState({}, "", destination);
  window.dispatchEvent(new CustomEvent("publicroutechange"));
  window.scrollTo({
    top: 0,
    behavior: document.documentElement.dataset.reducedMotion === "true"
      ? "auto"
      : "smooth"
  });
}

function roleLabel(
  role: "owner" | "manager" | "viewer",
  text: typeof copy.ko | typeof copy.ja
): string {
  if (role === "owner") return text.roleOwner;
  if (role === "manager") return text.roleManager;
  return text.roleViewer;
}

function streamerStatusLabel(
  status: YoroStreamerStatus["approval"]["status"] | undefined,
  text: typeof copy.ko | typeof copy.ja
): string {
  if (status === "pending") return text.streamerPending;
  if (status === "approved") return text.streamerApproved;
  if (status === "rejected") return text.streamerRejected;
  return text.streamerNotRequested;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/gu, (match, key: string) => (
    key in values ? String(values[key]) : match
  ));
}

/** ISO 시각을 "3시간 전"처럼 만듭니다. 값이 없거나 이상하면 undefined 입니다. */
function relativeTimeLabel(
  isoTime: string | undefined,
  text: typeof copy.ko | typeof copy.ja
): { label: string; stale: boolean } | undefined {
  if (!isoTime) return undefined;
  const elapsedMs = Date.now() - Date.parse(isoTime);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return undefined;
  const minutes = Math.floor(elapsedMs / 60_000);
  const stale = elapsedMs >= 24 * 60 * 60_000;
  if (minutes < 1) return { label: text.timeJustNow, stale };
  if (minutes < 60) return { label: fill(text.timeMinutes, { n: minutes }), stale };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: fill(text.timeHours, { n: hours }), stale };
  return { label: fill(text.timeDays, { n: Math.floor(hours / 24) }), stale };
}

function streamerInfo(status: YoroStreamerStatus | undefined): DashboardStreamerInfo | undefined {
  if (
    !status?.approval.enabled
    || !status.profile?.riotGameName
    || !status.profile.riotTagLine
  ) return undefined;
  return {
    twitchUserId: "",
    twitchLogin: status.profile.twitchLogin,
    twitchDisplayName: status.profile.twitchDisplayName,
    ...(status.profile.twitchProfileImageUrl
      ? { twitchProfileImageUrl: status.profile.twitchProfileImageUrl }
      : {}),
    riotGameName: status.profile.riotGameName,
    riotTagLine: status.profile.riotTagLine,
    dashboardEnabled: true
  };
}

export function YoroDashboardPage() {
  const account = useYoroAccountSession();
  const [management, setManagement] = useState<BotManagementSession>();
  const [managementFailed, setManagementFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [draft, setDraft] = useState<YoroUserPreferences>();
  const [streamer, setStreamer] = useState<YoroStreamerStatus>();
  const [streamerFailed, setStreamerFailed] = useState(false);
  const [participation, setParticipation] = useState<ParticipationState>();
  const [botControl, setBotControl] = useState<DiscordBotControlOverview>();
  const [gameServer, setGameServer] = useState<BotManagementGameServer | null>();
  const [applying, setApplying] = useState(false);
  const [permissionOpening, setPermissionOpening] = useState(false);
  const [riotIdDraft, setRiotIdDraft] = useState("");
  const [authLocale, setAuthLocale] = useState<DashboardLocale>(() => detectDashboardLocale());
  const [authTheme, setAuthTheme] = useState<"dark" | "light">("dark");
  const [dashboardTheme, setDashboardTheme] = useState<"dark" | "light">("dark");
  const page = yoroDashboardPageFromPath(window.location.pathname);
  const search = new URLSearchParams(window.location.search);
  const setupToken = search.get("setup") ?? "";
  const discordStatus = search.get("discord");
  const discordSetupActive = page === "organizations" && (
    /^[A-Za-z0-9_-]{32,128}$/u.test(setupToken)
    || discordStatus === "connected"
    || discordStatus === "error"
  );
  const authenticated = account.session?.authenticated === true
    ? account.session
    : undefined;
  const preferences = authenticated?.preferences;
  const locale = draft?.locale ?? preferences?.locale ?? "ko";
  const text = copy[locale];
  const identity = authenticatedYoroIdentity(account.session);
  const settingsChanged = Boolean(draft && preferences && (
    draft.locale !== preferences.locale
    || draft.defaultDashboardPage !== preferences.defaultDashboardPage
    || draft.reducedMotion !== preferences.reducedMotion
  ));

  useEffect(() => {
    const canonicalPath = canonicalYoroDashboardPath(window.location.pathname);
    if (canonicalPath === window.location.pathname) return;
    window.history.replaceState(
      {},
      "",
      `${canonicalPath}${organizationSearch(window.location.search)}`
    );
  }, []);

  useEffect(() => {
    if (!preferences) return;
    setDraft(preferences);
    setDashboardLocale(preferences.locale);
    document.documentElement.lang = preferences.locale;
    document.documentElement.dataset.reducedMotion =
      preferences.reducedMotion ? "true" : "false";
  }, [preferences]);

  useEffect(() => {
    if (!authenticated || page !== "overview") return undefined;
    const controller = new AbortController();
    void getManagementSession(controller.signal)
      .then((session) => {
        setManagement(session);
        setManagementFailed(false);
      })
      .catch(() => setManagementFailed(true));
    return () => controller.abort();
  }, [authenticated, page]);

  useEffect(() => {
    if (!authenticated) return undefined;
    const controller = new AbortController();
    void getYoroStreamerStatus(controller.signal)
      .then((status) => {
        setStreamer(status);
        setStreamerFailed(false);
        if (status.profile?.riotGameName && status.profile.riotTagLine) {
          setRiotIdDraft(
            `${status.profile.riotGameName}#${status.profile.riotTagLine}`
          );
        }
      })
      .catch(() => setStreamerFailed(true));
    return () => controller.abort();
  }, [authenticated]);

  /* 참여 대기열은 홈의 운영 상태 줄과 사이드바 표시에 씁니다.
     페이지마다 신호가 달라지지 않도록 화면과 무관하게 한 번만 읽습니다.
     승인 전에는 endpoint 가 권한 오류를 돌려주므로 호출하지 않고,
     실패해도 재시도하지 않습니다 — 보조 정보라 조용히 비웁니다. */
  useEffect(() => {
    if (!authenticated || !streamer?.approval.enabled) return undefined;
    const controller = new AbortController();
    void getYoroParticipation(controller.signal)
      .then(setParticipation)
      .catch(() => setParticipation(undefined));
    return () => controller.abort();
  }, [authenticated, streamer?.approval.enabled]);

  /* Discord Bot 설치 여부와 게임 서버 연결 상태.
     둘 다 organization 단위라 대표 organization 하나만 읽습니다
     (소유 중인 곳 우선, 없으면 첫 번째). 홈에서만 쓰므로 홈에서만 부릅니다.
     실패는 조용히 비웁니다 — 홈의 보조 정보이고 각 관리 화면이 본판입니다. */
  const primaryOrganizationId = management?.authenticated
    ? (management.organizations.find((item) => item.role === "owner")
        ?? management.organizations[0])?.id
    : undefined;

  useEffect(() => {
    if (!authenticated || page !== "overview" || !primaryOrganizationId) {
      setBotControl(undefined);
      setGameServer(undefined);
      return undefined;
    }
    const controller = new AbortController();
    void getManagementBotControl(primaryOrganizationId, controller.signal)
      .then(setBotControl)
      .catch(() => setBotControl(undefined));
    void listManagementGameServers(primaryOrganizationId, controller.signal)
      .then((items) => setGameServer(items[0] ?? null))
      .catch(() => setGameServer(undefined));
    return () => controller.abort();
  }, [authenticated, page, primaryOrganizationId]);

  useEffect(() => {
    if (
      !authenticated
      || window.location.pathname !== "/dashboard"
      || authenticated.preferences.defaultDashboardPage === "overview"
    ) return;
    navigate(authenticated.preferences.defaultDashboardPage, true);
  }, [authenticated]);

  const connectedProviders = useMemo(
    () => new Set(authenticated?.identities.map((item) => item.provider) ?? []),
    [authenticated]
  );
  const discordIdentity = authenticated?.identities.find(
    (item) => item.provider === "discord"
  );
  const twitchIdentity = authenticated?.identities.find(
    (item) => item.provider === "twitch"
  );

  async function savePreferences(): Promise<void> {
    if (!authenticated || !draft || saving) return;
    setSaving(true);
    setAnnouncement("");
    try {
      const saved = await updateAccountPreferences(draft, authenticated.csrfToken);
      setDashboardLocale(saved.locale);
      document.documentElement.lang = saved.locale;
      document.documentElement.dataset.reducedMotion =
        saved.reducedMotion ? "true" : "false";
      setDraft(saved);
      await account.refresh();
      setAnnouncement(copy[saved.locale].saved);
    } catch {
      setAnnouncement(text.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  function changePreferences(patch: Partial<YoroUserPreferences>): void {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setAnnouncement("");
  }

  function cancelPreferenceChanges(): void {
    if (!preferences) return;
    setDraft({ ...preferences });
    setDashboardLocale(preferences.locale);
    document.documentElement.lang = preferences.locale;
    document.documentElement.dataset.reducedMotion =
      preferences.reducedMotion ? "true" : "false";
    setAnnouncement("");
  }

  async function submitStreamerApplication(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (!authenticated || applying) return;
    const riotId = riotIdDraft.normalize("NFKC").trim();
    if (!riotId) return;
    setApplying(true);
    setAnnouncement("");
    try {
      await applyForStreamer(riotId, authenticated.csrfToken);
      setStreamer(await getYoroStreamerStatus());
      setAnnouncement(text.applyDone);
    } catch {
      setAnnouncement(text.applyFailed);
    } finally {
      setApplying(false);
    }
  }

  async function openFollowerPermission(): Promise<void> {
    if (!authenticated || permissionOpening) return;
    setPermissionOpening(true);
    setAnnouncement("");
    try {
      const result = await startFollowerPermission(authenticated.csrfToken);
      const destination = safeFollowerOAuthUrl(result.url);
      if (!destination) throw new Error("invalid_twitch_oauth_url");
      window.location.assign(destination);
    } catch {
      setAnnouncement(text.permissionFailed);
      setPermissionOpening(false);
    }
  }

  const followersDataSource = useMemo(() => (
    authenticated
      ? {
          load: getYoroFollowers,
          refresh: () => refreshYoroFollowers(authenticated.csrfToken),
          startOAuth: () => startFollowerPermission(authenticated.csrfToken)
        }
      : undefined
  ), [authenticated]);

  const approvedStreamer = streamerInfo(streamer);
  const organizations = management?.authenticated ? management.organizations : [];
  const ownedOrganizations = organizations.filter(
    (organization) => organization.role === "owner"
  ).length;

  /* 온보딩 단계. 기존 화면은 같은 진행 상태를 "빠른 시작"(원형 스텝)과
     "다음 작업"(취소선 목록)으로 두 번, 서로 다른 항목으로 보여 줬습니다.
     하나로 합치고 끝나면 통째로 감춥니다. */
  const twitchLinked = connectedProviders.has("twitch");
  const applicationSent = streamer?.approval.status === "pending"
    || streamer?.approval.status === "approved";
  const streamerApproved = streamer?.approval.enabled === true;
  const followerPermissionReady = streamer?.followerPermission.state === "connected";
  const setupSteps: Array<{
    key: string;
    label: string;
    hint: string;
    done: boolean;
    action?: { label: string; href?: string; onClick?: () => void };
  }> = [
    {
      key: "account",
      label: text.stepAccount,
      hint: twitchLinked ? twitchIdentity?.displayName ?? "Twitch" : text.stepAccountHint,
      done: twitchLinked,
      ...(twitchLinked ? {} : {
        action: {
          label: text.connectTwitch,
          href: accountOAuthUrl("twitch", "link_identity", "/dashboard")
        }
      })
    },
    {
      key: "application",
      label: text.stepApplication,
      hint: streamer?.approval.status === "rejected"
        ? text.rejectedDescription
        : text.stepApplicationHint,
      done: applicationSent,
      ...(twitchLinked && !applicationSent ? {
        action: { label: text.apply, onClick: () => navigate("streaming") }
      } : {})
    },
    {
      key: "approval",
      label: text.stepApproval,
      hint: text.stepApprovalHint,
      done: streamerApproved
    },
    {
      key: "permission",
      label: text.stepPermission,
      hint: text.stepPermissionHint,
      done: followerPermissionReady,
      ...(streamerApproved && !followerPermissionReady ? {
        action: {
          label: text.permissionAction,
          onClick: () => navigate("streaming")
        }
      } : {})
    }
  ];
  const setupDoneCount = setupSteps.filter((step) => step.done).length;
  const currentSetupStep = setupSteps.find((step) => !step.done)?.key;

  /* 이름 아래 한 줄. 인사말과 설명문 대신 지금 무슨 역할인지만 남깁니다. */
  const ownerOrganization = organizations.find(
    (organization) => organization.role === "owner"
  ) ?? organizations[0];
  const roleLine = [
    streamerApproved ? text.streamingGroup : undefined,
    ownerOrganization
      ? `${ownerOrganization.displayName} · ${roleLabel(ownerOrganization.role, text)}`
      : undefined
  ].filter(Boolean).join(" · ")
    || (identity?.provider === "discord" ? "Discord" : "Twitch");

  const followerSync = relativeTimeLabel(streamer?.summary?.lastSnapshotAt, text);

  /* Bot 은 설치 여부와 명령 기능 on/off 만 알 수 있습니다.
     실시간 접속 여부나 응답 시간을 주는 계약은 없어 그렇게 적지 않습니다. */
  const botCard = botControl
    ? botControl.installation
      /* 기능이 꺼져 있으면 그걸 알리고, 정상이면 어느 서버인지만 적습니다.
         둘을 이어 붙이면 4열에서 잘립니다(실측 200 > 182). */
      ? botControl.modules[0]?.enabled
        ? {
            tone: "good",
            title: text.opsBotInstalled,
            detail: botControl.installation.guildDisplayName
          }
        : {
            tone: "warn",
            title: text.opsBotInstalled,
            detail: text.opsBotModuleOff
          }
      : { tone: "warn", title: text.opsBotMissing, detail: text.opsBotInstall }
    : undefined;

  /* 게임 서버는 organization 당 한 대까지 내려옵니다(server LIMIT 1). */
  const serverStatusText: Record<BotManagementGameServer["connectionStatus"], string> = {
    ready: text.opsServerReady,
    pending: text.opsServerPending,
    unavailable: text.opsServerUnavailable,
    revoked: text.opsServerRevoked,
    not_configured: text.opsServerNotConfigured
  };
  const serverCard = gameServer === undefined
    ? undefined
    : gameServer === null
      ? { tone: undefined, title: text.opsServerNone, detail: text.opsServerAdd }
      : {
          tone: gameServer.connectionStatus === "ready"
            ? "good"
            : gameServer.connectionStatus === "pending" ? undefined : "warn",
          title: serverStatusText[gameServer.connectionStatus],
          detail: gameServer.displayName
        };

  const opsCards: Array<{
    key: string;
    tone?: string;
    title: string;
    detail: string;
    onClick: () => void;
  }> = [
    ...(streamerApproved && participation ? [{
      key: "participation",
      ...(participation.isOpen ? { tone: "live" } : {}),
      title: participation.isOpen
        ? text.opsParticipationOpen
        : text.opsParticipationClosed,
      detail: participation.isOpen
        ? fill(text.opsQueueDetail, {
            waiting: participation.summary.waiting,
            selected: participation.summary.selected
          })
        : text.opsParticipationIdle,
      onClick: () => navigate("streamingParticipation")
    }] : []),
    ...(streamerApproved ? [{
      key: "followers",
      tone: !followerSync || followerSync.stale ? "warn" : "good",
      title: text.opsFollowerTitle,
      detail: !followerSync
        ? text.opsFollowerNever
        : followerSync.stale
          ? `${followerSync.label} · ${text.opsFollowerAction}`
          : `${followerSync.label} · ${text.opsFollowerFresh}`,
      onClick: () => navigate("streamingFollowers")
    }] : []),
    ...(botCard ? [{
      key: "bot",
      ...(botCard.tone ? { tone: botCard.tone } : {}),
      title: botCard.title,
      detail: botCard.detail,
      onClick: () => navigate("organizationBot")
    }] : []),
    ...(serverCard ? [{
      key: "server",
      ...(serverCard.tone ? { tone: serverCard.tone } : {}),
      title: serverCard.title,
      detail: serverCard.detail,
      onClick: () => navigate("organizationServers")
    }] : [])
  ];

  function selectDashboardPage(nextPage: UnifiedDashboardPage): void {
    navigate(nextPage);
  }

  /* 메뉴 이름만으로는 참여가 열려 있는지, 팔로워를 며칠째 갱신하지 않았는지
     알 수 없었습니다. 값이 확실한 항목에만 표시를 붙입니다. */
  function navBadge(item: UnifiedDashboardPage) {
    if (item === "streamingParticipation" && participation?.isOpen) {
      return (
        <span
          aria-label={text.opsParticipationOpen}
          className="yoro-dashboard-nav-dot"
          data-tone="live"
          role="img"
        />
      );
    }
    if (item === "streamingFollowers" && followerSync) {
      return (
        <span aria-hidden="true" className="yoro-dashboard-nav-note">
          {followerSync.label}
        </span>
      );
    }
    if (item === "organizations" && organizations.length > 0) {
      return (
        <span aria-hidden="true" className="yoro-dashboard-nav-note">
          {organizations.length}
        </span>
      );
    }
    return null;
  }

  if (account.loading) {
    return <main className="yoro-dashboard-entry" role="status">{text.loading}</main>;
  }

  if (!authenticated && discordSetupActive) {
    return (
      <main className="yoro-dashboard-entry yoro-dashboard-discord-setup">
        <DiscordSetupPage
          embedded
          onCompleted={() => window.location.replace("/dashboard/organizations")}
        />
      </main>
    );
  }

  if (!authenticated) {
    const loginHref = "/login?return_to=/dashboard";

    return (
      <div className={`yoro-home-shell yoro-lol-home theme-${authTheme}`}>
        <LolChrome
          active="none"
          connected={false}
          locale={authLocale}
          onLocale={(nextLocale) => setAuthLocale(nextLocale === "ja" ? "ja" : "ko")}
          onLoginOpen={() => window.location.assign(loginHref)}
          onLogout={() => undefined}
          onToggleTheme={() => setAuthTheme((current) => current === "dark" ? "light" : "dark")}
        />
        <AuthRequiredState
          description={{ ko: copy.ko.loginDescription, ja: copy.ja.loginDescription }}
          locale={authLocale}
          loginHref={loginHref}
          loginLabel={{ ko: copy.ko.login, ja: copy.ja.login }}
          title={{ ko: copy.ko.loginTitle, ja: copy.ja.loginTitle }}
        />
      </div>
    );
  }

  return (
    <div
      className={`yoro-dashboard-shell yoro-home-shell theme-${dashboardTheme}`}
      data-page={page}
    >
      <DashboardChrome
        accountName={identity?.displayName ?? text.unavailable}
        locale={locale}
        onLocale={(nextLocale) => changePreferences({ locale: nextLocale })}
        onLogout={() => void logoutAccount(authenticated.csrfToken).then(() => {
          window.location.assign("/login");
        })}
        onPublicHome={() => window.location.assign("/lol")}
        onToggleTheme={() => setDashboardTheme((current) => current === "dark" ? "light" : "dark")}
      />
      <div className="yoro-dashboard-body">
      <aside
        aria-label={text.brand}
        className="yoro-dashboard-groupnav"
        id="yoro-dashboard-navigation"
      >
        <nav aria-label={text.brand}>
          {(["overview", "account"] as UnifiedDashboardPage[]).map((item) => (
            <button
              aria-current={page === item ? "page" : undefined}
              className={page === item ? "active" : ""}
              key={item}
              onClick={() => selectDashboardPage(item)}
              type="button"
            >
              <span className="yoro-dashboard-nav-text">{text[item]}</span>
              {navBadge(item)}
            </button>
          ))}
          <span className="yoro-dashboard-nav-label">{text.organizationGroup}</span>
          {([
            "organizations",
            "organizationBot",
            "organizationServers"
          ] as UnifiedDashboardPage[]).map((item) => (
            <button
              aria-current={page === item ? "page" : undefined}
              className={page === item ? "active" : ""}
              key={item}
              onClick={() => selectDashboardPage(item)}
              type="button"
            >
              <span className="yoro-dashboard-nav-text">{text[item]}</span>
              {navBadge(item)}
            </button>
          ))}
          <span className="yoro-dashboard-nav-label">{text.streamingGroup}</span>
          {([
            "streaming",
            "streamingParticipation",
            "streamingFollowers",
            "streamingRiot"
          ] as UnifiedDashboardPage[]).map((item) => (
            <button
              aria-current={page === item ? "page" : undefined}
              className={page === item ? "active" : ""}
              key={item}
              onClick={() => selectDashboardPage(item)}
              type="button"
            >
              <span className="yoro-dashboard-nav-text">{text[item]}</span>
              {navBadge(item)}
            </button>
          ))}
          <span className="yoro-dashboard-nav-label">
            {text.settings}
          </span>
          <button
            aria-current={page === "settings" ? "page" : undefined}
            className={page === "settings" ? "active" : ""}
            onClick={() => selectDashboardPage("settings")}
            type="button"
          >
            <span className="yoro-dashboard-nav-text">{text.settings}</span>
          </button>
        </nav>
      </aside>
      <main className="yoro-dashboard-main">
        {page === "overview" ? (
          <div className="yoro-dh">
            <header className="yoro-dh-top">
              {identity?.avatarUrl ? (
                <img alt="" src={identity.avatarUrl} />
              ) : (
                <span aria-hidden="true">
                  {identity?.provider === "discord"
                    ? <DiscordSymbolIcon />
                    : <TwitchGlitchIcon />}
                </span>
              )}
              <div className="yoro-dh-top-who">
                <h1>{identity?.displayName}</h1>
                <p>{roleLine}</p>
              </div>
            </header>

            {/* 운영 상태. 값을 실제로 받은 항목만 줄에 올립니다. */}
            {opsCards.length > 0 ? (
              <section aria-label={text.opsSectionLabel} className="yoro-dh-ops">
                {opsCards.map((card) => (
                  <button
                    className="yoro-dh-op"
                    data-tone={card.tone}
                    key={card.key}
                    onClick={card.onClick}
                    type="button"
                  >
                    <i aria-hidden="true" />
                    <span className="yoro-dh-op-text">
                      <b>{card.title}</b>
                      <small>{card.detail}</small>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                ))}
              </section>
            ) : null}

            {/* 지표는 전부 해당 화면으로 가는 문입니다. */}
            <section className="yoro-dh-kpis">
              {streamerApproved ? (
                <button
                  className="yoro-dh-kpi"
                  onClick={() => navigate("streamingFollowers")}
                  type="button"
                >
                  <span>{text.followerCount}</span>
                  <strong>{streamer?.summary?.activeFollowers ?? "—"}</strong>
                  {/* 예전 응답에는 없는 값이라 있을 때만 증감을 적습니다. */}
                  {streamer?.summary?.newFollowers7d === undefined ? (
                    <small>Twitch</small>
                  ) : (
                    <small data-tone={streamer.summary.newFollowers7d > 0 ? "up" : undefined}>
                      {fill(text.followerDelta7d, { n: streamer.summary.newFollowers7d })}
                    </small>
                  )}
                </button>
              ) : null}
              {streamerApproved && participation ? (
                <button
                  className="yoro-dh-kpi"
                  onClick={() => navigate("streamingParticipation")}
                  type="button"
                >
                  <span>{text.participationCount}</span>
                  <strong>{participation.summary.waiting}</strong>
                  <small>
                    {fill(text.participationDetail, {
                      played: participation.summary.played
                    })}
                  </small>
                </button>
              ) : null}
              <button
                className="yoro-dh-kpi"
                onClick={() => navigate("organizations")}
                type="button"
              >
                <span>{text.organizationCount}</span>
                <strong>{organizations.length}</strong>
                <small>
                  {fill(text.organizationDetail, {
                    owner: ownedOrganizations,
                    other: organizations.length - ownedOrganizations
                  })}
                </small>
              </button>
              <button
                className="yoro-dh-kpi"
                onClick={() => navigate("account")}
                type="button"
              >
                <span>{text.connectedAccounts}</span>
                <strong>{connectedProviders.size}</strong>
                {/* 연결하지 않은 제공자까지 적으면 숫자와 어긋납니다. */}
                <small>
                  {[
                    connectedProviders.has("discord") ? "Discord" : undefined,
                    connectedProviders.has("twitch") ? "Twitch" : undefined,
                    connectedProviders.has("riot") ? "Riot" : undefined
                  ].filter(Boolean).join(" · ") || text.notConnected}
                </small>
              </button>
            </section>

            {/* 온보딩이 끝나면 이 카드는 아예 렌더링되지 않습니다. */}
            {currentSetupStep ? (
              <section className="yoro-dh-setup">
                <div className="yoro-dh-setup-head">
                  <h2>{text.setupTitle}</h2>
                  <span>{setupDoneCount} / {setupSteps.length}</span>
                </div>
                <ol className="yoro-dh-steps">
                  {setupSteps.map((step, index) => (
                    <li
                      className={step.done
                        ? "is-done"
                        : step.key === currentSetupStep ? "is-now" : ""}
                      key={step.key}
                    >
                      <span aria-hidden="true" className="yoro-dh-step-mark">
                        {step.done ? "✓" : index + 1}
                      </span>
                      <span className="yoro-dh-step-text">
                        <b>{step.label}</b>
                        <small>{step.hint}</small>
                      </span>
                      {step.action?.href ? (
                        <a className="yoro-dh-action is-primary" href={step.action.href}>
                          {step.action.label}
                        </a>
                      ) : step.action?.onClick ? (
                        <button
                          className="yoro-dh-action is-primary"
                          onClick={step.action.onClick}
                          type="button"
                        >
                          {step.action.label}
                        </button>
                      ) : (
                        <span className="yoro-dh-step-state">
                          {step.done ? text.complete : text.waiting}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className="yoro-dh-cards">
              <article className="yoro-dh-card">
                <div className="yoro-dh-card-head">
                  <h2>{text.organizationTitle}</h2>
                  <button
                    className="yoro-dh-action"
                    onClick={() => navigate("organizations")}
                    type="button"
                  >
                    {text.manage}
                  </button>
                </div>
                {organizations.length > 0 ? (
                  <ul className="yoro-dh-card-list">
                    {organizations.map((organization) => (
                      <li key={organization.id}>
                        <span aria-hidden="true" className="yoro-dh-card-mark">
                          {organization.discordGuild?.iconUrl
                            ? <img alt="" src={organization.discordGuild.iconUrl} />
                            : organization.displayName.slice(0, 1)}
                        </span>
                        <span className="yoro-dh-card-text">
                          <b>{organization.displayName}</b>
                          {organization.discordGuild ? (
                            <small>{organization.discordGuild.displayName}</small>
                          ) : null}
                        </span>
                        <span
                          className="yoro-dh-tag"
                          data-tone={organization.role === "owner" ? "good" : undefined}
                        >
                          {roleLabel(organization.role, text)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <p className="yoro-dh-empty">{text.organizationEmptyDescription}</p>
                    <button
                      className="yoro-dh-action is-primary is-block"
                      onClick={() => navigate("organizations")}
                      type="button"
                    >
                      {text.organizationManage}
                    </button>
                  </>
                )}
                {managementFailed ? (
                  <p className="yoro-dh-alert" role="alert">{text.failed}</p>
                ) : null}
              </article>

              <article className="yoro-dh-card">
                <div className="yoro-dh-card-head">
                  <h2>{text.identityTitle}</h2>
                  <button
                    className="yoro-dh-action"
                    onClick={() => navigate("account")}
                    type="button"
                  >
                    {text.manage}
                  </button>
                </div>
                <ul className="yoro-dh-card-list">
                  <li>
                    <DiscordSymbolIcon />
                    <span className="yoro-dh-card-text">
                      <b>Discord</b>
                      {discordIdentity ? <small>{discordIdentity.displayName}</small> : null}
                    </span>
                    <span
                      className="yoro-dh-tag"
                      data-tone={connectedProviders.has("discord") ? "good" : undefined}
                    >
                      {connectedProviders.has("discord") ? text.connected : text.notConnected}
                    </span>
                  </li>
                  <li>
                    <TwitchGlitchIcon />
                    <span className="yoro-dh-card-text">
                      <b>Twitch</b>
                      {twitchIdentity ? <small>{twitchIdentity.displayName}</small> : null}
                    </span>
                    <span
                      className="yoro-dh-tag"
                      data-tone={connectedProviders.has("twitch") ? "good" : "warn"}
                    >
                      {connectedProviders.has("twitch") ? text.connected : text.actionRequired}
                    </span>
                  </li>
                </ul>
              </article>
            </section>
          </div>
        ) : null}
        {page === "account" ? <YoroAccountPage embedded /> : null}
        {page === "organizations" ? (
          discordSetupActive
            ? (
                <DiscordSetupPage
                  embedded
                  onCompleted={() => window.location.replace("/dashboard/organizations")}
                />
              )
            : <BotManagementPage embedded key="organization-overview" view="overview" />
        ) : null}
        {page === "organizationBot" ? (
          <BotManagementPage embedded key="organization-bot" view="bot" />
        ) : null}
        {page === "organizationServers" ? (
          <BotManagementPage embedded key="organization-servers" view="servers" />
        ) : null}
        {page === "streaming" ? (
          <section className="yoro-dashboard-streaming">
            <header>
              <span>STREAMER</span>
              <h1>{text.streamerTitle}</h1>
              <p>{text.streamerDescription}</p>
            </header>
            <nav
              aria-label={text.streamingGroup}
              className="yoro-dashboard-mobile-detail-links"
            >
              {([
                "streamingParticipation",
                "streamingFollowers",
                "streamingRiot"
              ] as UnifiedDashboardPage[]).map((item) => (
                <button key={item} onClick={() => navigate(item)} type="button">
                  {text[item]}
                </button>
              ))}
            </nav>
            {streamerFailed ? (
              <div className="yoro-dashboard-state-card" role="alert">
                <strong>{text.streamerLoadFailed}</strong>
              </div>
            ) : null}
            {!streamer?.twitchConnected ? (
              <div className="yoro-dashboard-state-card">
                <TwitchGlitchIcon />
                <div>
                  <h2>{text.twitchConnectionRequired}</h2>
                  <p>{text.twitchConnectionDescription}</p>
                </div>
                <a
                  href={accountOAuthUrl(
                    "twitch",
                    "link_identity",
                    "/dashboard/streaming"
                  )}
                >
                  {text.connectTwitch}
                </a>
              </div>
            ) : !streamer.twitchPermissionReady ? (
              <div className="yoro-dashboard-state-card">
                <TwitchGlitchIcon />
                <div>
                  <h2>{text.permissionRefresh}</h2>
                  <p>{text.twitchConnectionDescription}</p>
                </div>
                <a
                  href={accountOAuthUrl(
                    "twitch",
                    "link_identity",
                    "/dashboard/streaming"
                  )}
                >
                  {text.permissionRefresh}
                </a>
              </div>
            ) : (
              <div className="yoro-dashboard-streamer-grid">
                <article className="yoro-dashboard-state-card">
                  {streamer.profile?.twitchProfileImageUrl ? (
                    <img
                      alt=""
                      src={streamer.profile.twitchProfileImageUrl}
                    />
                  ) : <TwitchGlitchIcon />}
                  <div>
                    <small>Twitch</small>
                    <h2>{streamer.profile?.twitchDisplayName}</h2>
                    <p>@{streamer.profile?.twitchLogin}</p>
                  </div>
                  <strong className="yoro-dashboard-status">
                    {streamerStatusLabel(streamer.approval.status, text)}
                  </strong>
                </article>
                {streamer.approval.status === "pending" ? (
                  <article className="yoro-dashboard-state-card">
                    <div>
                      <h2>{text.streamerPending}</h2>
                      <p>{text.pendingDescription}</p>
                    </div>
                  </article>
                ) : null}
                {streamer.approval.enabled ? (
                  <article className="yoro-dashboard-state-card">
                    <div>
                      <h2>{text.streamerApproved}</h2>
                      <p>{text.approvedDescription}</p>
                      <p>{text.permissionDescription}</p>
                      <strong className="yoro-dashboard-status">
                        {streamer.followerPermission.state === "connected"
                          ? text.permissionConnected
                          : text.permissionRequired}
                      </strong>
                    </div>
                    <button
                      disabled={permissionOpening}
                      onClick={() => void openFollowerPermission()}
                      type="button"
                    >
                      {permissionOpening
                        ? text.permissionOpening
                        : streamer.followerPermission.state === "connected"
                          ? text.permissionRenew
                          : text.permissionAction}
                    </button>
                  </article>
                ) : null}
                {streamer.approval.status === "not_requested"
                || streamer.approval.status === "rejected" ? (
                  <form
                    className="yoro-dashboard-application"
                    onSubmit={(event) => void submitStreamerApplication(event)}
                  >
                    <h2>
                      {streamer.approval.status === "rejected"
                        ? text.streamerRejected
                        : text.stepApplication}
                    </h2>
                    {streamer.approval.status === "rejected" ? (
                      <p>{text.rejectedDescription}</p>
                    ) : null}
                    <label htmlFor="yoro-streamer-riot-id">
                      {text.riotIdLabel}
                    </label>
                    <input
                      autoComplete="off"
                      id="yoro-streamer-riot-id"
                      maxLength={80}
                      onChange={(event) => setRiotIdDraft(event.target.value)}
                      placeholder={text.riotIdPlaceholder}
                      required
                      value={riotIdDraft}
                    />
                    <button disabled={applying} type="submit">
                      {applying ? text.applying : text.apply}
                    </button>
                  </form>
                ) : null}
              </div>
            )}
            {announcement ? (
              <p
                aria-live="polite"
                className="yoro-dashboard-announcement"
              >
                {announcement}
              </p>
            ) : null}
          </section>
        ) : null}
        {page === "streamingFollowers" ? (
          streamer?.approval.enabled && followersDataSource
            ? <FollowersPage dataSource={followersDataSource} />
            : (
                <section className="yoro-dashboard-streaming">
                  <header>
                    <h1>{text.streamingFollowers}</h1>
                    <p>{text.approvalRequired}</p>
                  </header>
                  <button onClick={() => navigate("streaming")} type="button">
                    {text.streaming}
                  </button>
                </section>
              )
        ) : null}
        {page === "streamingParticipation" ? (
          streamer?.approval.enabled
            ? (
                <ParticipationManagementPage
                  csrfToken={authenticated.csrfToken}
                  locale={locale}
                />
              )
            : (
                <section className="yoro-dashboard-streaming">
                  <header>
                    <h1>{text.streamingParticipation}</h1>
                    <p>{text.approvalRequired}</p>
                  </header>
                  <button onClick={() => navigate("streaming")} type="button">
                    {text.streaming}
                  </button>
                </section>
              )
        ) : null}
        {page === "streamingRiot" ? (
          <MyRiotAccountPage
            csrfToken={authenticated.csrfToken}
            onStreamerChange={() => void getYoroStreamerStatus().then(setStreamer)}
            onUpdateRiotId={(riotId) => (
              updateYoroRiotId(riotId, authenticated.csrfToken)
            )}
            registrationHref="/dashboard/streaming"
            streamer={approvedStreamer}
          />
        ) : null}
        {page === "settings" && draft ? (
          <section className="yoro-dashboard-settings">
            <header className="yoro-dashboard-settings-hero">
              <div>
                <span className="yoro-dashboard-settings-eyebrow">
                  {text.settingsEyebrow}
                </span>
                <h1>{text.settingsTitle}</h1>
                <p>{text.settingsDescription}</p>
              </div>
              <dl className="yoro-dashboard-settings-hero-summary">
                <div>
                  <dt>{text.settingsAccount}</dt>
                  <dd>{identity?.displayName ?? text.unavailable}</dd>
                </div>
                <div>
                  <dt>{text.language}</dt>
                  <dd>{draft.locale === "ko" ? text.languageKo : text.languageJa}</dd>
                </div>
                <div>
                  <dt>{text.settingsSynced}</dt>
                  <dd>{settingsChanged ? text.changesPending : text.allChangesSaved}</dd>
                </div>
              </dl>
            </header>
            <div className="yoro-dashboard-settings-layout">
              <div className="yoro-dashboard-settings-groups">
                <section className="yoro-dashboard-settings-group">
                  <header>
                    <span aria-hidden="true" className="yoro-dashboard-settings-icon">文</span>
                    <div>
                      <h2>{text.generalSettings}</h2>
                      <p>{text.generalSettingsDescription}</p>
                    </div>
                  </header>
                  <label className="yoro-dashboard-setting-row">
                    <span>
                      <strong>{text.language}</strong>
                      <small>{text.languageDescription}</small>
                    </span>
                    <select
                      value={draft.locale}
                      onChange={(event) => changePreferences({
                        locale: event.target.value as "ko" | "ja"
                      })}
                    >
                      <option value="ko">{text.languageKo}</option>
                      <option value="ja">{text.languageJa}</option>
                    </select>
                  </label>
                </section>

                <section className="yoro-dashboard-settings-group">
                  <header>
                    <span aria-hidden="true" className="yoro-dashboard-settings-icon">⌂</span>
                    <div>
                      <h2>{text.dashboardSettings}</h2>
                      <p>{text.dashboardSettingsDescription}</p>
                    </div>
                  </header>
                  <label className="yoro-dashboard-setting-row">
                    <span>
                      <strong>{text.startPage}</strong>
                      <small>{text.startPageDescription}</small>
                    </span>
                    <select
                      value={draft.defaultDashboardPage}
                      onChange={(event) => changePreferences({
                        defaultDashboardPage: event.target.value as YoroDashboardPage
                      })}
                    >
                      {(Object.keys(paths) as YoroDashboardPage[]).map((item) => (
                        <option key={item} value={item}>{text[item]}</option>
                      ))}
                    </select>
                  </label>
                </section>

                <section className="yoro-dashboard-settings-group">
                  <header>
                    <span aria-hidden="true" className="yoro-dashboard-settings-icon">Aa</span>
                    <div>
                      <h2>{text.accessibilitySettings}</h2>
                      <p>{text.accessibilitySettingsDescription}</p>
                    </div>
                  </header>
                  <label className="yoro-dashboard-setting-row yoro-dashboard-setting-toggle">
                    <span>
                      <strong>{text.reduceMotion}</strong>
                      <small>{text.reduceMotionDescription}</small>
                    </span>
                    <span className="yoro-dashboard-toggle-control">
                      <span className="yoro-dashboard-toggle-status">
                        {draft.reducedMotion ? text.enabled : text.disabled}
                      </span>
                      <input
                        checked={draft.reducedMotion}
                        onChange={(event) => changePreferences({
                          reducedMotion: event.target.checked
                        })}
                        type="checkbox"
                      />
                      <span aria-hidden="true" className="yoro-dashboard-toggle-track" />
                    </span>
                  </label>
                </section>
              </div>

              <aside className="yoro-dashboard-settings-preview">
                <span className="yoro-dashboard-settings-preview-mark" aria-hidden="true">Y</span>
                <h2>{text.settingsPreview}</h2>
                <p>{text.settingsPreviewDescription}</p>
                <dl>
                  <div>
                    <dt>{text.previewLanguage}</dt>
                    <dd>{draft.locale === "ko" ? text.languageKo : text.languageJa}</dd>
                  </div>
                  <div>
                    <dt>{text.previewStartPage}</dt>
                    <dd>{text[draft.defaultDashboardPage]}</dd>
                  </div>
                  <div>
                    <dt>{text.previewMotion}</dt>
                    <dd>{draft.reducedMotion ? text.motionReduced : text.motionStandard}</dd>
                  </div>
                </dl>
                <div className="yoro-dashboard-settings-sync-note">
                  <strong>{text.settingsSynced}</strong>
                  <span>{text.settingsSyncedDescription}</span>
                </div>
              </aside>
            </div>

            <footer className="yoro-dashboard-settings-actions">
              <div>
                <strong>{settingsChanged ? text.changesPending : text.allChangesSaved}</strong>
                {announcement ? <span aria-live="polite">{announcement}</span> : null}
              </div>
              <button
                disabled={!settingsChanged || saving}
                onClick={cancelPreferenceChanges}
                type="button"
              >
                {text.cancelChanges}
              </button>
              <button
                className="is-primary"
                disabled={!settingsChanged || saving}
                onClick={() => void savePreferences()}
                type="button"
              >
                {saving ? text.saving : text.save}
              </button>
            </footer>
          </section>
        ) : null}
      </main>
      </div>
      <DashboardBottomTabBar
        locale={locale}
        onNavigate={selectDashboardPage}
        page={dashboardTopLevelPage(page)}
      />
    </div>
  );
}
