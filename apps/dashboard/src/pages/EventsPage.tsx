import { EventLog } from "../components/EventLog";
import { uiText } from "../i18n";

export function EventsPage({ snapshot }: { snapshot: any }) {
  const t = uiText.eventsPage;
  const actions = snapshot.actions ?? [];

  return (
    <>
      <header className="page-header compact">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.description}</p>
        </div>
      </header>
      <EventLog events={snapshot.events ?? []} />
      <div className="card">
        <h2>{t.recentActions}</h2>
        {actions.length === 0 ? <p className="muted empty-state">{t.emptyActions}</p> : null}
        {actions.map((action: any) => (
          <div className="row" key={action.id}>
            <strong>{action.type}</strong>
            <span className={action.status === "failed" ? "bad-text" : "good-text"}>{action.status}</span>
            {action.error ? <code>{action.error}</code> : null}
          </div>
        ))}
      </div>
    </>
  );
}
