import { lazy, Suspense, useEffect, useState } from "react";
import { checkDashboardAuthToken, getDashboardAuthStatus, logoutDashboardSession } from "./api/client";
import { connectDashboardSocket } from "./api/socket";
import { Layout, type Page } from "./components/Layout";
import { LoginPage } from "./components/LoginPage";
import { uiText } from "./i18n";
import { clearDashboardCsrfToken, runtimeConfig } from "./runtime-config";

const DashboardPage = lazy(async () => ({ default: (await import("./pages/DashboardPage")).DashboardPage }));
const EventsPage = lazy(async () => ({ default: (await import("./pages/EventsPage")).EventsPage }));
const QuestionsPage = lazy(async () => ({ default: (await import("./pages/QuestionsPage")).QuestionsPage }));
const ParticipationPage = lazy(async () => ({ default: (await import("./pages/ParticipationPage")).ParticipationPage }));
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

export default function App() {
  const initialAuthRequired = runtimeConfig().dashboardAuthRequired !== false;
  const [authRequired, setAuthRequired] = useState(initialAuthRequired);
  const [page, setPage] = useState<Page>("dashboard");
  const [snapshot, setSnapshot] = useState<any>(initialSnapshot);
  const [socketConnected, setSocketConnected] = useState(false);
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "login">("checking");
  const [authError, setAuthError] = useState("");
  const [loginDisabled, setLoginDisabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getDashboardAuthStatus()
      .then((status) => {
        if (!mounted) return;
        setAuthRequired(status.required);
        if (!status.required || status.authenticated) {
          setAuthError("");
          setLoginDisabled(false);
          setAuthState("authenticated");
        } else {
          clearDashboardCsrfToken();
          setLoginDisabled(status.configured === false);
          setAuthError(status.configured === false ? uiText.authPage.notConfigured : "");
          setAuthState("login");
        }
      })
      .catch(() => {
        if (!mounted) return;
        clearDashboardCsrfToken();
        setLoginDisabled(false);
        setAuthError(uiText.authPage.unavailable);
        setAuthState("login");
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return undefined;
    return connectDashboardSocket((message) => {
      if (message.type === "dashboard.snapshot") setSnapshot(message);
    }, setSocketConnected);
  }, [authState]);

  async function login(token: string): Promise<void> {
    if (loginDisabled) return;
    setAuthError("");
    try {
      const status = await checkDashboardAuthToken(token);
      if (!status.authenticated) {
        setAuthError(uiText.authPage.invalid);
        return;
      }
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
    setAuthState(authRequired ? "login" : "authenticated");
  }

  if (authState !== "authenticated") {
    return <LoginPage checking={authState === "checking"} disabled={loginDisabled} error={authError} onLogin={login} />;
  }

  return (
    <Layout page={page} setPage={setPage} onLogout={authRequired ? logout : undefined}>
      <Suspense fallback={<div className="card loading-card">{uiText.app.loading}</div>}>
        {page === "dashboard" ? <DashboardPage snapshot={snapshot} socketConnected={socketConnected} /> : null}
        {page === "twitch" ? <TwitchConnectionPage /> : null}
        {page === "overlayStatus" ? <OverlayOpsPage view="status" /> : null}
        {page === "overlayTest" ? <OverlayOpsPage view="test" /> : null}
        {page === "overlayRewards" ? <OverlayOpsPage view="rewards" /> : null}
        {page === "overlayAlerts" ? <OverlayOpsPage view="alerts" /> : null}
        {page === "followers" ? <FollowersPage /> : null}
        {page === "events" ? <EventsPage snapshot={snapshot} /> : null}
        {page === "questions" ? <QuestionsPage snapshot={snapshot} /> : null}
        {page === "participation" ? <ParticipationPage snapshot={snapshot} /> : null}
        {page === "settings" ? <SettingsPage /> : null}
      </Suspense>
    </Layout>
  );
}
