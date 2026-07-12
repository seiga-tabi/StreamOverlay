import { uiText } from "../i18n";
import { Badge } from "../shared/ui/Status";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/Card";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../shared/ui/EmptyState";

type EventLogProps = {
  events: any[];
  id?: string;
  shared?: boolean;
};

export function EventLog({ events, id, shared = false }: EventLogProps) {
  const t = uiText.eventLog;

  if (shared) {
    return (
      <Card as="section" className="dashboard-shared-event-log" id={id} padding="lg" variant="glass">
        <CardHeader>
          <CardTitle as="h2">{t.title}</CardTitle>
          <Badge size="sm" tone="info">
            {events.length}{t.count}
          </Badge>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState as="div" variant="streamer">
              <EmptyStateIcon>•</EmptyStateIcon>
              <EmptyStateTitle as="h3">{t.title}</EmptyStateTitle>
              <EmptyStateDescription>{t.empty}</EmptyStateDescription>
            </EmptyState>
          ) : (
            <div className="dashboard-shared-event-list">
              {events.map((event) => (
                <div className="dashboard-shared-event-row" key={event.id ?? `${event.type}-${event.createdAt}`}>
                  <div>
                    <strong>{event.type}</strong>
                    <div className="muted">{event.chatterUserName ?? event.userName ?? event.createdAt}</div>
                  </div>
                  <code>{event.id}</code>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

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
