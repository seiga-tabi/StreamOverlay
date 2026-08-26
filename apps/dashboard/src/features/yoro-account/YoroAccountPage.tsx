import { useEffect, useMemo, useState } from "react";
import { DiscordSymbolIcon } from "../../shared/DiscordSymbolIcon";
import { AuthRequiredState } from "../../shared/ui/AuthRequiredState";
import { detectDashboardLocale, type DashboardLocale } from "../../i18n";
import { LolChrome } from "../public-home/components/LolChrome";
import {
  accountOAuthUrl,
  getAccountSession,
  logoutAccount,
  unlinkAccountIdentity,
  type YoroAccountSession,
  type YoroIdentityProvider
} from "./api";

const text = {
  ko: {
    eyebrow: "YORO ACCOUNT",
    title: "연결된 계정",
    description: "Discord와 Twitch는 로그인 수단이며, Riot은 본인 게임 계정 확인과 데이터 공개 동의를 위한 연결 계정입니다.",
    connected: "연결됨",
    notConnected: "연결되지 않음",
    discord: "Discord",
    twitch: "Twitch",
    riot: "Riot Games",
    connect: "계정 연결",
    unlink: "연결 해제",
    logout: "로그아웃",
    dashboard: "Bot Dashboard",
    loginRequired: "YORO.gg 로그인이 필요합니다.",
    loginDescription: "Discord 또는 Twitch 계정으로 로그인하면 연결된 계정을 확인하고 관리할 수 있습니다.",
    login: "로그인",
    loading: "계정 정보를 불러오는 중입니다.",
    failed: "계정 정보를 불러오지 못했습니다.",
    lastIdentity: "마지막 로그인 수단은 해제할 수 없습니다.",
    relogin: "계정 연결 상태가 변경되어 다시 로그인해야 합니다.",
    riotTwitchRequired: "Riot 계정 연결 전 Twitch로 다시 인증해주세요.",
    riotReconnectTwitch: "Twitch로 다시 인증",
    riotConsent: "연결하면 Riot PUUID와 Riot ID를 저장해 본인 계정과 데이터 공개 동의를 확인합니다.",
    privacy: "개인정보 처리방침",
    terms: "서비스 약관",
    unavailable: "현재 연결을 사용할 수 없음",
    riotConnected: "Riot 계정 연결을 완료했습니다.",
    oauthFailed: "계정 연결을 완료하지 못했습니다. 다시 시도해주세요.",
    riotLoggedOut: "Riot 로그아웃 후 YORO.gg로 돌아왔습니다.",
    language: "日本語"
  },
  ja: {
    eyebrow: "YORO ACCOUNT",
    title: "連携アカウント",
    description: "Discord と Twitch はログイン手段として使用し、Riot は本人のゲームアカウント確認とデータ公開同意のために連携します。",
    connected: "連携済み",
    notConnected: "未連携",
    discord: "Discord",
    twitch: "Twitch",
    riot: "Riot Games",
    connect: "アカウントを連携",
    unlink: "連携解除",
    logout: "ログアウト",
    dashboard: "Bot Dashboard",
    loginRequired: "YORO.gg へのログインが必要です。",
    loginDescription: "Discord または Twitch アカウントでログインすると、連携アカウントを確認・管理できます。",
    login: "ログイン",
    loading: "アカウント情報を読み込んでいます。",
    failed: "アカウント情報を読み込めませんでした。",
    lastIdentity: "最後のログイン手段は解除できません。",
    relogin: "連携状態が変更されたため、再ログインが必要です。",
    riotTwitchRequired: "Riotアカウントを連携する前にTwitchで再認証してください。",
    riotReconnectTwitch: "Twitchで再認証",
    riotConsent: "連携するとRiot PUUIDとRiot IDを保存し、本人アカウントとデータ公開への同意を確認します。",
    privacy: "プライバシーポリシー",
    terms: "利用規約",
    unavailable: "現在連携を利用できません",
    riotConnected: "Riotアカウントの連携が完了しました。",
    oauthFailed: "アカウント連携を完了できませんでした。もう一度お試しください。",
    riotLoggedOut: "RiotからログアウトしてYORO.ggに戻りました。",
    language: "한국어"
  }
} as const;

