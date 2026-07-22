import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicTwitchFollowedLolResponse, PublicTwitchViewerStatus } from "../features/public-lol/types/public-lol";
import { AppShell, AppShellHeader, AppShellMain } from "../shared/ui/AppShell";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../shared/ui/Toast";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import { setActivePublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { PalworldBreedingPage } from "../features/public-palworld/components/PalworldBreedingPage";
import { ItemDetailModal, PalDetailModal } from "../features/public-palworld/components/PalworldDetailModals";
import { PalworldHeader } from "../features/public-palworld/components/PalworldHeader";
import { PalworldHome } from "../features/public-palworld/components/PalworldHome";
import { PalworldItemsPage } from "../features/public-palworld/components/PalworldItemsPage";
import { PalworldPalsPage } from "../features/public-palworld/components/PalworldPalsPage";
import { PalworldSearchForm } from "../features/public-palworld/components/PalworldSearchForm";
import { PalworldSearchResults } from "../features/public-palworld/components/PalworldSearchResults";
import { PalworldSourceFooter } from "../features/public-palworld/components/PalworldSourceFooter";
import { PalworldStreamersPage } from "../features/public-palworld/components/PalworldStreamersPage";
import { palworldI18n, type PalworldLocale } from "../features/public-palworld/i18n/palworld-i18n";
import { PALWORLD_VERSION_MISMATCH_EVENT } from "../features/public-palworld/api/palworld";
import { usePalworldRoute } from "../features/public-palworld/hooks/usePalworldRoute";
import { palworldHomeLiveStreamerCards } from "../features/public-palworld/utils/streamers";
import { palworldTwitchReturnTo, palworldUrl, setPalworldUrl, withQueryParam } from "../features/public-palworld/utils/routes";
import {
  getPublicTwitchFollowedChannels,
  getPublicTwitchStatus,
  logoutPublicTwitch,
  publicTwitchLoginUrl,
} from "../features/public-twitch/api";

const noServerLocalePreference = async (): Promise<PalworldLocale | undefined> => undefined;

const EMPTY_TWITCH_STATUS: PublicTwitchViewerStatus = {
  connected: false,
  configured: false,
  requiredScopes: [],
  missingScopes: [],
};

