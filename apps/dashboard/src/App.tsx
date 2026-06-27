import { lazy, Suspense, useEffect, useState } from "react";
import { checkDashboardAuthToken, getDashboardAuthStatus, logoutDashboardSession, type DashboardStreamerInfo } from "./api/client";
import { connectDashboardSocket } from "./api/socket";
import { Layout, pageAllowedForRole, type DashboardRole, type Page } from "./components/Layout";
import { LoginPage } from "./components/LoginPage";
import { uiText } from "./i18n";
import { PublicLolPage } from "./pages/PublicLolPage";
import { clearDashboardCsrfToken, runtimeConfig } from "./runtime-config";

const DashboardPage = lazy(async () => ({ default: (await import("./pages/DashboardPage")).DashboardPage }));
const EventsPage = lazy(async () => ({ default: (await import("./pages/EventsPage")).EventsPage }));
const QuestionsPage = lazy(async () => ({ default: (await import("./pages/QuestionsPage")).QuestionsPage }));
const MyRiotAccountPage = lazy(async () => ({ default: (await import("./pages/MyRiotAccountPage")).MyRiotAccountPage }));
const SoloRankPage = lazy(async () => ({ default: (await import("./pages/SoloRankPage")).SoloRankPage }));
const ParticipationPage = lazy(async () => ({ default: (await import("./pages/ParticipationPage")).ParticipationPage }));
const StreamerRiotRequestsPage = lazy(async () => ({ default: (await import("./pages/StreamerRiotRequestsPage")).StreamerRiotRequestsPage }));
const SettingsPage = lazy(async () => ({ default: (await import("./pages/SettingsPage")).SettingsPage }));
const TwitchConnectionPage = lazy(async () => ({ default: (await import("./pages/TwitchConnectionPage")).TwitchConnectionPage }));
const OverlayOpsPage = lazy(async () => ({ default: (await import("./pages/OverlayOpsPage")).OverlayOpsPage }));
const FollowersPage = lazy(async () => ({ default: (await import("./pages/FollowersPage")).FollowersPage }));

const initialSnapshot = {
  status: { server: "offline", twitch: "disabled", stream: "unknown", bridge: "disconnected", obs: "unknown", participation: "closed" },
  events: [],
  actions: [],
  questions: [],
  participationQueue: [],
  participationState: {
    isOpen: false,
    queue: [],
    activeQueue: [],
    summary: { total: 0, active: 0, waiting: 0, selected: 0, checkedIn: 0, noShow: 0, played: 0 }
  }
};

type AppSurface = "public" | "admin" | "streamer";
type AuthState = "checking" | "authenticated" | "login" | "streamerAccess";

const streamerEntryI18n = {
  ko: {
    eyebrow: "스트리머 대시보드",
    title: "Twitch 로그인으로 접속합니다.",
    description: "승인된 스트리머는 전적 검색 화면에서 Twitch 로그인 후 프로필 메뉴의 대시보드를 열어주세요.",
    checking: "스트리머 등록 상태를 확인하는 중입니다.",
    publicHome: "전적 검색으로 돌아가기",
    adminLogin: "관리자 로그인"
  },
  ja: {
    eyebrow: "配信者ダッシュボード",
    title: "Twitch ログインでアクセスします。",
    description: "承認済みの配信者は、戦績検索画面で Twitch ログイン後、プロフィールメニューからダッシュボードを開いてください。",
    checking: "配信者登録状態を確認しています。",
    publicHome: "戦績検索に戻る",
    adminLogin: "管理者ログイン"
  }
} as const;

const streamerEntryText = streamerEntryI18n.ko;

