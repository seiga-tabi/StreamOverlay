import { useState, type FormEvent } from "react";
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
  const t = dashboardI18n[locale].authPage;

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
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
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
          {error ? <p className="error-text">{error}</p> : null}
          <button disabled={disabled || !token.trim() || checking || submitting} type="submit" data-ko={checking || submitting ? dashboardI18n.ko.authPage.checking : dashboardI18n.ko.authPage.login} data-ja={checking || submitting ? dashboardI18n.ja.authPage.checking : dashboardI18n.ja.authPage.login}>
            {checking || submitting ? t.checking : t.login}
          </button>
          {onBackToPublic ? (
            <button className="secondary" type="button" onClick={onBackToPublic} data-ko={dashboardI18n.ko.authPage.backToPublic} data-ja={dashboardI18n.ja.authPage.backToPublic}>
              {t.backToPublic}
            </button>
          ) : null}
        </form>
        <p className="hint" data-ko={dashboardI18n.ko.authPage.hint} data-ja={dashboardI18n.ja.authPage.hint}>{t.hint}</p>
      </section>
    </main>
  );
}