export function PublicPalworldPage({
  onOpenStreamerDashboard = () => undefined,
}: {
  onOpenStreamerDashboard?: () => void;
}) {
  const { locale, changeLocale } = usePublicLocale(noServerLocalePreference);
  const { theme } = usePublicTheme();
  const { page, params } = usePalworldRoute();
  const text = palworldI18n[locale];
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [twitchStatus, setTwitchStatus] = useState<PublicTwitchViewerStatus>(EMPTY_TWITCH_STATUS);
  const [followedChannels, setFollowedChannels] = useState<PublicTwitchFollowedLolResponse | null>(null);
  const [twitchStatusLoading, setTwitchStatusLoading] = useState(true);
  const [followedLoading, setFollowedLoading] = useState(false);
  const [twitchStatusError, setTwitchStatusError] = useState(false);
  const [followedError, setFollowedError] = useState(false);
  const twitchStatusRef = useRef<PublicTwitchViewerStatus>(EMPTY_TWITCH_STATUS);
  const statusRequestRef = useRef<Promise<void> | null>(null);
  const statusAbortRef = useRef<AbortController | null>(null);
  const followedRequestRef = useRef<Promise<void> | null>(null);
  const followedAbortRef = useRef<AbortController | null>(null);
  const logoutInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const needsFollowedChannels = page === "home" || page === "streamers";
  const selectedPalId = params.get("pal")?.trim() || undefined;
  // 조작된 URL에 두 상세 ID가 함께 있어도 Modal은 하나만 표시합니다.
  const selectedItemId = selectedPalId ? undefined : params.get("item")?.trim() || undefined;

  setActivePublicLocale(locale);

  const refreshTwitchStatus = useCallback(async (): Promise<void> => {
    if (logoutInFlightRef.current) return;
    if (statusRequestRef.current) return statusRequestRef.current;
    const controller = new AbortController();
    statusAbortRef.current?.abort();
    statusAbortRef.current = controller;
    setTwitchStatusLoading(true);
    setTwitchStatusError(false);
    const request = (async () => {
      try {
        const status = await getPublicTwitchStatus(controller.signal);
        if (!mountedRef.current || controller.signal.aborted) return;
        twitchStatusRef.current = status;
        setTwitchStatus(status);
        if (!status.connected) {
          followedAbortRef.current?.abort();
          followedAbortRef.current = null;
          followedRequestRef.current = null;
          setFollowedChannels(null);
          setFollowedLoading(false);
          setFollowedError(false);
        }
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        if (mountedRef.current && !controller.signal.aborted) setTwitchStatusError(true);
      } finally {
        if (mountedRef.current && statusAbortRef.current === controller) setTwitchStatusLoading(false);
      }
    })();
    statusRequestRef.current = request;
    try {
      await request;
    } finally {
      if (statusRequestRef.current === request) statusRequestRef.current = null;
      if (statusAbortRef.current === controller) statusAbortRef.current = null;
    }
  }, []);

  const refreshFollowedChannels = useCallback(async (): Promise<void> => {
    if (logoutInFlightRef.current) return;
    if (!twitchStatusRef.current.connected) return;
    if (followedRequestRef.current) return followedRequestRef.current;
    const controller = new AbortController();
    followedAbortRef.current?.abort();
    followedAbortRef.current = controller;
    setFollowedLoading(true);
    setFollowedError(false);
    const request = (async () => {
      try {
        const followed = await getPublicTwitchFollowedChannels(controller.signal);
        if (!mountedRef.current || controller.signal.aborted) return;
        setFollowedChannels(followed);
        if (!followed.connected) {
          const disconnected = { ...twitchStatusRef.current, connected: false, user: undefined };
          twitchStatusRef.current = disconnected;
          setTwitchStatus(disconnected);
        }
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        if (mountedRef.current && !controller.signal.aborted) setFollowedError(true);
      } finally {
        if (mountedRef.current && followedAbortRef.current === controller) setFollowedLoading(false);
      }
    })();
    followedRequestRef.current = request;
    try {
      await request;
    } finally {
      if (followedRequestRef.current === request) followedRequestRef.current = null;
      if (followedAbortRef.current === controller) followedAbortRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const query = new URLSearchParams(window.location.search);
    const viewerConnected = query.get("viewer_twitch") === "connected";
    if (viewerConnected) {
      query.delete("viewer_twitch");
      const nextQuery = query.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`);
    }
    void refreshTwitchStatus();
    const retryTimer = viewerConnected ? window.setTimeout(() => void refreshTwitchStatus(), 350) : undefined;
    return () => {
      mountedRef.current = false;
      statusAbortRef.current?.abort();
      followedAbortRef.current?.abort();
      statusAbortRef.current = null;
      followedAbortRef.current = null;
      statusRequestRef.current = null;
      followedRequestRef.current = null;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [refreshTwitchStatus]);

  useEffect(() => {
    if (!needsFollowedChannels) {
      followedAbortRef.current?.abort();
      followedAbortRef.current = null;
      followedRequestRef.current = null;
      setFollowedLoading(false);
      return;
    }
    if (twitchStatus.connected && !followedChannels && !followedError) void refreshFollowedChannels();
  }, [followedChannels, followedError, needsFollowedChannels, refreshFollowedChannels, twitchStatus.connected]);

  useEffect(() => {
    const handleMismatch = () => setVersionMismatch(true);
    window.addEventListener(PALWORLD_VERSION_MISMATCH_EVENT, handleMismatch);
    return () => window.removeEventListener(PALWORLD_VERSION_MISMATCH_EVENT, handleMismatch);
  }, []);

  const handleLocale = useCallback((nextLocale: PalworldLocale) => {
    setActivePublicLocale(nextLocale);
    changeLocale(nextLocale);
  }, [changeLocale]);

  const startTwitchLogin = useCallback(() => {
    const returnTo = palworldTwitchReturnTo(window.location.pathname, window.location.search);
    window.location.href = publicTwitchLoginUrl(returnTo);
  }, []);

  const disconnectTwitch = useCallback(async () => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    try {
      statusAbortRef.current?.abort();
      followedAbortRef.current?.abort();
      statusRequestRef.current = null;
      followedRequestRef.current = null;
      await logoutPublicTwitch();
      if (!mountedRef.current) return;
      const disconnected = {
        connected: false,
        configured: twitchStatusRef.current.configured,
        requiredScopes: twitchStatusRef.current.requiredScopes,
        missingScopes: twitchStatusRef.current.requiredScopes,
      };
      twitchStatusRef.current = disconnected;
      setTwitchStatus(disconnected);
      setFollowedChannels(null);
      setTwitchStatusLoading(false);
      setFollowedLoading(false);
      setTwitchStatusError(false);
      setFollowedError(false);
    } catch {
      if (mountedRef.current) setTwitchStatusError(true);
    } finally {
      logoutInFlightRef.current = false;
    }
  }, []);

  const twitchLoading = twitchStatusLoading
    || (needsFollowedChannels && twitchStatus.connected && !followedChannels && !followedError)
    || followedLoading;
  const twitchError = twitchStatusError || followedError;
  const retryTwitch = useCallback(() => {
    if (twitchStatusError || !twitchStatusRef.current.connected) return refreshTwitchStatus();
    return refreshFollowedChannels();
  }, [refreshFollowedChannels, refreshTwitchStatus, twitchStatusError]);

  const liveStreamers = useMemo(
    () => palworldHomeLiveStreamerCards(followedChannels?.channels ?? [], locale),
    [followedChannels, locale],
  );

  const navigateSearch = useCallback((query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    setPalworldUrl(palworldUrl("search", new URLSearchParams({ q: normalized })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openPalPage = useCallback((id: string) => {
    setPalworldUrl(palworldUrl("pals", new URLSearchParams({ pal: id })));
  }, []);

  const openItemPage = useCallback((id: string) => {
    setPalworldUrl(palworldUrl("items", new URLSearchParams({ item: id })));
  }, []);

  const openPalHere = useCallback((id: string) => {
    const current = `${window.location.pathname}${window.location.search}`;
    setPalworldUrl(withQueryParam(withQueryParam(current, "item"), "pal", id));
  }, []);

  const openItemHere = useCallback((id: string) => {
    const current = `${window.location.pathname}${window.location.search}`;
    setPalworldUrl(withQueryParam(withQueryParam(current, "pal"), "item", id));
  }, []);

  const closeDetail = useCallback(() => {
    const current = `${window.location.pathname}${window.location.search}`;
    setPalworldUrl(withQueryParam(withQueryParam(current, "pal"), "item"), true);
  }, []);

  const headerSearch = page === "home" ? undefined : (
    <PalworldSearchForm
      initialQuery={page === "search" ? params.get("q") ?? "" : ""}
      locale={locale}
      onSearch={navigateSearch}
      onPal={(pal) => openPalPage(pal.id)}
      onItem={(item) => openItemPage(item.id)}
    />
  );

  return (
    <AppShell
      className={`public-lol-shell public-dashboard-shell palworld-shell theme-${theme}`}
      mainId="palworld-main"
      renderRoot={({ children, ...rootProps }) => <main {...rootProps}>{children}</main>}
      showSkipLink={false}
      sidebarMode="drawer"
      variant="public"
    >
      <AppShellHeader as="div" className="palworld-shell-header">
        <PalworldHeader
          locale={locale}
          onLocale={handleLocale}
          onStreamerDashboard={onOpenStreamerDashboard}
          onTwitchLogin={startTwitchLogin}
          onTwitchLogout={() => void disconnectTwitch()}
          page={page}
          searchContent={headerSearch}
          twitchStatus={twitchStatus}
        />
      </AppShellHeader>
      <AppShellMain className="palworld-main" id="palworld-main">
        {page === "home" ? (
          <PalworldHome
            liveError={twitchError}
            liveLoading={twitchLoading}
            liveStreamers={liveStreamers}
            locale={locale}
            onLiveRetry={() => void retryTwitch()}
            onOpenItem={openItemPage}
            onOpenPal={openPalPage}
            onSearch={navigateSearch}
            onShowStreamers={() => setPalworldUrl(palworldUrl("streamers"))}
            onTwitchLogin={startTwitchLogin}
            twitchConfigured={twitchStatus.configured}
            twitchConnected={twitchStatus.connected}
          />
        ) : null}
        {page === "streamers" ? (
          <PalworldStreamersPage
            channels={followedChannels?.channels ?? []}
            error={twitchError}
            loading={twitchLoading}
            locale={locale}
            onLogin={startTwitchLogin}
            onRefresh={() => void retryTwitch()}
            status={twitchStatus}
            total={followedChannels?.total}
          />
        ) : null}
        {page === "search" ? <PalworldSearchResults locale={locale} query={params.get("q") ?? ""} onOpenPal={openPalHere} onOpenItem={openItemHere} /> : null}
        {page === "pals" ? <PalworldPalsPage locale={locale} params={params} onOpenPal={openPalHere} /> : null}
        {page === "breeding" ? <PalworldBreedingPage locale={locale} onOpenPal={openPalHere} /> : null}
        {page === "items" ? <PalworldItemsPage locale={locale} params={params} onOpenItem={openItemHere} /> : null}
      </AppShellMain>
      <PalworldSourceFooter locale={locale} />
      <PalDetailModal palId={selectedPalId} locale={locale} onClose={closeDetail} onOpenItem={openItemPage} />
      <ItemDetailModal itemId={selectedItemId} locale={locale} onClose={closeDetail} onOpenPal={openPalPage} onOpenItem={openItemPage} />
      <ToastProvider position="bottom-right">
        <ToastViewport>
          {versionMismatch ? (
            <Toast tone="warning" onDismiss={() => setVersionMismatch(false)}>
              <ToastTitle data-ko={palworldI18n.ko.dataVersion} data-ja={palworldI18n.ja.dataVersion}>{text.dataVersion}</ToastTitle>
              <ToastDescription data-ko={palworldI18n.ko.versionMismatch} data-ja={palworldI18n.ja.versionMismatch}>{text.versionMismatch}</ToastDescription>
              <ToastCloseButton aria-label={text.close}>×</ToastCloseButton>
            </Toast>
          ) : null}
        </ToastViewport>
      </ToastProvider>
      <span className="palworld-sr-version" aria-live="polite">{text.dataVersion}</span>
    </AppShell>
  );
}
