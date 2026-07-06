import { lazy, Suspense, useEffect, useState } from "react";
import { checkDashboardAuthToken, getDashboardAuthStatus, logoutDashboardSession, setDashboardAuthSurface, type DashboardAuthSurface, type DashboardStreamerInfo } from "./api/client";
import { connectDashboardSocket } from "./api/socket";
import { Layout, pageAllowedForRole, type DashboardRole, type Page } from "./components/Layout";
import { LoginPage } from "./components/LoginPage";
import { applyDashboardLocale, dashboardI18n, detectDashboardLocale, setDashboardLocale as saveDashboardLocale, type DashboardLocale } from "./i18n";
import { PublicLolPage } from "./pages/PublicLolPage";
import { clearDashboardCsrfToken, runtimeConfig } from "./runtime-config";

const DashboardPage = lazy(async () => ({ default: (await import("./pages/DashboardPage")).DashboardPage }));
const EventsPage = lazy(async () => ({ default: (await import("./pages/EventsPage")).EventsPage }));
const QuestionsPage = lazy(async () => ({ default: (await import("./pages/QuestionsPage")).QuestionsPage }));
const MyRiotAccountPage = lazy(async () => ({ default: (await import("./pages/MyRiotAccountPage")).MyRiotAccountPage }));
const SoloRankPage = lazy(async () => ({ default: (await import("./pages/SoloRankPage")).SoloRankPage }));
const ParticipationPage = lazy(async () => ({ default: (await import("./pages/ParticipationPage")).ParticipationPage }));
const TournamentsPage = lazy(async () => ({ default: (await import("./pages/TournamentsPage")).TournamentsPage }));
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
type AuthErrorKey = "" | "invalid" | "unavailable" | "notConfigured" | "adminOnly";

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

