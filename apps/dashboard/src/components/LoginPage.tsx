import { useState, type FormEvent } from "react";
import { uiText } from "../i18n";

export function LoginPage({
  checking,
  disabled,
  error,
  onLogin,
  onBackToPublic
}: {
  checking: boolean;
  disabled?: boolean;
  error: string;
  onLogin: (token: string) => Promise<void>;
  onBackToPublic?: () => void;
}) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const t = uiText.authPage;

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
          <div className="brand-mark">S</div>
          <div>
            <div className="brand">StreamOps</div>
            <div className="brand-subtitle">{uiText.app.brandSubtitle}</div>
          </div>
        </div>
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.title}</h1>
        <p className="muted">{t.description}</p>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label className="field">
            <span>{t.tokenLabel}</span>
            <input
              value={token}
              type="password"
              autoComplete="current-password"
              placeholder={t.placeholder}
              onChange={(event) => setToken(event.target.value)}
              disabled={disabled || checking || submitting}
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button disabled={disabled || !token.trim() || checking || submitting} type="submit">
            {checking || submitting ? t.checking : t.login}
          </button>
          {onBackToPublic ? <button className="secondary" type="button" onClick={onBackToPublic}>{t.backToPublic}</button> : null}
        </form>
        <p className="hint">{t.hint}</p>
      </section>
    </main>
  );
}