export function YoroAccountPage({ embedded = false }: { embedded?: boolean }) {
  const [locale, setLocale] = useState<DashboardLocale>(() => detectDashboardLocale());
  const [session, setSession] = useState<YoroAccountSession>();
  const [error, setError] = useState("");
  const [busyProvider, setBusyProvider] = useState<YoroIdentityProvider>();
  const [authTheme, setAuthTheme] = useState<"dark" | "light">("dark");
  const copy = text[locale];
  const Root = embedded ? "div" : "main";

  useEffect(() => {
    const controller = new AbortController();
    void getAccountSession(controller.signal)
      .then(setSession)
      .catch(() => setError(copy.failed));
    return () => controller.abort();
  }, [copy.failed]);

  const identities = useMemo(
    () => session?.authenticated
      ? new Map(session.identities.map((identity) => [identity.provider, identity]))
      : new Map(),
    [session]
  );
  const providers = useMemo<readonly YoroIdentityProvider[]>(() => (
    session?.authenticated && session.connectionCapabilities.riotRsoAvailable
      ? ["discord", "twitch", "riot"]
      : ["discord", "twitch"]
  ), [session]);
  const accountResult = typeof window === "undefined"
    ? undefined
    : new URLSearchParams(window.location.search).get("account");
  const resultMessage = accountResult === "riot_connected"
    ? copy.riotConnected
    : accountResult === "oauth_failed"
      ? copy.oauthFailed
      : accountResult === "riot_logged_out"
        ? copy.riotLoggedOut
        : undefined;

  async function unlink(provider: YoroIdentityProvider): Promise<void> {
    if (!session?.authenticated || busyProvider) return;
    setBusyProvider(provider);
    setError("");
    try {
      await unlinkAccountIdentity(provider, session.csrfToken);
      window.location.assign("/login?account=identity_changed");
    } catch (unlinkError) {
      setError(
        unlinkError instanceof Error && unlinkError.message === "last_identity_required"
          ? copy.lastIdentity
          : copy.failed
      );
    } finally {
      setBusyProvider(undefined);
    }
  }

  if (session && !session.authenticated) {
    const loginHref = "/login?return_to=/account/connections";
    const authRequiredState = (
      <AuthRequiredState
        description={{ ko: text.ko.loginDescription, ja: text.ja.loginDescription }}
        locale={locale}
        loginHref={loginHref}
        loginLabel={{ ko: text.ko.login, ja: text.ja.login }}
        title={{ ko: text.ko.loginRequired, ja: text.ja.loginRequired }}
      />
    );

    if (embedded) return authRequiredState;

    return (
      <div className={`yoro-home-shell yoro-lol-home theme-${authTheme}`}>
        <LolChrome
          active="none"
          connected={false}
          locale={locale}
          onLocale={(nextLocale) => setLocale(nextLocale === "ja" ? "ja" : "ko")}
          onLoginOpen={() => window.location.assign(loginHref)}
          onLogout={() => undefined}
          onToggleTheme={() => setAuthTheme((current) => current === "dark" ? "light" : "dark")}
        />
        {authRequiredState}
      </div>
    );
  }

  return (
    <Root className={`yoro-account-page ${embedded ? "is-embedded" : ""}`}>
      {!embedded ? (
        <a className="yoro-account-brand" href="/bot" aria-label="YORO.gg">YORO.gg</a>
      ) : null}
      <section className="yoro-account-panel">
        <div className="yoro-account-panel__header">
          <span>{copy.eyebrow}</span>
          <h1 data-ko={text.ko.title} data-ja={text.ja.title}>{copy.title}</h1>
          <p data-ko={text.ko.description} data-ja={text.ja.description}>{copy.description}</p>
        </div>
        {!session && !error ? <p role="status">{copy.loading}</p> : null}
        {resultMessage ? (
          <p
            className={accountResult === "oauth_failed" ? "yoro-account-error" : "yoro-account-success"}
            role={accountResult === "oauth_failed" ? "alert" : "status"}
          >
            {resultMessage}
          </p>
        ) : null}
        {error ? <p className="yoro-account-error" role="alert">{error}</p> : null}
        {session?.authenticated ? (
          <>
            <div className="yoro-connections">
              {providers.map((provider) => {
                const identity = identities.get(provider);
                const riotNeedsTwitch = provider === "riot"
                  && session.connectionCapabilities.riotRsoRequiresTwitchAuthentication;
                const returnPath = embedded ? "/dashboard/account" : "/account/connections";
                const connectionUrl = riotNeedsTwitch
                  ? accountOAuthUrl(
                      "twitch",
                      identities.has("twitch") ? "login" : "link_identity",
                      returnPath
                    )
                  : accountOAuthUrl(provider, "link_identity", returnPath);
                return (
                  <article className="yoro-connection-card" key={provider}>
                    <span className={`yoro-login-option__icon is-${provider}`}>
                      {provider === "discord" ? <DiscordSymbolIcon /> : provider === "twitch" ? "T" : "R"}
                    </span>
                    <div>
                      <h2>{copy[provider]}</h2>
                      <strong>{identity ? copy.connected : copy.notConnected}</strong>
                      {identity ? <p>{identity.displayName}</p> : null}
                      {provider === "riot" && !identity ? (
                        <p>{riotNeedsTwitch ? copy.riotTwitchRequired : copy.riotConsent}</p>
                      ) : null}
                    </div>
                    {identity ? (
                      <button
                        disabled={Boolean(busyProvider)}
                        type="button"
                        onClick={() => void unlink(provider)}
                      >
                        {copy.unlink}
                      </button>
                    ) : (
                      <a href={connectionUrl}>
                        {riotNeedsTwitch ? copy.riotReconnectTwitch : copy.connect}
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
            {session.connectionCapabilities.riotRsoAvailable ? (
              <p className="yoro-account-consent-note">
                {copy.riotConsent}{" "}
                <a href="/privacy">{copy.privacy}</a>{" · "}
                <a href="/terms">{copy.terms}</a>
              </p>
            ) : null}
            <div className="yoro-account-actions">
              <a href="/dashboard/organizations">{copy.dashboard}</a>
              <button
                type="button"
                onClick={() => void logoutAccount(session.csrfToken).then(() => {
                  window.location.assign("/login");
                })}
              >
                {copy.logout}
              </button>
            </div>
          </>
        ) : null}
        <button
          className="yoro-account-language"
          type="button"
          onClick={() => setLocale(locale === "ko" ? "ja" : "ko")}
        >
          {copy.language}
        </button>
      </section>
    </Root>
  );
}
