import { useEffect, useState } from "react";
import type { TwitchConnectionStatus, TwitchEventSubWebSocketState } from "@streamops/shared";
import { StatusCard } from "../components/StatusCard";
import { EventLog } from "../components/EventLog";
import { ActionTester } from "../components/ActionTester";
import { apiBase, apiGet } from "../api/client";
import { createDashboardLocaleProxy, uiText } from "../i18n";
import {
  AppShell,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
} from "../shared/ui/AppShell";
import {
  Navigation,
  NavigationBadge,
  NavigationItem,
  NavigationSection,
} from "../shared/ui/Navigation";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle,
} from "../shared/ui/PageHeader";
import { StatusPill } from "../shared/ui/Status";

type StatusValue = keyof typeof uiText.statusValues;

const dashboardSharedUi = createDashboardLocaleProxy({
  ko: {
    actions: "테스트",
    adminOnly: "관리자",
    events: "이벤트",
    navigationLabel: "방송 운영 대시보드 섹션",
    navigationTitle: "오늘 방송 운영",
    skipLink: "본문으로 이동",
    status: "상태 요약"
  },
  ja: {
    actions: "テスト",
    adminOnly: "管理者",
    events: "イベント",
    navigationLabel: "配信運用ダッシュボードセクション",
    navigationTitle: "今日の配信運用",
    skipLink: "本文へ移動",
    status: "ステータス概要"
  }
});

function statusLabel(value: string): string {
  return uiText.statusValues[value as StatusValue] ?? value;
}

export function DashboardPage({ snapshot, socketConnected, role = "admin" }: { snapshot: any; socketConnected: boolean; role?: "admin" | "streamer" }) {
  const status = snapshot.status ?? { server: "offline", twitch: "disabled", stream: "unknown", bridge: "disconnected", obs: "unknown", participation: "closed" };
  const t = uiText.dashboard;
  const sharedT = dashboardSharedUi;
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
    <AppShell
      as="section"
      className="dashboard-shared-shell"
      mainId="dashboard-shared-main"
      skipLinkLabel={sharedT.skipLink}
      variant="streamer"
    >
      <AppShellHeader className="dashboard-shared-header">
        <PageHeader className="dashboard-shared-page-header" layout="split">
          <PageHeaderEyebrow>{t.eyebrow}</PageHeaderEyebrow>
          <PageHeaderTitle>{t.title}</PageHeaderTitle>
          <PageHeaderDescription>{t.description}</PageHeaderDescription>
          <PageHeaderStatus>
            <StatusPill tone={socketConnected ? "success" : "neutral"}>
              {t.websocket}: {socketConnected ? t.connected : t.offline}
            </StatusPill>
          </PageHeaderStatus>
          <PageHeaderActions>
            <StatusPill tone={role === "admin" ? "admin" : "streamer"}>
              {role === "admin" ? sharedT.adminOnly : sharedT.navigationTitle}
            </StatusPill>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>

      <AppShellSidebar as="nav" className="dashboard-shared-sidebar">
        <Navigation aria-label={sharedT.navigationLabel} variant="streamer">
          <NavigationSection title={sharedT.navigationTitle}>
            <NavigationItem
              active
              as="a"
              badge={<NavigationBadge>{statusLabel(status.server)}</NavigationBadge>}
              href="#dashboard-status"
            >
              {sharedT.status}
            </NavigationItem>
            {role === "admin" ? (
              <NavigationItem
                as="a"
                badge={<NavigationBadge>{(snapshot.events ?? []).length}{uiText.eventLog.count}</NavigationBadge>}
                href="#dashboard-events"
              >
                {sharedT.events}
              </NavigationItem>
            ) : null}
            {role === "admin" ? (
              <NavigationItem as="a" href="#dashboard-actions">
                {sharedT.actions}
              </NavigationItem>
            ) : null}
          </NavigationSection>
        </Navigation>
      </AppShellSidebar>

      <AppShellMain className="dashboard-shared-main" id="dashboard-shared-main">
        <section className="dashboard-shared-status-grid" id="dashboard-status">
          <StatusCard label={t.statusLabels.server} value={status.server} />
          <StatusCard
            actionLabel={twitchReconnectRequired ? t.twitchReconnectAction : undefined}
            hint={twitchCardHint}
            label={t.statusLabels.twitch}
            loading={twitchStatus === null && !twitchStatusFailed}
            onAction={twitchReconnectRequired ? reconnectTwitch : undefined}
            value={twitchCardValue}
          />
          <StatusCard label={t.statusLabels.stream} value={status.stream} />
          <StatusCard label={t.statusLabels.bridge} value={status.bridge} />
          <StatusCard label={t.statusLabels.obs} value={status.obs} />
          <StatusCard label={t.statusLabels.participation} value={status.participation} />
        </section>
        {role === "admin" ? (
          <div className="dashboard-shared-panels">
            <EventLog events={snapshot.events ?? []} id="dashboard-events" shared />
            <ActionTester id="dashboard-actions" />
          </div>
        ) : null}
      </AppShellMain>
    </AppShell>
  );
}
