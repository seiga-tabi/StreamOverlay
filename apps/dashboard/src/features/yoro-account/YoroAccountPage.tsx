import { useEffect, useMemo, useState } from "react";
import { DiscordSymbolIcon } from "../../shared/DiscordSymbolIcon";
import { detectDashboardLocale, type DashboardLocale } from "../../i18n";
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
    description: "Discord와 Twitch는 로그인 수단이며 권한은 YORO Organization에서 관리됩니다.",
    connected: "연결됨",
    notConnected: "연결되지 않음",
    discord: "Discord",
    twitch: "Twitch",
    connect: "계정 연결",
    unlink: "연결 해제",
    logout: "로그아웃",
    dashboard: "Bot Dashboard",
    loginRequired: "YORO.gg 로그인이 필요합니다.",
    login: "로그인",
    loading: "계정 정보를 불러오는 중입니다.",
    failed: "계정 정보를 불러오지 못했습니다.",
    lastIdentity: "마지막 로그인 수단은 해제할 수 없습니다.",
    relogin: "계정 연결 상태가 변경되어 다시 로그인해야 합니다.",
    language: "日本語"
  },
  ja: {
    eyebrow: "YORO ACCOUNT",
    title: "連携アカウント",
    description: "Discord と Twitch はログイン手段として使用し、権限は YORO Organization で管理します。",
    connected: "連携済み",
    notConnected: "未連携",
    discord: "Discord",
    twitch: "Twitch",
    connect: "アカウントを連携",
    unlink: "連携解除",
    logout: "ログアウト",
    dashboard: "Bot Dashboard",
    loginRequired: "YORO.gg へのログインが必要です。",
    login: "ログイン",
    loading: "アカウント情報を読み込んでいます。",
    failed: "アカウント情報を読み込めませんでした。",
    lastIdentity: "最後のログイン手段は解除できません。",
    relogin: "連携状態が変更されたため、再ログインが必要です。",
    language: "한국어"
  }
} as const;

export function YoroAccountPage({ embedded = false }: { embedded?: boolean }) {
  const [locale, setLocale] = useState<DashboardLocale>(() => detectDashboardLocale());
  const [session, setSession] = useState<YoroAccountSession>();
  const [error, setError] = useState("");
  const [busyProvider, setBusyProvider] = useState<YoroIdentityProvider>();
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
        {error ? <p className="yoro-account-error" role="alert">{error}</p> : null}
        {session && !session.authenticated ? (
          <div className="yoro-account-empty">
            <p>{copy.loginRequired}</p>
            <a className="yoro-account-primary-action" href="/login?return_to=/account/connections">
              {copy.login}
            </a>
          </div>
        ) : null}
        {session?.authenticated ? (
          <>
            <div className="yoro-connections">
              {(["discord", "twitch"] as const).map((provider) => {
                const identity = identities.get(provider);
                return (
                  <article className="yoro-connection-card" key={provider}>
                    <span className={`yoro-login-option__icon is-${provider}`}>
                      {provider === "discord" ? <DiscordSymbolIcon /> : "T"}
                    </span>
                    <div>
                      <h2>{copy[provider]}</h2>
                      <strong>{identity ? copy.connected : copy.notConnected}</strong>
                      {identity ? <p>{identity.displayName}</p> : null}
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
                      <a href={accountOAuthUrl(provider, "link_identity", "/account/connections")}>
                        {copy.connect}
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
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
