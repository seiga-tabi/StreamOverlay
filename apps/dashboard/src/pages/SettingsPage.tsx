import { apiBase } from "../api/client";
import { RiotApiKeyCard } from "../components/RiotApiKeyCard";
import { TwitchConnectionCard } from "../components/TwitchConnectionCard";
import { uiText } from "../i18n";

export function SettingsPage() {
  const t = uiText.settingsPage;

  return (
    <>
      <header className="page-header compact">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.description}</p>
        </div>
      </header>
      <TwitchConnectionCard />
      <RiotApiKeyCard />
      <div className="card">
        <h2>{t.browserSource}</h2>
        <p>{t.overlayUrl}:</p>
        <code>http://localhost:5174</code>
        <p>{t.serverApi}:</p>
        <code>{apiBase}</code>
      </div>
      <div className="card danger-card">
        <h2>{t.safetyTitle}</h2>
        <ul>
          {t.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </div>
    </>
  );
}