function surfaceForLocation(): AppSurface {
  if (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/")) return "admin";
  if (window.location.pathname === "/dashboard" || window.location.pathname.startsWith("/dashboard/")) return "streamer";
  return "public";
}

function isManagedSurface(surface: AppSurface): boolean {
  return surface === "admin" || surface === "streamer";
}

function StreamerDashboardEntryPage({
  checking,
  onBackToPublic,
  onOpenAdmin
}: {
  checking: boolean;
  onBackToPublic: () => void;
  onOpenAdmin: () => void;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-block auth-brand">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand">StreamOps</div>
            <div className="brand-subtitle">{uiText.app.brandSubtitle}</div>
          </div>
        </div>
        <span className="eyebrow" data-ko={streamerEntryI18n.ko.eyebrow} data-ja={streamerEntryI18n.ja.eyebrow}>{streamerEntryText.eyebrow}</span>
        <h1 data-ko={streamerEntryI18n.ko.title} data-ja={streamerEntryI18n.ja.title}>{streamerEntryText.title}</h1>
        <p className="muted" data-ko={streamerEntryI18n.ko.description} data-ja={streamerEntryI18n.ja.description}>{streamerEntryText.description}</p>
        {checking ? <p className="hint" data-ko={streamerEntryI18n.ko.checking} data-ja={streamerEntryI18n.ja.checking}>{streamerEntryText.checking}</p> : null}
        <div className="auth-form">
          <button className="secondary" type="button" onClick={onBackToPublic} data-ko={streamerEntryI18n.ko.publicHome} data-ja={streamerEntryI18n.ja.publicHome}>
            {streamerEntryText.publicHome}
          </button>
          <button className="secondary" type="button" onClick={onOpenAdmin} data-ko={streamerEntryI18n.ko.adminLogin} data-ja={streamerEntryI18n.ja.adminLogin}>
            {streamerEntryText.adminLogin}
          </button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const initialAuthRequired = runtimeConfig().dashboardAuthRequired !== false;
  const [surface, setSurface] = useState<AppSurface>(() => surfaceForLocation());
  const [authRequired, setAuthRequired] = useState(initialAuthRequired);
  const [page, setPage] = useState<Page>("dashboard");
  const [dashboardRole, setDashboardRole] = useState<DashboardRole>("admin");
  const [dashboardStreamer, setDashboardStreamer] = useState<DashboardStreamerInfo | undefined>();
  const [snapshot, setSnapshot] = useState<any>(initialSnapshot);
  const [socketConnected, setSocketConnected] = useState(false);
  const [authState, setAuthState] = useState<AuthState>(() => isManagedSurface(surfaceForLocation()) ? "checking" : "login");
  const [authError, setAuthError] = useState("");
  const [loginDisabled, setLoginDisabled] = useState(false);

  useEffect(() => {
    const syncSurface = () => {
      const nextSurface = surfaceForLocation();
      setSurface(nextSurface);
      if (isManagedSurface(nextSurface)) setAuthState("checking");
      if (nextSurface === "public") {
        setSocketConnected(false);
        clearDashboardCsrfToken();
      }
    };
    window.addEventListener("popstate", syncSurface);
    return () => window.removeEventListener("popstate", syncSurface);
  }, []);

  useEffect(() => {
    if (!isManagedSurface(surface)) return undefined;
    let mounted = true;
    setAuthState("checking");
    void getDashboardAuthStatus()
      .then((status) => {
        if (!mounted) return;
        setAuthRequired(status.required);
        if (!status.required || status.authenticated) {
          const role = status.role ?? "admin";
          if (surface === "admin" && role !== "admin") {
            setDashboardRole("admin");
            setDashboardStreamer(undefined);
            clearDashboardCsrfToken();
            setLoginDisabled(false);
            setAuthError(uiText.authPage.adminOnly);
            setAuthState("login");
            return;
          }
          if (surface === "streamer" && role !== "streamer") {
            window.history.replaceState({}, "", "/admin");
            setSurface("admin");
            setAuthState("checking");
            return;
          }
          setDashboardRole(role);
          setDashboardStreamer(status.streamer);
          setAuthError("");
          setLoginDisabled(false);
          setAuthState("authenticated");
        } else {
          setDashboardRole("admin");
          setDashboardStreamer(undefined);
          clearDashboardCsrfToken();
          setLoginDisabled(status.configured === false);
          setAuthError(status.configured === false ? uiText.authPage.notConfigured : "");
          setAuthState(surface === "streamer" ? "streamerAccess" : "login");
        }
      })
      .catch(() => {
        if (!mounted) return;
        clearDashboardCsrfToken();
        setLoginDisabled(false);
        setAuthError(uiText.authPage.unavailable);
        setDashboardRole("admin");
        setDashboardStreamer(undefined);
        setAuthState(surface === "streamer" ? "streamerAccess" : "login");
      });
    return () => {
      mounted = false;
    };
  }, [surface]);

  useEffect(() => {
    if (!isManagedSurface(surface) || authState !== "authenticated") return undefined;
    return connectDashboardSocket((message) => {
      if (message.type === "dashboard.snapshot") setSnapshot(message);
    }, setSocketConnected);
  }, [surface, authState]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    if (!pageAllowedForRole(page, dashboardRole)) setPage("dashboard");
  }, [authState, dashboardRole, page]);

  async function login(token: string): Promise<void> {
    if (loginDisabled) return;
    setAuthError("");
    try {
      const status = await checkDashboardAuthToken(token);
      if (!status.authenticated) {
        setAuthError(uiText.authPage.invalid);
        return;
      }
      setDashboardRole(status.role ?? "admin");
      setDashboardStreamer(status.streamer);
      setLoginDisabled(false);
      setAuthState("authenticated");
    } catch {
      setAuthError(uiText.authPage.invalid);
    }
  }

  function logout(): void {
    void logoutDashboardSession();
    clearDashboardCsrfToken();
    setSocketConnected(false);
    setSnapshot(initialSnapshot);
    setDashboardRole("admin");
    setDashboardStreamer(undefined);
    setAuthState(surface === "streamer" ? "streamerAccess" : authRequired ? "login" : "authenticated");
  }

  function openAdmin(): void {
    if (surfaceForLocation() !== "admin") window.history.pushState({}, "", "/admin");
    setSurface("admin");
    setAuthState("checking");
  }

  function openStreamerDashboard(): void {
    if (surfaceForLocation() !== "streamer") window.history.pushState({}, "", "/dashboard");
    setSurface("streamer");
    setAuthState("checking");
  }

  function openPublic(): void {
    if (surfaceForLocation() !== "public") window.history.pushState({}, "", "/");
    setSocketConnected(false);
    setSurface("public");
    clearDashboardCsrfToken();
  }

  if (surface === "public") {
    return <PublicLolPage onOpenAdmin={openAdmin} onOpenStreamerDashboard={openStreamerDashboard} />;
  }

  if (surface === "streamer" && authState !== "authenticated") {
    return <StreamerDashboardEntryPage checking={authState === "checking"} onBackToPublic={openPublic} onOpenAdmin={openAdmin} />;
  }

  if (authState !== "authenticated") {
    return <LoginPage checking={authState === "checking"} disabled={loginDisabled} error={authError} onLogin={login} onBackToPublic={openPublic} />;
  }

  return (
    <Layout page={page} setPage={setPage} role={dashboardRole} onLogout={authRequired ? logout : undefined} onPublicHome={openPublic}>
      <Suspense fallback={<div className="card loading-card">{uiText.app.loading}</div>}>
        {page === "dashboard" ? <DashboardPage snapshot={snapshot} socketConnected={socketConnected} role={dashboardRole} /> : null}
        {page === "twitch" && dashboardRole === "admin" ? <TwitchConnectionPage /> : null}
        {page === "overlayStatus" ? <OverlayOpsPage view="status" streamer={dashboardStreamer} /> : null}
        {page === "overlayTest" && dashboardRole === "admin" ? <OverlayOpsPage view="test" /> : null}
        {page === "overlayRewards" && dashboardRole === "admin" ? <OverlayOpsPage view="rewards" /> : null}
        {page === "overlayAlerts" ? <OverlayOpsPage view="alerts" /> : null}
        {page === "followers" ? <FollowersPage /> : null}
        {page === "events" ? <EventsPage snapshot={snapshot} /> : null}
        {page === "questions" ? <QuestionsPage snapshot={snapshot} /> : null}
        {page === "myRiotAccount" ? <MyRiotAccountPage streamer={dashboardStreamer} onStreamerChange={setDashboardStreamer} /> : null}
        {page === "soloRank" ? <SoloRankPage /> : null}
        {page === "participation" ? <ParticipationPage snapshot={snapshot} /> : null}
        {page === "streamerRiotRequests" && dashboardRole === "admin" ? <StreamerRiotRequestsPage snapshot={snapshot} /> : null}
        {page === "settings" && dashboardRole === "admin" ? <SettingsPage /> : null}
      </Suspense>
    </Layout>
  );
}
