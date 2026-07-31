export const GOOGLE_ANALYTICS_MEASUREMENT_ID = "G-SEG94KMT1H";

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
  "/login",
  "/overlay"
] as const;

type GoogleTagWindow = Window & {
  __yoroGoogleConsentInitialized?: boolean;
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

let initialized = false;
let googleTagConfigured = false;
let lastPageKey = "";
let scheduledPageView: number | undefined;

export function isGoogleAnalyticsPublicPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/u, "") || "/";
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
  document.head.append(script);
}

function trackPageView(): void {
  if (!isGoogleAnalyticsPublicPath(window.location.pathname)) return;
  loadGoogleTag();
  const pageLocation = googleAnalyticsPageLocation(window.location);
  const pageKey = `${pageLocation}\n${document.title}`;
  if (pageKey === lastPageKey) return;
  lastPageKey = pageKey;
  gtag("event", "page_view", {
    page_location: pageLocation,
    page_path: window.location.pathname,
    page_title: document.title,
    send_to: GOOGLE_ANALYTICS_MEASUREMENT_ID
  });
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

export function initializeGoogleAnalytics(): void {
  if (initialized || analyticsCollectionDisabledByBrowser()) return;
  initialized = true;
  trackPageView();
  for (const eventName of ROUTE_EVENTS) {
    window.addEventListener(eventName, schedulePageView);
  }
}
