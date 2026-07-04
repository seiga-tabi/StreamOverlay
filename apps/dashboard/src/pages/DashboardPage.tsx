import { useEffect, useState } from "react";
import type { TwitchConnectionStatus, TwitchEventSubWebSocketState } from "@streamops/shared";
import { StatusCard } from "../components/StatusCard";
import { EventLog } from "../components/EventLog";
import { QuestionQueue } from "../components/QuestionQueue";
import { ActionTester } from "../components/ActionTester";
import { apiBase, apiGet } from "../api/client";
import { uiText } from "../i18n";

type StatusValue = keyof typeof uiText.statusValues;

function statusLabel(value: string): string {
  return uiText.statusValues[value as StatusValue] ?? value;
}

export function DashboardPage({ snapshot, socketConnected, role = "admin" }: { snapshot: any; socketConnected: boolean; role?: "admin" | "streamer" }) {
  const status = snapshot.status ?? { server: "offline", twitch: "disabled", stream: "unknown", bridge: "disconnected", obs: "unknown", participation: "closed" };
  const t = uiText.dashboard;
  const [twitchStatus, setTwitchStatus] = useState<TwitchConnectionStatus | null>(null);
  const [twitchStatusFailed, setTwitchStatusFailed] = useState(false);
  const twitchEventSubState: TwitchEventSubWebSocketState | undefined = twitchStatus?.eventSub?.websocket;
  const twitchCardValue = twitchStatus?.connected ? "connected" : twitchStatus?.state ?? status.twitch;
  const twitchErrorHint = twitchStatus?.error ? ` · ${t.twitchStatusError}: ${twitchStatus.error}` : "";
  const twitchCardHint = twitchStatus
    ? `${t.twitchOAuth}: ${statusLabel(twitchCardValue)} · ${t.twitchEventSub}: ${statusLabel(twitchEventSubState ?? status.twitch)}${twitchErrorHint}`
    : twitchStatusFailed
      ? t.twitchStatusUnavailable
      : undefined;
  const twitchReconnectRequired = twitchStatus?.state === "token_expired" || Boolean(twitchStatus?.error);

  function reconnectTwitch() {
    window.location.href = `${apiBase}/api/twitch/auth/start?force_verify=1`;
  }

  useEffect(() => {
    let active = true;

    apiGet<TwitchConnectionStatus>("/api/twitch/status")
      .then((nextStatus) => {
        if (!active) return;
        setTwitchStatus(nextStatus);
        setTwitchStatusFailed(false);
      })
      .catch(() => {
        if (!active) return;
        setTwitchStatusFailed(true);
      });

    return () => {
      active = false;
    };
  }, [status.twitch]);

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
        <StatusCard
          label={t.statusLabels.twitch}
          value={twitchCardValue}
          hint={twitchCardHint}
          actionLabel={twitchReconnectRequired ? t.twitchReconnectAction : undefined}
          onAction={twitchReconnectRequired ? reconnectTwitch : undefined}
        />
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
