import { runtimeConfig } from "../../runtime-config";

export type YoroAuthenticationProvider = "discord" | "twitch";
export type YoroIdentityProvider = YoroAuthenticationProvider | "riot";

export const YORO_DASHBOARD_PATH = "/dashboard";
export const YORO_STREAMER_ADMIN_PATH = "/admin/riot-id-requests";
export const TWITCH_ACCOUNT_CONNECTED_RESULT = "twitch_connected";

export type YoroAccountIdentity = {
  provider: YoroIdentityProvider;
  displayName: string;
  avatarUrl?: string;
  connectedAt: string;
  lastAuthenticatedAt: string;
  valorantRecordConsent?: boolean;
};

export type YoroDashboardPage =
  | "overview"
  | "account"
  | "organizations"
  | "settings";

export type YoroUserPreferences = {
  locale: "ko" | "ja";
  defaultDashboardPage: YoroDashboardPage;
  reducedMotion: boolean;
};

export type YoroAccountSession =
  | { authenticated: false }
  | {
      authenticated: true;
      csrfToken: string;
      authenticationProvider: YoroAuthenticationProvider;
      identities: YoroAccountIdentity[];
      preferences: YoroUserPreferences;
      connectionCapabilities: {
        riotRsoAvailable: boolean;
        riotRsoRequiresTwitchAuthentication: boolean;
      };
      /* 관리자 콘솔(admin_accounts)에 활성 등록된 Twitch identity를 가진 계정이면
         true. 상단바 프로필 메뉴의 "스트리머 관리" 항목 노출 여부에만 쓰입니다. */
      isStreamerAdmin?: boolean;
    };

function accountApiBase(): string {
  const configuredBase = typeof window === "undefined" ? undefined : runtimeConfig().apiBase;
  return configuredBase ?? import.meta.env?.VITE_API_BASE ?? "http://localhost:3000";
}

export function openYoroDashboard(): void {
  window.location.assign(YORO_DASHBOARD_PATH);
}

export function openYoroStreamerAdmin(): void {
  window.location.assign(YORO_STREAMER_ADMIN_PATH);
}

export function accountOAuthUrl(
  provider: YoroIdentityProvider,
  purpose: "login" | "link_identity",
  returnTo: string
): string {
  const query = new URLSearchParams({ purpose, return_to: returnTo });
  return `${accountApiBase()}/api/account/oauth/${provider}/start?${query.toString()}`;
}

export function isTwitchAccountOAuthReturn(search: string): boolean {
  return new URLSearchParams(search).get("account") === TWITCH_ACCOUNT_CONNECTED_RESULT;
}

export async function getAccountSession(signal?: AbortSignal): Promise<YoroAccountSession> {
  const response = await fetch(`${accountApiBase()}/api/account/session`, {
    credentials: "include",
    signal
  });
  if (!response.ok) throw new Error(`account_session_${response.status}`);
  return await response.json() as YoroAccountSession;
}

export async function logoutAccount(csrfToken: string): Promise<void> {
  const response = await fetch(`${accountApiBase()}/api/account/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Yoro-CSRF": csrfToken }
  });
  if (!response.ok) throw new Error(`account_logout_${response.status}`);
}

export async function updateAccountPreferences(
  preferences: YoroUserPreferences,
  csrfToken: string
): Promise<YoroUserPreferences> {
  const response = await fetch(`${accountApiBase()}/api/account/preferences`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Yoro-CSRF": csrfToken
    },
    body: JSON.stringify(preferences)
  });
  if (!response.ok) throw new Error(`account_preferences_${response.status}`);
  const body = await response.json() as { preferences: YoroUserPreferences };
  return body.preferences;
}

export async function unlinkAccountIdentity(
  provider: YoroIdentityProvider,
  csrfToken: string
): Promise<void> {
  const response = await fetch(`${accountApiBase()}/api/account/connections/${provider}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "X-Yoro-CSRF": csrfToken }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { code?: unknown } | undefined;
    throw new Error(
      typeof body?.code === "string" ? body.code : `account_unlink_${response.status}`
    );
  }
}

export async function updateValorantRecordConsent(
  enabled: boolean,
  csrfToken: string
): Promise<boolean> {
  const response = await fetch(`${accountApiBase()}/api/account/riot/valorant-record-consent`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Yoro-CSRF": csrfToken
    },
    body: JSON.stringify({ enabled })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { code?: unknown } | undefined;
    throw new Error(
      typeof body?.code === "string" ? body.code : `valorant_consent_${response.status}`
    );
  }
  const body = await response.json() as { valorantRecordConsent: boolean };
  return body.valorantRecordConsent;
}
