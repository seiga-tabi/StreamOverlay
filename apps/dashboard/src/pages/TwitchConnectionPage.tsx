import { EventSubStatusCard } from "../components/EventSubStatusCard";
import { TwitchConnectionCard } from "../components/TwitchConnectionCard";
import { uiText } from "../i18n";

export function TwitchConnectionPage() {
  const t = uiText.twitchPage;

  return (
    <>
      <header className="page-header compact">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.description}</p>
        </div>
      </header>
      <div className="ops-grid">
        <TwitchConnectionCard />
        <EventSubStatusCard />
      </div>
    </>
  );
}
