import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "../api/client";
import { uiText } from "../i18n";

type RiotApiKeyStatus = {
  configured: boolean;
  source: "runtime" | "env" | "none";
  maskedKey?: string;
  updatedAt?: string;
  accountRegion: string;
  lolPlatform: string;
};

const emptyStatus: RiotApiKeyStatus = {
  configured: false,
  source: "none",
  accountRegion: "-",
  lolPlatform: "-"
};

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function RiotApiKeyCard() {
  const t = uiText.settingsPage.riotApi;
  const [status, setStatus] = useState<RiotApiKeyStatus>(emptyStatus);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      setStatus(await apiGet<RiotApiKeyStatus>("/api/riot/settings"));
      setError("");
    } catch (err) {
      setError(`${t.loadFailed}: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const next = await apiPost<RiotApiKeyStatus>("/api/riot/api-key", { apiKey });
      setStatus(next);
      setApiKey("");
      setMessage(t.saved);
    } catch (err) {
      setError(`${t.saveFailed}: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function clearRuntimeKey() {
    setClearing(true);
    setMessage("");
    setError("");
    try {
      const next = await apiPost<RiotApiKeyStatus>("/api/riot/api-key/delete", {});
      setStatus(next);
      setMessage(t.cleared);
    } catch (err) {
      setError(`${t.clearFailed}: ${String(err)}`);
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="card riot-key-card">
      <div className="section-title-row">
        <div>
          <h2>{t.title}</h2>
          <p className="muted">{t.description}</p>
        </div>
        <span className={`status-pill ${status.configured ? "good" : "muted-pill"}`}>
          {status.configured ? t.configured : t.notConfigured}
        </span>
      </div>

      <div className="riot-key-status-grid">
        <div>
          <span>{t.source}</span>
          <strong>{t.sources[status.source]}</strong>
        </div>
        <div>
          <span>{t.maskedKey}</span>
          <strong>{status.maskedKey ?? "-"}</strong>
        </div>
        <div>
          <span>{t.accountRegion}</span>
          <strong>{status.accountRegion}</strong>
        </div>
        <div>
          <span>{t.lolPlatform}</span>
          <strong>{status.lolPlatform}</strong>
        </div>
        <div>
          <span>{t.updatedAt}</span>
          <strong>{formatDate(status.updatedAt)}</strong>
        </div>
      </div>

      <form className="riot-key-form" onSubmit={save}>
        <label className="field">
          {t.inputLabel}
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={t.placeholder}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="button-row inline-buttons">
          <button type="submit" disabled={saving || loading || !apiKey.trim()}>
            {saving ? t.saving : t.save}
          </button>
          <button type="button" className="secondary" onClick={clearRuntimeKey} disabled={clearing || status.source !== "runtime"}>
            {clearing ? t.clearing : t.clear}
          </button>
        </div>
      </form>

      <ul className="settings-note-list">
        {t.notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}
