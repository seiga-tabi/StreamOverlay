import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "../styles/pages/public-palworld/palworld-route.css";
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
import { SkeletonCard } from "../shared/ui/Skeleton";
import { lazyNamed } from "../shared/lazyNamed";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import { setActivePublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { PalworldBottomTabBar } from "../features/public-palworld/components/PalworldBottomTabBar";
import { PalworldHeader } from "../features/public-palworld/components/PalworldHeader";
import { PalworldHome } from "../features/public-palworld/components/PalworldHome";
import { PalworldNotFoundPage } from "../features/public-palworld/components/PalworldNotFoundPage";
import { PalworldSearchForm } from "../features/public-palworld/components/PalworldSearchForm";
import { PalworldSourceFooter } from "../features/public-palworld/components/PalworldSourceFooter";
import { PalworldPageGuide } from "../features/public-palworld/components/PalworldPageGuide";
import { palworldI18n, type PalworldLocale } from "../features/public-palworld/i18n/palworld-i18n";
import {
  PALWORLD_VERSION_MISMATCH_EVENT,
  resetPalworldReleaseObservation,
} from "../features/public-palworld/api/palworld";
import { usePalworldRoute } from "../features/public-palworld/hooks/usePalworldRoute";
import { palworldHomeLiveStreamerCards } from "../features/public-palworld/utils/streamers";
import {
  isKnownPalworldPagePath,
  isPalworldEntityListPath,
  palworldCondensationStarsFromParams,
  palworldDetailFromPath,
  palworldDetailPath,
  palworldDetailPathWithListQuery,
  palworldDetailSelectionFromLocation,
  palworldFocusPalFromParams,
  palworldPageFromPath,
  palworldPathForPage,
  palworldSpawnPeriodFromParams,
  palworldTwitchReturnTo,
  palworldUrl,
  setPalworldUrl,
  withQueryParam,
  type PalworldPage,
} from "../features/public-palworld/utils/routes";
import { applyPalworldSeo } from "../features/public-palworld/utils/seo";
import { trackEntityView, trackInternalLinkClick } from "../analytics/google-analytics";
import {
  getPublicTwitchFollowedChannels,
  getPublicTwitchStatus,
  invalidatePublicTwitchClientCache,
  logoutPublicTwitch,
  peekPublicTwitchFollowedChannels,
  peekPublicTwitchStatus,
  publicTwitchLoginUrl,
} from "../features/public-twitch/api";
import { isTwitchAccountOAuthReturn } from "../features/yoro-account/api";

const noServerLocalePreference = async (): Promise<PalworldLocale | undefined> => undefined;
const loadPalworldDeferredPages = () =>
  import("../features/public-palworld/components/PalworldDeferredPages");
const PalworldBreedingPage = lazyNamed(loadPalworldDeferredPages, "PalworldBreedingPage");
const PalworldItemsPage = lazyNamed(loadPalworldDeferredPages, "PalworldItemsPage");
const PalworldMapPage = lazyNamed(
  () => import("../features/public-palworld/components/PalworldMapPage"),
  "PalworldMapPage",
);
const PalworldPalsPage = lazyNamed(loadPalworldDeferredPages, "PalworldPalsPage");
const PalworldSearchResults = lazyNamed(loadPalworldDeferredPages, "PalworldSearchResults");
const PalworldSkillsPage = lazyNamed(loadPalworldDeferredPages, "PalworldSkillsPage");
const PalworldTechnologyPage = lazyNamed(loadPalworldDeferredPages, "PalworldTechnologyPage");
const loadPalworldDetailModals = () =>
  import("../features/public-palworld/components/PalworldDetailModals");
const PalDetailModal = lazyNamed(loadPalworldDetailModals, "PalDetailModal");
const ItemDetailModal = lazyNamed(loadPalworldDetailModals, "ItemDetailModal");
const SkillDetailModal = lazyNamed(loadPalworldDeferredPages, "SkillDetailModal");

const EMPTY_TWITCH_STATUS: PublicTwitchViewerStatus = {
  connected: false,
  configured: false,
  requiredScopes: [],
  missingScopes: [],
};

export function PublicPalworldPage() {
  const { locale, changeLocale } = usePublicLocale(noServerLocalePreference);
  const { theme } = usePublicTheme();
  const { page, params } = usePalworldRoute();
  const knownPage = isKnownPalworldPagePath(window.location.pathname);
  const text = palworldI18n[locale];
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [twitchStatus, setTwitchStatus] = useState<PublicTwitchViewerStatus>(
    () => peekPublicTwitchStatus() ?? EMPTY_TWITCH_STATUS,
  );
  const [followedChannels, setFollowedChannels] = useState<PublicTwitchFollowedLolResponse | null>(
    () => peekPublicTwitchFollowedChannels() ?? null,
  );
  const [twitchStatusLoading, setTwitchStatusLoading] = useState(
    () => peekPublicTwitchStatus() === undefined,
  );
  const [followedLoading, setFollowedLoading] = useState(false);
  const [twitchStatusError, setTwitchStatusError] = useState(false);
  const [followedError, setFollowedError] = useState(false);
  const [twitchOAuthSettling, setTwitchOAuthSettling] = useState(() =>
    isTwitchAccountOAuthReturn(window.location.search)
      || new URLSearchParams(window.location.search).get("viewer_twitch") === "connected"
  );
  const twitchStatusRef = useRef<PublicTwitchViewerStatus>(twitchStatus);
  const statusRequestRef = useRef<Promise<void> | null>(null);
  const statusAbortRef = useRef<AbortController | null>(null);
  const followedRequestRef = useRef<Promise<void> | null>(null);
  const followedAbortRef = useRef<AbortController | null>(null);
  const logoutInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const viewerTwitchConnectedRef = useRef(
    isTwitchAccountOAuthReturn(window.location.search)
      || new URLSearchParams(window.location.search).get("viewer_twitch") === "connected",
  );
  const needsFollowedChannels = page === "home";
  const needsFollowedChannelsOnOAuthReturnRef = useRef(needsFollowedChannels);
  const focusPalId = page === "map" ? palworldFocusPalFromParams(params) : undefined;
  const routeQuery = params.toString();
  const routePathname = window.location.pathname;
  const detailRoute = useMemo(
    () => palworldDetailSelectionFromLocation(routePathname, params),
    [routePathname, routeQuery]
  );
  const selectedPalId = detailRoute.selection?.type === "pal" ? detailRoute.selection.id : undefined;
  const selectedItemId = detailRoute.selection?.type === "item" ? detailRoute.selection.id : undefined;
  const selectedSkillId = detailRoute.selection?.type === "skill" ? detailRoute.selection.id : undefined;
  const selectedCondensationStars = palworldCondensationStarsFromParams(params);
  const selectedSpawnPeriod = palworldSpawnPeriodFromParams(params);
  const pageFrame = page === "home"
    ? "home"
    : page === "map"
    ? "map"
    : page === "technology"
      ? "technology"
      : page === "pals" || page === "items" || page === "skills"
        ? "catalog"
        : "tool";

  setActivePublicLocale(locale);

  useEffect(
    () => applyPalworldSeo(knownPage ? page : "home", locale, routePathname),
    [knownPage, locale, page, routePathname]
  );
  useEffect(() => {
    const selection = detailRoute.selection;
    if (!selection) return;
    trackEntityView({ entityId: selection.id, entityType: selection.type, locale });
  }, [detailRoute.selection, locale]);
  useEffect(() => {
    const canonicalQuery = detailRoute.canonicalParams.toString();
    if (canonicalQuery === routeQuery) return;
    setPalworldUrl(`${window.location.pathname}${canonicalQuery ? `?${canonicalQuery}` : ""}`, true);
  }, [detailRoute, routeQuery]);

  const refreshTwitchStatus = useCallback(async (force = false): Promise<void> => {
    if (logoutInFlightRef.current) return;
    if (statusRequestRef.current) return statusRequestRef.current;
    const controller = new AbortController();
    statusAbortRef.current?.abort();
    statusAbortRef.current = controller;
    setTwitchStatusLoading(true);
    setTwitchStatusError(false);
    const request = (async () => {
      try {
        const status = await getPublicTwitchStatus(controller.signal, { force });
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
    let disposed = false;
    let retryTimer: number | undefined;
    const query = new URLSearchParams(window.location.search);
    const viewerConnected = viewerTwitchConnectedRef.current;
    if (viewerConnected) {
      query.delete("viewer_twitch");
      query.delete("account");
      const nextQuery = query.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`);
    }
    if (viewerConnected) invalidatePublicTwitchClientCache();
    void refreshTwitchStatus(viewerConnected).finally(() => {
      if (viewerConnected && !disposed) {
        retryTimer = window.setTimeout(() => {
          void (async () => {
            await refreshTwitchStatus(true);
            if (
              needsFollowedChannelsOnOAuthReturnRef.current
              && twitchStatusRef.current.connected
            ) {
              await refreshFollowedChannels();
            }
            if (!disposed) setTwitchOAuthSettling(false);
          })();
        }, 350);
      }
    });
    return () => {
      disposed = true;
      mountedRef.current = false;
      statusAbortRef.current?.abort();
      followedAbortRef.current?.abort();
      statusAbortRef.current = null;
      followedAbortRef.current = null;
      statusRequestRef.current = null;
      followedRequestRef.current = null;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [refreshFollowedChannels, refreshTwitchStatus]);

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
    // 이전 Palworld 화면이나 개발 중 교체된 release의 관찰값을 새 화면 세션으로
    // 가져오지 않습니다. 현재 화면 안에서 섞이는 실제 mismatch 감시는 유지됩니다.
    resetPalworldReleaseObservation();
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
    || followedLoading
    || twitchOAuthSettling;
  const twitchError = !twitchOAuthSettling && (twitchStatusError || followedError);
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

  const navigatePage = useCallback((nextPage: PalworldPage) => {
    setPalworldUrl(palworldUrl(nextPage));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const navigatePalworldHref = useCallback((href: string) => {
    setPalworldUrl(href);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // 상세는 고유 경로로 이동합니다. query 형태로 열면 canonical이 목록 URL 하나로 접혀
  // 색인되지 않고 공유·북마크도 목록으로 되돌아갑니다.
  const openPalPage = useCallback((id: string) => {
    trackInternalLinkClick({ fromType: "palworld_list", toType: "pal", toPath: palworldDetailPath("pal", id) });
    setPalworldUrl(palworldDetailPath("pal", id));
  }, []);

  const openItemPage = useCallback((id: string) => {
    trackInternalLinkClick({ fromType: "palworld_list", toType: "item", toPath: palworldDetailPath("item", id) });
    setPalworldUrl(palworldDetailPath("item", id));
  }, []);

  const openPalMap = useCallback((id: string) => {
    setPalworldUrl(palworldUrl("map", new URLSearchParams({ focusPal: id })));
  }, []);

  /**
   * 목록 page에서는 색인 가능한 고유 경로로 이동하고 필터는 유지합니다.
   * 교배·지도·검색 같은 도구 page에서는 작업 중인 화면을 잃지 않도록 경로를 그대로 두고
   * query modal로 엽니다.
   */
  const openDetailHere = useCallback((type: "pal" | "item", id: string) => {
    trackInternalLinkClick({
      fromType: palworldPageFromPath(window.location.pathname),
      toType: type,
      toPath: palworldDetailPath(type, id),
    });
    if (isPalworldEntityListPath(window.location.pathname, type)) {
      setPalworldUrl(palworldDetailPathWithListQuery(type, id));
      return;
    }
    const current = `${window.location.pathname}${window.location.search}`;
    const cleared = ["stars", "spawnPeriod", "pal", "item", "skill"].reduce(
      (url, key) => withQueryParam(url, key),
      current,
    );
    setPalworldUrl(withQueryParam(cleared, type, id));
  }, []);

  const openPalHere = useCallback((id: string) => openDetailHere("pal", id), [openDetailHere]);
  const openItemHere = useCallback((id: string) => openDetailHere("item", id), [openDetailHere]);

  const closeDetail = useCallback(() => {
    const selection = detailRoute.selection;
    if (!selection) return;
    // 경로형 상세에서는 목록으로 돌아가되 필터 query는 유지합니다.
    if (palworldDetailFromPath(window.location.pathname)) {
      const listPath = palworldPathForPage(palworldPageFromPath(window.location.pathname));
      const params = new URLSearchParams(window.location.search);
      for (const key of ["stars", "spawnPeriod"]) params.delete(key);
      const query = params.toString();
      setPalworldUrl(`${listPath}${query ? `?${query}` : ""}`, true);
      return;
    }
    const current = `${window.location.pathname}${window.location.search}`;
    const withoutSelection = withQueryParam(current, selection.type);
    const withoutPalState = selection.type === "pal"
      ? withQueryParam(withQueryParam(withoutSelection, "stars"), "spawnPeriod")
      : withoutSelection;
    setPalworldUrl(withoutPalState, true);
  }, [detailRoute.selection]);

  const updatePalDetailPreference = useCallback((
    key: "stars" | "spawnPeriod",
    value?: string,
  ) => {
    if (!selectedPalId) return;
    const current = `${window.location.pathname}${window.location.search}`;
    setPalworldUrl(withQueryParam(current, key, value));
  }, [selectedPalId]);

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
      sidebarMode="drawer"
      skipLinkLabel={text.skipToContent}
      variant="public"
    >
      <AppShellHeader as="div" className="palworld-shell-header">
        <PalworldHeader
          locale={locale}
          onLocale={handleLocale}
          onTwitchLogin={startTwitchLogin}
          onTwitchLogout={() => void disconnectTwitch()}
          page={page}
          searchContent={headerSearch}
          twitchStatus={twitchStatus}
        />
      </AppShellHeader>
      <AppShellMain className="palworld-main" data-page-frame={pageFrame} id="palworld-main">
        {!knownPage ? <PalworldNotFoundPage locale={locale} /> : null}
        {knownPage ? <Suspense fallback={(
          <SkeletonCard
            className="palworld-page-section"
            data-ko={palworldI18n.ko.loading}
            data-ja={palworldI18n.ja.loading}
            loadingLabel={text.loading}
            size="lg"
          />
        )}>
        {page === "home" ? (
          <PalworldHome
            liveError={twitchError}
            liveLoading={twitchLoading}
            liveStreamers={liveStreamers}
            locale={locale}
            onLiveRetry={() => void retryTwitch()}
            onNavigate={navigatePalworldHref}
            onOpenItem={openItemPage}
            onOpenPal={openPalPage}
            onSearch={navigateSearch}
            onTwitchLogin={startTwitchLogin}
            twitchConfigured={twitchStatus.configured}
            twitchConnected={twitchStatus.connected}
          />
        ) : null}
        {page === "search" ? <PalworldSearchResults locale={locale} query={params.get("q") ?? ""} onOpenPal={openPalHere} onOpenItem={openItemHere} /> : null}
        {page === "pals" ? (<>
          <PalworldPageGuide locale={locale} page="pals" section="lead" />
          <PalworldPalsPage locale={locale} params={params} onOpenPal={openPalHere} />
          <PalworldPageGuide locale={locale} page="pals" section="deep" />
        </>) : null}
        {page === "breeding" ? <PalworldBreedingPage locale={locale} onOpenPal={openPalHere} params={params} /> : null}
        {page === "items" ? (<>
          <PalworldPageGuide locale={locale} page="items" section="lead" />
          <PalworldItemsPage locale={locale} params={params} onOpenItem={openItemHere} />
          <PalworldPageGuide locale={locale} page="items" section="deep" />
        </>) : null}
        {page === "technology" ? (<>
          <PalworldPageGuide locale={locale} page="technology" section="lead" />
          <PalworldTechnologyPage locale={locale} params={params} onOpenItem={openItemHere} />
          <PalworldPageGuide locale={locale} page="technology" section="deep" />
        </>) : null}
        {page === "skills" ? (<>
          <PalworldPageGuide locale={locale} page="skills" section="lead" />
          <PalworldSkillsPage locale={locale} params={params} />
          <PalworldPageGuide locale={locale} page="skills" section="deep" />
        </>) : null}
        {page === "map" ? <PalworldMapPage focusPalId={focusPalId} locale={locale} onOpenPal={openPalHere} /> : null}
        </Suspense> : null}
      </AppShellMain>
      {/* 하단 탭바는 헤더가 아니라 AppShell 직계 자식으로 둡니다 — 헤더에
          backdrop-filter류가 걸리면 position:fixed 기준이 헤더로 바뀌어 탭바가
          화면 하단에서 떨어집니다(LoL 전적검색 헤더에서 실제 발생했던 사고). */}
      <PalworldBottomTabBar locale={locale} page={page} />
      <PalworldSourceFooter locale={locale} />
      {selectedPalId ? (
        <Suspense fallback={(
          <SkeletonCard
            data-ko={palworldI18n.ko.loading}
            data-ja={palworldI18n.ja.loading}
            loadingLabel={text.loading}
          />
        )}>
          <PalDetailModal
            condensationStars={selectedCondensationStars}
            palId={selectedPalId}
            locale={locale}
            onClose={closeDetail}
            onCondensationStarsChange={(stars) =>
              updatePalDetailPreference("stars", stars === 0 ? undefined : String(stars))
            }
            onOpenItem={openItemPage}
            onOpenMap={openPalMap}
            onSpawnPeriodChange={(period) =>
              updatePalDetailPreference(
                "spawnPeriod",
                period === "all" ? undefined : period,
              )
            }
            spawnPeriod={selectedSpawnPeriod}
          />
        </Suspense>
      ) : null}
      {selectedItemId ? (
        <Suspense fallback={(
          <SkeletonCard
            data-ko={palworldI18n.ko.loading}
            data-ja={palworldI18n.ja.loading}
            loadingLabel={text.loading}
          />
        )}>
          <ItemDetailModal itemId={selectedItemId} locale={locale} onClose={closeDetail} onOpenPal={openPalPage} onOpenItem={openItemPage} />
        </Suspense>
      ) : null}
      {selectedSkillId ? (
        <Suspense fallback={(
          <SkeletonCard
            data-ko={palworldI18n.ko.loading}
            data-ja={palworldI18n.ja.loading}
            loadingLabel={text.loading}
          />
        )}>
          <SkillDetailModal
            locale={locale}
            onClose={closeDetail}
            onOpenPal={openPalPage}
            skillId={selectedSkillId}
          />
        </Suspense>
      ) : null}
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
      <span className="palworld-sr-version" aria-live="polite">
        {versionMismatch ? text.versionMismatch : ""}
      </span>
    </AppShell>
  );
}
