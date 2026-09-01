import { useState, type FormEvent } from "react";
import { publicTwitchLoginUrl } from "../features/public-twitch/api";
import { dashboardI18n, type DashboardLocale } from "../i18n";

export function LoginPage({
  checking,
  disabled,
  error,
  onLogin,
  onBackToPublic,
  locale
}: {
  checking: boolean;
  disabled?: boolean;
  error: string;
  onLogin: (token: string) => Promise<void>;
  onBackToPublic?: () => void;
  locale: DashboardLocale;
}) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const t = dashboardI18n[locale].authPage;
  const twitchConnected = new URLSearchParams(window.location.search).get("viewer_twitch") === "connected";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onLogin(token.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-block auth-brand">
          <img className="brand-logo" src="/images/yorogg-logo.webp" alt="YORO.gg" />
        </div>
        <span className="eyebrow" data-ko={dashboardI18n.ko.authPage.eyebrow} data-ja={dashboardI18n.ja.authPage.eyebrow}>{t.eyebrow}</span>
        <h1 data-ko={dashboardI18n.ko.authPage.title} data-ja={dashboardI18n.ja.authPage.title}>{t.title}</h1>
        <p className="muted" data-ko={dashboardI18n.ko.authPage.description} data-ja={dashboardI18n.ja.authPage.description}>{t.description}</p>
        <div className="auth-form">
          <button
            disabled={checking}
            type="button"
            onClick={() => {
              window.location.href = publicTwitchLoginUrl("/admin");
            }}
            data-ko={dashboardI18n.ko.authPage.loginWithTwitch}
            data-ja={dashboardI18n.ja.authPage.loginWithTwitch}
          >
            {t.loginWithTwitch}
          </button>
          {twitchConnected && !checking && !error ? (
            <p className="error-text" data-ko={dashboardI18n.ko.authPage.twitchAdminRequired} data-ja={dashboardI18n.ja.authPage.twitchAdminRequired}>
              {t.twitchAdminRequired}
            </p>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
          <button
            className="secondary"
            type="button"
            aria-controls="admin-token-login-form"
            aria-expanded={showTokenForm}
            onClick={() => setShowTokenForm((visible) => !visible)}
            data-ko={dashboardI18n.ko.authPage.tokenLoginToggle}
            data-ja={dashboardI18n.ja.authPage.tokenLoginToggle}
          >
            {t.tokenLoginToggle}
          </button>
          {showTokenForm ? (
            <form id="admin-token-login-form" className="auth-form auth-token-form" onSubmit={(event) => void submit(event)}>
              <label className="field">
                <span data-ko={dashboardI18n.ko.authPage.tokenLabel} data-ja={dashboardI18n.ja.authPage.tokenLabel}>{t.tokenLabel}</span>
                <input
                  value={token}
                  type="password"
                  autoComplete="current-password"
                  placeholder={t.placeholder}
                  data-ko-placeholder={dashboardI18n.ko.authPage.placeholder}
                  data-ja-placeholder={dashboardI18n.ja.authPage.placeholder}
                  onChange={(event) => setToken(event.target.value)}
                  disabled={disabled || checking || submitting}
                />
              </label>
              <button disabled={disabled || !token.trim() || checking || submitting} type="submit" data-ko={checking || submitting ? dashboardI18n.ko.authPage.checking : dashboardI18n.ko.authPage.login} data-ja={checking || submitting ? dashboardI18n.ja.authPage.checking : dashboardI18n.ja.authPage.login}>
                {checking || submitting ? t.checking : t.login}
              </button>
              <p className="hint" data-ko={dashboardI18n.ko.authPage.hint} data-ja={dashboardI18n.ja.authPage.hint}>{t.hint}</p>
            </form>
          ) : null}
          {onBackToPublic ? (
            <button className="secondary" type="button" onClick={onBackToPublic} data-ko={dashboardI18n.ko.authPage.backToPublic} data-ja={dashboardI18n.ja.authPage.backToPublic}>
              {t.backToPublic}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
