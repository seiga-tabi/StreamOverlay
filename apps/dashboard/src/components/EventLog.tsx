import { uiText } from "../i18n";

export function EventLog({ events }: { events: any[] }) {
  const t = uiText.eventLog;

  return (
    <div className="card">
      <div className="card-title-row">
        <h2>{t.title}</h2>
        <span className="count-badge">{events.length}{t.count}</span>
      </div>
      <div className="list">
        {events.length === 0 ? <p className="muted empty-state">{t.empty}</p> : null}
        {events.map((event) => (
          <div className="row" key={event.id ?? `${event.type}-${event.createdAt}`}>
            <div>
              <strong>{event.type}</strong>
              <div className="muted">{event.chatterUserName ?? event.userName ?? event.createdAt}</div>
            </div>
            <code>{event.id}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
