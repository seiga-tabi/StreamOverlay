export const GOOGLE_ANALYTICS_MEASUREMENT_ID = "G-SEG94KMT1H";
export const GOOGLE_CONSENT_STORAGE_KEY = "yoro.google.consent.v1";
export const LEGACY_AD_CONSENT_STORAGE_KEY = "yoro.ads.consent";
export const GOOGLE_CONSENT_CHANGE_EVENT = "yoro:google-consent";

const GOOGLE_TAG_SCRIPT_ID = "yoro-google-analytics";
const ROUTE_EVENTS = [
  "popstate",
  "publicroutechange",
  "palworldroutechange"
] as const;
const PRIVATE_PATH_PREFIXES = [
  "/account",
  "/admin",
  "/dashboard",
  "/login"
] as const;

type GoogleTagWindow = Window & {
  __yoroGoogleConsentInitialized?: boolean;
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

export type GoogleConsentChoice = "granted" | "denied";

export type GoogleConsentState = {
  ad_storage: GoogleConsentChoice;
  ad_user_data: GoogleConsentChoice;
  ad_personalization: GoogleConsentChoice;
  analytics_storage: GoogleConsentChoice;
};

export type YoroAnalyticsEventName =
  | "bot_dashboard"
  | "discord_click"
  | "lol_search"
  | "pal_search"
  | "participation_join"
  | "search"
  | "streamer_follow"
  | "twitch_click"
  | "outbound_click";

type AnalyticsEventParameters = Record<string, string | number | boolean | undefined>;

let initialized = false;
let googleTagConfigured = false;
let lastPageKey = "";
let scheduledPageView: number | undefined;
let debugMode = false;

function normalizedPublicPath(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(?:ko|ja)(?=\/|$)/u, "") || "/";
  return withoutLocale.replace(/\/+$/u, "") || "/";
}

export function isGoogleAnalyticsPublicPath(pathname: string): boolean {
  const normalized = normalizedPublicPath(pathname);
  return !PRIVATE_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function googleAnalyticsPageLocation(
  location: Pick<Location, "origin" | "pathname">
): string {
  return `${location.origin}${location.pathname}`;
}

function googleTagWindow(): GoogleTagWindow {
  return window as GoogleTagWindow;
}

function gtag(..._args: unknown[]): void {
  const target = googleTagWindow();
  target.dataLayer ??= [];
  target.dataLayer.push(arguments);
}

export function googleConsentState(choice: GoogleConsentChoice): GoogleConsentState {
  return {
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
    analytics_storage: choice
  };
}

export function readGoogleConsentChoice(): GoogleConsentChoice | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = window.localStorage.getItem(GOOGLE_CONSENT_STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function setGoogleConsentChoice(choice: GoogleConsentChoice): void {
  try {
    window.localStorage.setItem(GOOGLE_CONSENT_STORAGE_KEY, choice);
    window.localStorage.setItem(LEGACY_AD_CONSENT_STORAGE_KEY, choice);
  } catch {
    console.error("[Analytics] Google 동의 선택을 브라우저에 저장하지 못했습니다.");
  }
  configureGoogleTag();
  gtag("consent", "update", googleConsentState(choice));
  window.dispatchEvent(new CustomEvent(GOOGLE_CONSENT_CHANGE_EVENT, {
    detail: { choice }
  }));
  if (choice === "granted" && initialized) {
    lastPageKey = "";
    schedulePageView();
  }
}

function configureGoogleTag(): void {
  if (googleTagConfigured) return;
  const target = googleTagWindow();
  target.dataLayer ??= [];
  target.gtag = gtag;
  if (target.__yoroGoogleConsentInitialized !== true) {
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500
    });
    target.__yoroGoogleConsentInitialized = true;
  }
  gtag("set", "ads_data_redaction", true);
  gtag("js", new Date());
  gtag("config", GOOGLE_ANALYTICS_MEASUREMENT_ID, {
    anonymize_ip: true,
    debug_mode: debugMode,
    send_page_view: false
  });
  googleTagConfigured = true;
}

