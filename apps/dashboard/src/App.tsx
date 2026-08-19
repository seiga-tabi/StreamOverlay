import { Suspense, useEffect, useState } from "react";
import {
  checkDashboardAuthToken,
  getDashboardSnapshot,
  getDashboardAuthStatus,
  logoutDashboardSession,
  type DashboardAuthStatus
} from "./api/client";
import { Layout } from "./components/Layout";
import { LoginPage } from "./components/LoginPage";
import { applyDashboardLocale, dashboardI18n, detectDashboardLocale, setDashboardLocale as saveDashboardLocale, type DashboardLocale } from "./i18n";
import { clearDashboardCsrfToken, runtimeConfig } from "./runtime-config";
import { SkeletonCard } from "./shared/ui/Skeleton";
import {
  dashboardPageFromPath,
  defaultDashboardPage,
  pageAllowed,
  setDashboardPath,
  type Page
} from "./routing/dashboard-routes";
import { isPalworldPath } from "./features/public-palworld/utils/routes";
import { isValorantPath } from "./features/public-valorant/utils/routes";
import { isMinecraftPath } from "./features/public-minecraft/utils/routes";
import { isGamesPath } from "./features/public-games/utils/routes";
import { isStreamersPath } from "./features/public-streamers/utils/routes";
import { PalworldPageErrorBoundary } from "./features/public-palworld/components/PalworldPageErrorBoundary";
import { ValorantPageErrorBoundary } from "./features/public-valorant/components/ValorantPageErrorBoundary";
import { MinecraftPageErrorBoundary } from "./features/public-minecraft/components/MinecraftPageErrorBoundary";
import { lazyNamed } from "./shared/lazyNamed";
import { stripPublicLocalePrefix } from "./features/public-lol/utils/public-locale-path";

const loadPublicLolPage = () => import("./pages/PublicLolPage");
const loadPublicPalworldPage = () => import("./pages/PublicPalworldPage");
const loadPublicValorantPage = () => import("./pages/PublicValorantPage");
const loadPublicMinecraftPage = () => import("./pages/PublicMinecraftPage");
const loadPublicGamesPage = () => import("./pages/PublicGamesPage");
const loadPublicStreamersPage = () => import("./pages/PublicStreamersPage");
const PublicLolPage = lazyNamed(loadPublicLolPage, "PublicLolPage");
const PublicPalworldPage = lazyNamed(loadPublicPalworldPage, "PublicPalworldPage");
const PublicValorantPage = lazyNamed(loadPublicValorantPage, "PublicValorantPage");
const PublicMinecraftPage = lazyNamed(loadPublicMinecraftPage, "PublicMinecraftPage");
const PublicGamesPage = lazyNamed(loadPublicGamesPage, "PublicGamesPage");
const PublicStreamersPage = lazyNamed(loadPublicStreamersPage, "PublicStreamersPage");
const PublicBotPage = lazyNamed(
  () => import("./features/public-bot/PublicBotPage"),
  "PublicBotPage",
);
const YoroLoginPage = lazyNamed(
  () => import("./features/yoro-account/YoroLoginPage"),
  "YoroLoginPage",
);
const YoroAccountPage = lazyNamed(
  () => import("./features/yoro-account/YoroAccountPage"),
  "YoroAccountPage",
);
const YoroDashboardPage = lazyNamed(
  () => import("./features/yoro-dashboard/YoroDashboardPage"),
  "YoroDashboardPage",
);
const EventsPage = lazyNamed(() => import("./pages/EventsPage"), "EventsPage");
const StreamerRiotRequestsPage = lazyNamed(
  () => import("./pages/StreamerRiotRequestsPage"),
  "StreamerRiotRequestsPage",
);
const SettingsPage = lazyNamed(() => import("./pages/SettingsPage"), "SettingsPage");
const SupportInboxPage = lazyNamed(() => import("./pages/SupportInboxPage"), "SupportInboxPage");

