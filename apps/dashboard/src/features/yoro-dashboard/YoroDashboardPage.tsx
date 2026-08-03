import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import { DiscordSymbolIcon } from "../../shared/DiscordSymbolIcon";
import { TwitchGlitchIcon } from "../../shared/TwitchGlitchIcon";
import { setDashboardLocale } from "../../i18n";
import { FollowersPage, safeFollowerOAuthUrl } from "../../pages/FollowersPage";
import { MyRiotAccountPage } from "../../pages/MyRiotAccountPage";
import type { DashboardStreamerInfo } from "../../api/client";
import { BotManagementPage } from "../bot-management/BotManagementPage";
import { DiscordSetupPage } from "../discord-onboarding/DiscordSetupPage";
import {
  getManagementSession,
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
  getYoroStreamerStatus,
  refreshYoroFollowers,
  startFollowerPermission,
  updateYoroRiotId,
  type YoroStreamerStatus
} from "./api";
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
    publicHome: "YORO.gg",
    logout: "로그아웃",
    openMenu: "Dashboard 메뉴 열기",
    closeMenu: "Dashboard 메뉴 닫기",
    loginTitle: "YORO.gg 로그인이 필요합니다.",
    loginDescription: "Discord 또는 Twitch 계정으로 로그인하면 공통 Dashboard를 이용할 수 있습니다.",
    login: "로그인",
    loading: "Dashboard를 불러오는 중입니다.",
    failed: "Dashboard 정보를 불러오지 못했습니다.",
    greeting: "다시 오신 것을 환영합니다.",
    overviewDescription: "연결 계정, Organization, Discord Bot과 스트리머 권한을 한곳에서 관리합니다.",
    identityTitle: "로그인 계정",
    organizationTitle: "Organization",
    organizationEmpty: "연결된 Organization이 없습니다.",
    organizationEmptyDescription: "Discord 계정을 연결하고 YORO Bot이 설치된 서버를 선택해 시작하세요.",
    organizationManage: "Organization 관리",
    roleOwner: "소유자",
    roleManager: "관리자",
    roleViewer: "조회자",
    nextTitle: "다음 작업",
    nextConnectDiscord: "Discord 계정 연결",
    nextConnectOrganization: "Discord 서버와 Organization 연결",
    nextManage: "게임 서버 REST 연결 관리",
    connectedAccounts: "연결된 계정",
    streamerState: "스트리머 상태",
    streamerNotRequested: "미신청",
    streamerPending: "승인 대기",
    streamerApproved: "승인 완료",
    streamerRejected: "재신청 필요",
    followerCount: "Followers",
    riotId: "Riot ID",
    unavailable: "미등록",
    quickStart: "빠른 시작",
    quickStartDescription: "계정 연결부터 스트리머 권한 승인까지 현재 진행 상태를 확인하세요.",
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
    publicHome: "YORO.gg",
    logout: "ログアウト",
    openMenu: "Dashboardメニューを開く",
    closeMenu: "Dashboardメニューを閉じる",
    loginTitle: "YORO.gg へのログインが必要です。",
    loginDescription: "Discord または Twitch アカウントでログインすると共通Dashboardを利用できます。",
    login: "ログイン",
    loading: "Dashboardを読み込んでいます。",
    failed: "Dashboard情報を読み込めませんでした。",
    greeting: "おかえりなさい。",
    overviewDescription: "連携アカウント、Organization、Discord Bot、ストリーマー権限を一か所で管理します。",
    identityTitle: "ログインアカウント",
    organizationTitle: "Organization",
    organizationEmpty: "連携済みのOrganizationがありません。",
    organizationEmptyDescription: "Discordアカウントを連携し、YORO Botを導入したサーバーを選択して開始してください。",
    organizationManage: "Organizationを管理",
    roleOwner: "所有者",
    roleManager: "管理者",
    roleViewer: "閲覧者",
    nextTitle: "次の操作",
    nextConnectDiscord: "Discordアカウントを連携",
    nextConnectOrganization: "DiscordサーバーとOrganizationを連携",
    nextManage: "ゲームサーバーのREST接続を管理",
    connectedAccounts: "連携アカウント",
    streamerState: "ストリーマー状態",
    streamerNotRequested: "未申請",
    streamerPending: "承認待ち",
    streamerApproved: "承認済み",
    streamerRejected: "再申請が必要",
    followerCount: "Followers",
    riotId: "Riot ID",
    unavailable: "未登録",
    quickStart: "クイックスタート",
    quickStartDescription: "アカウント連携からストリーマー権限承認までの進行状況を確認できます。",
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
  "/dashboard/overlay": "streaming",
  "/dashboard/alerts": "streaming",
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
  const [applying, setApplying] = useState(false);
  const [permissionOpening, setPermissionOpening] = useState(false);
  const [riotIdDraft, setRiotIdDraft] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
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
    if (!mobileMenuOpen) return undefined;
    const sidebar = sidebarRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = Array.from(
      sidebar?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
    focusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
        window.setTimeout(() => mobileMenuButtonRef.current?.focus(), 0);
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

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

  function closeMobileMenu(restoreFocus = true): void {
    setMobileMenuOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => mobileMenuButtonRef.current?.focus(), 0);
    }
  }

  function selectDashboardPage(nextPage: UnifiedDashboardPage): void {
    closeMobileMenu(false);
    navigate(nextPage);
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
    return (
      <main className="yoro-dashboard-entry">
        <section>
          <span>YORO DASHBOARD</span>
          <h1>{text.loginTitle}</h1>
          <p>{text.loginDescription}</p>
          <a href="/login?return_to=/dashboard">{text.login}</a>
        </section>
      </main>
    );
  }

  return (
    <div className="yoro-dashboard-shell" data-page={page}>
      <header className="yoro-dashboard-mobile-bar">
        <a className="yoro-dashboard-brand" href="/dashboard">{text.brand}</a>
        <button
          aria-controls="yoro-dashboard-navigation"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? text.closeMenu : text.openMenu}
          className="yoro-dashboard-menu-button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          ref={mobileMenuButtonRef}
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </header>
      <button
        aria-label={text.closeMenu}
        className={`yoro-dashboard-backdrop${mobileMenuOpen ? " is-open" : ""}`}
        onClick={() => closeMobileMenu()}
        tabIndex={-1}
        type="button"
      />
      <aside
        aria-label={text.brand}
        className={`yoro-dashboard-sidebar${mobileMenuOpen ? " is-open" : ""}`}
        id="yoro-dashboard-navigation"
        ref={sidebarRef}
      >
        <div className="yoro-dashboard-sidebar-heading">
          <a className="yoro-dashboard-brand" href="/dashboard">{text.brand}</a>
          <button
            aria-label={text.closeMenu}
            className="yoro-dashboard-sidebar-close"
            onClick={() => closeMobileMenu()}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="yoro-dashboard-profile">
          {identity?.avatarUrl ? (
            <img alt="" src={identity.avatarUrl} />
          ) : (
            <span aria-hidden="true">
              {identity?.provider === "discord"
                ? <DiscordSymbolIcon />
                : <TwitchGlitchIcon />}
            </span>
          )}
          <div>
            <strong>{identity?.displayName}</strong>
            <small>{identity?.provider === "discord" ? "Discord" : "Twitch"}</small>
          </div>
        </div>
        <nav aria-label={text.brand}>
          {(["overview", "account"] as UnifiedDashboardPage[]).map((item) => (
            <button
              aria-current={page === item ? "page" : undefined}
              className={page === item ? "active" : ""}
              key={item}
              onClick={() => selectDashboardPage(item)}
              type="button"
            >
              {text[item]}
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
              {text[item]}
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
              {text[item]}
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
            {text.settings}
          </button>
        </nav>
        <div className="yoro-dashboard-sidebar-actions">
          <a href="/">{text.publicHome}</a>
          <button
            type="button"
            onClick={() => void logoutAccount(authenticated.csrfToken).then(() => {
              window.location.assign("/login");
            })}
          >
            {text.logout}
          </button>
        </div>
      </aside>
      <main className="yoro-dashboard-main">
        {page === "overview" ? (
          <div className="yoro-dashboard-overview">
            <header>
              <span>YORO DASHBOARD</span>
              <h1>{identity?.displayName}, {text.greeting}</h1>
              <p>{text.overviewDescription}</p>
            </header>
            <section
              aria-label={text.overviewDescription}
              className="yoro-dashboard-metrics"
            >
              <article>
                <span>{text.connectedAccounts}</span>
                <strong>{connectedProviders.size}</strong>
                <small>Discord · Twitch</small>
              </article>
              <article>
                <span>{text.streamerState}</span>
                <strong>{streamerStatusLabel(streamer?.approval.status, text)}</strong>
                <small>
                  {streamer?.approval.enabled ? text.complete : text.waiting}
                </small>
              </article>
              <article>
                <span>{text.followerCount}</span>
                <strong>{streamer?.summary?.activeFollowers ?? "—"}</strong>
                <small>Twitch</small>
              </article>
              <article>
                <span>{text.riotId}</span>
                <strong>
                  {streamer?.profile?.riotGameName && streamer.profile.riotTagLine
                    ? `${streamer.profile.riotGameName}#${streamer.profile.riotTagLine}`
                    : text.unavailable}
                </strong>
                <small>Riot Games</small>
              </article>
            </section>
            <section className="yoro-dashboard-quick-start">
              <header>
                <h2>{text.quickStart}</h2>
                <p>{text.quickStartDescription}</p>
              </header>
              <ol>
                {[
                  {
                    label: text.stepAccount,
                    complete: connectedProviders.has("twitch")
                  },
                  {
                    label: text.stepApplication,
                    complete: streamer?.approval.status !== undefined
                      && streamer.approval.status !== "not_requested"
                  },
                  {
                    label: text.stepApproval,
                    complete: streamer?.approval.enabled === true
                  },
                  {
                    label: text.stepPermission,
                    complete: streamer?.followerPermission.state === "connected"
                  }
                ].map((step, index) => (
                  <li className={step.complete ? "complete" : ""} key={step.label}>
                    <span aria-hidden="true">{step.complete ? "✓" : index + 1}</span>
                    <strong>{step.label}</strong>
                    <small>{step.complete ? text.complete : text.waiting}</small>
                  </li>
                ))}
              </ol>
            </section>
            <section className="yoro-dashboard-summary-grid">
              <article>
                <h2>{text.identityTitle}</h2>
                <ul>
                  <li>
                    <DiscordSymbolIcon />
                    <span className="yoro-dashboard-identity-label">
                      <strong>Discord</strong>
                      {discordIdentity ? <small>{discordIdentity.displayName}</small> : null}
                    </span>
                    <span className="yoro-dashboard-identity-status">
                      {connectedProviders.has("discord") ? "✓" : "—"}
                    </span>
                  </li>
                  <li>
                    <TwitchGlitchIcon />
                    <span className="yoro-dashboard-identity-label">
                      <strong>Twitch</strong>
                      {twitchIdentity ? <small>{twitchIdentity.displayName}</small> : null}
                    </span>
                    <span className="yoro-dashboard-identity-status">
                      {connectedProviders.has("twitch") ? "✓" : "—"}
                    </span>
                  </li>
                </ul>
                <button type="button" onClick={() => navigate("account")}>{text.account}</button>
              </article>
              <article>
                <h2>{text.organizationTitle}</h2>
                {management?.authenticated && management.organizations.length > 0 ? (
                  <ul>
                    {management.organizations.map((organization) => (
                      <li key={organization.id}>
                        <span>{organization.displayName}</span>
                        <strong>{roleLabel(organization.role, text)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <strong>{text.organizationEmpty}</strong>
                    <p>{text.organizationEmptyDescription}</p>
                  </>
                )}
                {managementFailed ? <p role="alert">{text.failed}</p> : null}
                <button type="button" onClick={() => navigate("organizations")}>
                  {text.organizationManage}
                </button>
              </article>
            </section>
            <section className="yoro-dashboard-next">
              <h2>{text.nextTitle}</h2>
              <ol>
                <li className={connectedProviders.has("discord") ? "complete" : ""}>
                  {text.nextConnectDiscord}
                </li>
                <li className={
                  management?.authenticated && management.organizations.length > 0
                    ? "complete"
                    : ""
                }>
                  {text.nextConnectOrganization}
                </li>
                <li>{text.nextManage}</li>
              </ol>
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
  );
}
