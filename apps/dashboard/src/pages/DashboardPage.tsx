import { StatusCard } from "../components/StatusCard";
import { EventLog } from "../components/EventLog";
import { QuestionQueue } from "../components/QuestionQueue";
import { ActionTester } from "../components/ActionTester";
import { uiText } from "../i18n";

export function DashboardPage({ snapshot, socketConnected, role = "admin" }: { snapshot: any; socketConnected: boolean; role?: "admin" | "streamer" }) {
  const status = snapshot.status ?? { server: "offline", twitch: "disabled", stream: "unknown", bridge: "disconnected", obs: "unknown", participation: "closed" };
  const t = uiText.dashboard;

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p className="muted">{t.description}</p>
        </div>
        <div className={socketConnected ? "connection-pill good-bg" : "connection-pill neutral-bg"}>
          <span>{t.websocket}</span>
          <strong>{socketConnected ? t.connected : t.offline}</strong>
        </div>
      </header>
      <div className="grid status-grid">
        <StatusCard label={t.statusLabels.server} value={status.server} />
        <StatusCard label={t.statusLabels.twitch} value={status.twitch} />
        <StatusCard label={t.statusLabels.stream} value={status.stream} />
        <StatusCard label={t.statusLabels.bridge} value={status.bridge} />
        <StatusCard label={t.statusLabels.obs} value={status.obs} />
        <StatusCard label={t.statusLabels.participation} value={status.participation} />
      </div>
      <div className="grid dashboard-grid">
        <EventLog events={snapshot.events ?? []} />
        <QuestionQueue questions={snapshot.questions ?? []} />
      </div>
      {role === "admin" ? <ActionTester /> : null}
    </>
  );
}