const initialSnapshot = {
  status: { server: "offline", twitch: "disabled", stream: "unknown", participation: "closed" },
  events: [],
  actions: [],
  participationQueue: [],
  participationState: {
    isOpen: false,
    queue: [],
    activeQueue: [],
    summary: { total: 0, active: 0, waiting: 0, selected: 0, checkedIn: 0, noShow: 0, played: 0 }
  }
};

type AppSurface = "public" | "admin";
type AuthState = "checking" | "authenticated" | "login";
type AuthErrorKey = "" | "invalid" | "unavailable" | "notConfigured" | "adminOnly";

function isYoroDashboardPath(pathname: string): boolean {
  return pathname === "/dashboard"
    || pathname === "/dashboard/"
    || pathname.startsWith("/dashboard/");
}

function surfaceForLocation(): AppSurface {
  if (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/")) return "admin";
  return "public";
}

export default function App() {
  const initialAuthRequired = runtimeConfig().dashboardAuthRequired !== false;
  const [surface, setSurface] = useState<AppSurface>(() => surfaceForLocation());
  const [dashboardLocale, setDashboardLocaleState] = useState<DashboardLocale>(() => detectDashboardLocale());
  const [authRequired, setAuthRequired] = useState(initialAuthRequired);
  const [page, setPage] = useState<Page>(() => dashboardPageFromPath(window.location.pathname));
  const [snapshot, setSnapshot] = useState<any>(initialSnapshot);
  const [authState, setAuthState] = useState<AuthState>(() => surfaceForLocation() === "admin" ? "checking" : "login");
  const [authErrorKey, setAuthErrorKey] = useState<AuthErrorKey>("");
  const [loginDisabled, setLoginDisabled] = useState(false);
  const [routeRevision, setRouteRevision] = useState(0);
  const currentText = dashboardI18n[dashboardLocale];
  const authError = authErrorKey ? currentText.authPage[authErrorKey] : "";

  function syncDashboardLocalePreference(): DashboardLocale {
    const nextLocale = detectDashboardLocale();
    saveDashboardLocale(nextLocale);
    setDashboardLocaleState(nextLocale);
    return nextLocale;
  }

  useEffect(() => {
    if (surface !== "admin") return undefined;
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

  useEffect(() => {
    if (surface !== "public") return undefined;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean };
    }).connection;
    if (connection?.saveData) return undefined;
    const preload = window.setTimeout(() => {
      if (isPalworldPath(window.location.pathname)) {
        void loadPublicLolPage();
      } else {
        void loadPublicPalworldPage();
      }
    }, 1_500);
    return () => window.clearTimeout(preload);
  }, [routeRevision, surface]);

  function changeDashboardLocale(locale: DashboardLocale): void {
    saveDashboardLocale(locale);
    setDashboardLocaleState(locale);
  }

  useEffect(() => {
    const syncSurface = () => {
      const nextSurface = surfaceForLocation();
      setRouteRevision((revision) => revision + 1);
      if (nextSurface === "admin") syncDashboardLocalePreference();
      setSurface(nextSurface);
      if (nextSurface === "admin") {
        setPage(dashboardPageFromPath(window.location.pathname));
        setAuthState("checking");
      }
      if (nextSurface === "public") {
        clearDashboardCsrfToken();
      }
    };
    window.addEventListener("popstate", syncSurface);
    window.addEventListener("publicroutechange", syncSurface);
    return () => {
      window.removeEventListener("popstate", syncSurface);
      window.removeEventListener("publicroutechange", syncSurface);
    };
  }, []);

  useEffect(() => {
    if (surface !== "admin") return undefined;
    let mounted = true;
    setAuthState("checking");

    const failAuthentication = () => {
      if (!mounted) return;
      clearDashboardCsrfToken();
      setLoginDisabled(false);
      setAuthErrorKey("unavailable");
      setAuthState("login");
    };

    const applyStatus = (status: DashboardAuthStatus) => {
      if (!mounted) return;
      setAuthRequired(status.required);
      if (!status.required || status.authenticated) {
        if ((status.role ?? "admin") !== "admin") {
          clearDashboardCsrfToken();
          setLoginDisabled(false);
          setAuthErrorKey("adminOnly");
          setAuthState("login");
          return;
        }
        setAuthErrorKey("");
        setLoginDisabled(false);
        setAuthState("authenticated");
        return;
      }
      clearDashboardCsrfToken();
      setLoginDisabled(status.configured === false);
      setAuthErrorKey(status.configured === false ? "notConfigured" : "");
      setAuthState("login");
    };

    void getDashboardAuthStatus().then(applyStatus).catch(failAuthentication);
    return () => {
      mounted = false;
    };
  }, [surface, routeRevision]);

  useEffect(() => {
    if (surface !== "admin" || authState !== "authenticated") return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const nextSnapshot = await getDashboardSnapshot();
        if (!cancelled) setSnapshot(nextSnapshot);
      } catch {
        // 일시적인 API 오류에는 마지막으로 확인한 상태를 유지합니다.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [surface, authState]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    if (!pageAllowed(page)) {
      const pathPage = dashboardPageFromPath(window.location.pathname);
      const nextPage = pageAllowed(pathPage) ? pathPage : defaultDashboardPage();
      setPage(nextPage);
      setDashboardPath(nextPage, true);
    }
  }, [authState, page]);

  function changeDashboardPage(nextPage: Page): void {
    if (!pageAllowed(nextPage)) return;
    setPage(nextPage);
    setDashboardPath(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
      setLoginDisabled(false);
      setAuthState("authenticated");
    } catch {
      setAuthErrorKey("invalid");
    }
  }

  function logout(): void {
    void logoutDashboardSession();
    clearDashboardCsrfToken();
    setSnapshot(initialSnapshot);
    setAuthState(authRequired ? "login" : "authenticated");
  }

  function openAdmin(): void {
    syncDashboardLocalePreference();
    if (surfaceForLocation() !== "admin") window.history.pushState({}, "", "/admin");
    setSurface("admin");
    setAuthState("checking");
  }

  function openPublic(): void {
    if (surfaceForLocation() !== "public") window.history.pushState({}, "", "/");
    setSurface("public");
    clearDashboardCsrfToken();
  }

  if (surface === "public") {
    const publicPathname = stripPublicLocalePrefix(window.location.pathname);
    const yoroDashboard = isYoroDashboardPath(window.location.pathname);
    const yoroLogin = window.location.pathname === "/login"
      || window.location.pathname === "/login/";
    const yoroAccount = window.location.pathname === "/account"
      || window.location.pathname === "/account/"
      || window.location.pathname === "/account/connections"
      || window.location.pathname === "/account/connections/";
    const botPublic = publicPathname === "/bot"
      || publicPathname === "/bot/"
      || publicPathname === "/bot/getting-started"
      || publicPathname === "/bot/getting-started/"
      || publicPathname === "/bot/commands"
      || publicPathname === "/bot/commands/"
      || publicPathname === "/bot/game-files"
      || publicPathname === "/bot/game-files/"
      || publicPathname === "/bot/features"
      || publicPathname === "/bot/features/"
      || publicPathname === "/bot/connect"
      || publicPathname === "/bot/connect/"
      || publicPathname === "/bot/dedicated-server"
      || publicPathname === "/bot/dedicated-server/";
    const palworldPublic = isPalworldPath(publicPathname);
    const valorantPublic = isValorantPath(publicPathname);
    const minecraftPublic = isMinecraftPath(publicPathname);
    const gamesPublic = isGamesPath(publicPathname);
    const streamersPublic = isStreamersPath(publicPathname);
    return (
      yoroDashboard ? (
        <Suspense fallback={<SkeletonCard loadingLabel={currentText.app.loading} size="lg" />}>
          <YoroDashboardPage />
        </Suspense>
      ) : yoroLogin ? (
        <Suspense fallback={<SkeletonCard loadingLabel={currentText.app.loading} size="lg" />}>
          <YoroLoginPage />
        </Suspense>
      ) : yoroAccount ? (
        <Suspense fallback={<SkeletonCard loadingLabel={currentText.app.loading} size="lg" />}>
          <YoroAccountPage />
        </Suspense>
      ) : botPublic ? (
        <Suspense fallback={<SkeletonCard loadingLabel={currentText.app.loading} size="lg" />}>
          <PublicBotPage />
        </Suspense>
      ) : gamesPublic ? (
        <Suspense fallback={<SkeletonCard loadingLabel={currentText.app.loading} size="lg" />}>
          <PublicGamesPage />
        </Suspense>
      ) : streamersPublic ? (
        <Suspense fallback={<SkeletonCard loadingLabel={currentText.app.loading} size="lg" />}>
          <PublicStreamersPage />
        </Suspense>
      ) : minecraftPublic ? (
        <MinecraftPageErrorBoundary>
          <Suspense fallback={(
            <SkeletonCard
              className="minecraft-page-section"
              data-ko={dashboardI18n.ko.app.loading}
              data-ja={dashboardI18n.ja.app.loading}
              loadingLabel={currentText.app.loading}
              size="lg"
            />
          )}>
            <PublicMinecraftPage />
          </Suspense>
        </MinecraftPageErrorBoundary>
      ) : valorantPublic ? (
        <ValorantPageErrorBoundary>
          <Suspense fallback={(
            <SkeletonCard
              className="valorant-page-section"
              data-ko={dashboardI18n.ko.app.loading}
              data-ja={dashboardI18n.ja.app.loading}
              loadingLabel={currentText.app.loading}
              size="lg"
            />
          )}>
            <PublicValorantPage />
          </Suspense>
        </ValorantPageErrorBoundary>
      ) : palworldPublic ? (
        <PalworldPageErrorBoundary>
          <Suspense fallback={(
            <SkeletonCard
              className="palworld-page-section"
              data-ko={dashboardI18n.ko.app.loading}
              data-ja={dashboardI18n.ja.app.loading}
              loadingLabel={currentText.app.loading}
              size="lg"
            />
          )}>
            <PublicPalworldPage />
          </Suspense>
        </PalworldPageErrorBoundary>
      ) : (
        <Suspense fallback={<div role="status" aria-live="polite" data-ko={dashboardI18n.ko.app.loading} data-ja={dashboardI18n.ja.app.loading} aria-label={currentText.app.loading} />}>
          <PublicLolPage onOpenAdmin={openAdmin} />
        </Suspense>
      )
    );
  }

  if (authState !== "authenticated") {
    return <LoginPage checking={authState === "checking"} disabled={loginDisabled} error={authError} onLogin={login} onBackToPublic={openPublic} locale={dashboardLocale} />;
  }

  return (
    <Layout page={page} setPage={changeDashboardPage} locale={dashboardLocale} onLocaleChange={changeDashboardLocale} onLogout={authRequired ? logout : undefined} onPublicHome={openPublic}>
      <Suspense fallback={<div className="card loading-card" data-ko={dashboardI18n.ko.app.loading} data-ja={dashboardI18n.ja.app.loading}>{currentText.app.loading}</div>}>
        {page === "events" ? <EventsPage snapshot={snapshot} /> : null}
        {page === "streamerRiotRequests" ? <StreamerRiotRequestsPage snapshot={snapshot} /> : null}
        {page === "supportInbox" ? <SupportInboxPage /> : null}
        {page === "settings" ? <SettingsPage /> : null}
      </Suspense>
    </Layout>
  );
}