function loadGoogleTag(): void {
  configureGoogleTag();
  if (document.getElementById(GOOGLE_TAG_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = GOOGLE_TAG_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    GOOGLE_ANALYTICS_MEASUREMENT_ID
  )}`;
  script.referrerPolicy = "strict-origin-when-cross-origin";
  script.addEventListener("error", () => {
    console.error("[Analytics] Google tag 스크립트를 불러오지 못했습니다.");
  }, { once: true });
  document.head.append(script);
}

function safeEventParameters(parameters: AnalyticsEventParameters): AnalyticsEventParameters {
  return Object.fromEntries(
    Object.entries(parameters)
      .filter(([, value]) => value !== undefined)
      .slice(0, 20)
      .map(([key, value]) => [key.slice(0, 40), typeof value === "string" ? value.slice(0, 100) : value])
  );
}

export function trackGoogleAnalyticsEvent(
  eventName: YoroAnalyticsEventName,
  parameters: AnalyticsEventParameters = {}
): void {
  if (!initialized || !isGoogleAnalyticsPublicPath(window.location.pathname)) return;
  loadGoogleTag();
  gtag("event", eventName, {
    ...safeEventParameters(parameters),
    debug_mode: debugMode,
    send_to: GOOGLE_ANALYTICS_MEASUREMENT_ID
  });
}

function trackPageView(): void {
  if (!isGoogleAnalyticsPublicPath(window.location.pathname)) return;
  loadGoogleTag();
  const pageLocation = googleAnalyticsPageLocation(window.location);
  const pageKey = `${pageLocation}\n${document.title}`;
  if (pageKey === lastPageKey) return;
  lastPageKey = pageKey;
  gtag("event", "page_view", {
    debug_mode: debugMode,
    page_location: pageLocation,
    page_path: window.location.pathname,
    page_title: document.title,
    send_to: GOOGLE_ANALYTICS_MEASUREMENT_ID
  });
}

function trackSearchSubmission(event: SubmitEvent): void {
  if (!(event.target instanceof HTMLFormElement)) return;
  if (event.target.matches(".public-search-form")) {
    trackGoogleAnalyticsEvent("search", { search_term: "lol_profile" });
    trackGoogleAnalyticsEvent("lol_search", { search_surface: "profile" });
    return;
  }
  if (event.target.matches(".palworld-search-form")) {
    trackGoogleAnalyticsEvent("search", { search_term: "palworld_database" });
    trackGoogleAnalyticsEvent("pal_search", {
      search_surface: event.target.dataset.testid ?? "public"
    });
  }
}

export function analyticsEventsForLink(
  href: string,
  currentOrigin: string,
  currentPathname = "/"
): YoroAnalyticsEventName[] {
  let target: URL;
  try {
    target = new URL(href, currentOrigin);
  } catch {
    return [];
  }
  const events: YoroAnalyticsEventName[] = [];
  if (target.origin !== currentOrigin) events.push("outbound_click");
  if (target.hostname === "discord.gg" || target.hostname === "discord.com") events.push("discord_click");
  if (target.hostname === "twitch.tv" || target.hostname.endsWith(".twitch.tv")) events.push("twitch_click");
  if (
    target.origin === currentOrigin
    && normalizedPublicPath(currentPathname).startsWith("/bot")
    && target.pathname.startsWith("/dashboard")
  ) {
    events.push("bot_dashboard");
  }
  return events;
}

function trackLinkClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(target instanceof HTMLAnchorElement)) return;
  for (const eventName of analyticsEventsForLink(
    target.href,
    window.location.origin,
    window.location.pathname
  )) {
    trackGoogleAnalyticsEvent(eventName, {
      link_domain: target.hostname,
      link_path: target.pathname.slice(0, 100)
    });
  }
}

function schedulePageView(): void {
  if (scheduledPageView !== undefined) {
    window.clearTimeout(scheduledPageView);
  }
  scheduledPageView = window.setTimeout(() => {
    scheduledPageView = undefined;
    trackPageView();
  }, 0);
}

function analyticsCollectionDisabledByBrowser(): boolean {
  const privacyNavigator = navigator as Navigator & {
    globalPrivacyControl?: boolean;
  };
  return navigator.doNotTrack === "1"
    || privacyNavigator.globalPrivacyControl === true;
}

export function initializeGoogleAnalytics(options: { debugMode?: boolean } = {}): void {
  if (initialized || analyticsCollectionDisabledByBrowser()) return;
  debugMode = options.debugMode === true;
  initialized = true;
  trackPageView();
  for (const eventName of ROUTE_EVENTS) {
    window.addEventListener(eventName, schedulePageView);
  }
  document.addEventListener("click", trackLinkClick, true);
  document.addEventListener("submit", trackSearchSubmission, true);
}