function surfaceForLocation(): AppSurface {
  if (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/")) return "admin";
  if (window.location.pathname === "/dashboard" || window.location.pathname.startsWith("/dashboard/")) return "streamer";
  return "public";
}

function isManagedSurface(surface: AppSurface): boolean {
  return surface === "admin" || surface === "streamer";
}

function authSurfaceFor(surface: AppSurface): DashboardAuthSurface {
  return surface === "streamer" ? "streamer" : "admin";
}

function StreamerDashboardEntryPage({
  checking,
  locale,
  onBackToPublic,
  onOpenAdmin
}: {
  checking: boolean;
  locale: DashboardLocale;
  onBackToPublic: () => void;
  onOpenAdmin: () => void;
}) {
  const streamerEntryText = streamerEntryI18n[locale];
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-block auth-brand">
          <img className="brand-logo" src="/images/seigagg-logo.png" alt="Seiga.GG" />
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
  const [dashboardLocale, setDashboardLocaleState] = useState<DashboardLocale>(() => detectDashboardLocale());
  const [authRequired, setAuthRequired] = useState(initialAuthRequired);
  const [page, setPage] = useState<Page>("dashboard");
  const [dashboardRole, setDashboardRole] = useState<DashboardRole>("admin");
  const [dashboardStreamer, setDashboardStreamer] = useState<DashboardStreamerInfo | undefined>();
  const [snapshot, setSnapshot] = useState<any>(initialSnapshot);
  const [socketConnected, setSocketConnected] = useState(false);
  const [authState, setAuthState] = useState<AuthState>(() => isManagedSurface(surfaceForLocation()) ? "checking" : "login");
  const [authErrorKey, setAuthErrorKey] = useState<AuthErrorKey>("");
  const [loginDisabled, setLoginDisabled] = useState(false);
  const currentText = dashboardI18n[dashboardLocale];
  const authError = authErrorKey ? currentText.authPage[authErrorKey] : "";

  function syncDashboardLocalePreference(): DashboardLocale {
    const nextLocale = detectDashboardLocale();
    saveDashboardLocale(nextLocale);
    setDashboardLocaleState(nextLocale);
    return nextLocale;
  }

  useEffect(() => {
    if (!isManagedSurface(surface)) return undefined;
    saveDashboardLocale(dashboardLocale);
    applyDashboardLocale(dashboardLocale);
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        applyDashboardLocale(dashboardLocale);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [dashboardLocale, surface]);

  function changeDashboardLocale(locale: DashboardLocale): void {
    saveDashboardLocale(locale);
    setDashboardLocaleState(locale);
  }

  useEffect(() => {
    const syncSurface = () => {
      const nextSurface = surfaceForLocation();
      if (isManagedSurface(nextSurface)) syncDashboardLocalePreference();
      setSurface(nextSurface);
      if (isManagedSurface(nextSurface)) {
        setDashboardAuthSurface(authSurfaceFor(nextSurface));
        setAuthState("checking");
      }
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
    const authSurface = authSurfaceFor(surface);
    setDashboardAuthSurface(authSurface);
    setAuthState("checking");
    void getDashboardAuthStatus(authSurface)
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
            setAuthErrorKey("adminOnly");
            setAuthState("login");
            return;
          }
          if (surface === "streamer" && role !== "streamer") {
            setDashboardRole("admin");
            setDashboardStreamer(undefined);
            clearDashboardCsrfToken();
            setAuthErrorKey("");
            setLoginDisabled(false);
            setAuthState("streamerAccess");
            return;
          }
          setDashboardRole(role);
          setDashboardStreamer(status.streamer);
          setAuthErrorKey("");
          setLoginDisabled(false);
          setAuthState("authenticated");
        } else {
          setDashboardRole("admin");
          setDashboardStreamer(undefined);
          clearDashboardCsrfToken();
          setLoginDisabled(status.configured === false);
          setAuthErrorKey(status.configured === false ? "notConfigured" : "");
          setAuthState(surface === "streamer" ? "streamerAccess" : "login");
        }
      })
      .catch(() => {
        if (!mounted) return;
        clearDashboardCsrfToken();
        setLoginDisabled(false);
        setAuthErrorKey("unavailable");
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
    }, setSocketConnected, authSurfaceFor(surface));
  }, [surface, authState]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    if (!pageAllowedForRole(page, dashboardRole)) setPage("dashboard");
  }, [authState, dashboardRole, page]);

  async function login(token: string): Promise<void> {
    if (loginDisabled) return;
    setAuthErrorKey("");
    try {
      const status = await checkDashboardAuthToken(token);
      if (!status.authenticated) {
        setAuthErrorKey("invalid");
        return;
      }
      if ((status.role ?? "admin") !== "admin") {
        setAuthErrorKey("adminOnly");
        return;
      }
      setDashboardRole(status.role ?? "admin");
      setDashboardStreamer(status.streamer);
      setLoginDisabled(false);
      setAuthState("authenticated");
    } catch {
      setAuthErrorKey("invalid");
    }
  }

  function logout(): void {
    void logoutDashboardSession(authSurfaceFor(surface));
    clearDashboardCsrfToken();
    setSocketConnected(false);
    setSnapshot(initialSnapshot);
    setDashboardRole("admin");
    setDashboardStreamer(undefined);
    setAuthState(surface === "streamer" ? "streamerAccess" : authRequired ? "login" : "authenticated");
  }

  function openAdmin(): void {
    syncDashboardLocalePreference();
    if (surfaceForLocation() !== "admin") window.history.pushState({}, "", "/admin");
    setSurface("admin");
    setAuthState("checking");
  }

  function openStreamerDashboard(): void {
    syncDashboardLocalePreference();
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
    return <StreamerDashboardEntryPage checking={authState === "checking"} locale={dashboardLocale} onBackToPublic={openPublic} onOpenAdmin={openAdmin} />;
  }

  if (authState !== "authenticated") {
    return <LoginPage checking={authState === "checking"} disabled={loginDisabled} error={authError} onLogin={login} onBackToPublic={openPublic} locale={dashboardLocale} />;
  }

  return (
    <Layout page={page} setPage={setPage} role={dashboardRole} locale={dashboardLocale} onLocaleChange={changeDashboardLocale} onLogout={authRequired ? logout : undefined} onPublicHome={openPublic}>
      <Suspense fallback={<div className="card loading-card" data-ko={dashboardI18n.ko.app.loading} data-ja={dashboardI18n.ja.app.loading}>{currentText.app.loading}</div>}>
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
        {page === "tournaments" ? <TournamentsPage /> : null}
        {page === "streamerRiotRequests" && dashboardRole === "admin" ? <StreamerRiotRequestsPage snapshot={snapshot} /> : null}
        {page === "settings" && dashboardRole === "admin" ? <SettingsPage /> : null}
      </Suspense>
    </Layout>
  );
}
