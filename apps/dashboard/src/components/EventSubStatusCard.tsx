import { useEffect, useState } from "react";
import type { TwitchConnectionStatus, TwitchEventSubStatus } from "@streamops/shared";
import { apiGet, apiPost } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../shared/ui/EmptyState";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill, type StatusTone } from "../shared/ui/Status";
import { Toast, ToastCloseButton, ToastDescription, ToastProvider, ToastTitle, ToastViewport, type ToastTone } from "../shared/ui/Toast";

const i18n = {
  ko: {
    title: "EventSub 상태",
    description: "Twitch WebSocket 연결과 subscription 상태를 확인합니다.",
    reconnect: "재연결 / 재구독",
    activeSubscriptions: "활성 구독",
    failedSubscriptions: "실패",
    missingScopes: "누락 권한",
    disabledWarning: "EventSub가 비활성입니다. 채팅 명령어를 수신하려면 서버 .env에서 TWITCH_ENABLE_EVENTSUB=true로 설정한 뒤 서버를 재시작하세요.",
    lastEventAt: "마지막 이벤트",
    sessionId: "Session",
    subscriptions: "구독 목록",
    none: "없음",
    requested: "EventSub 재연결을 요청했습니다.",
    failed: "EventSub 요청에 실패했습니다.",
    loading: "EventSub 상태를 불러오는 중입니다.",
    close: "닫기"
  },
  ja: {
    title: "EventSub 状態",
    description: "Twitch WebSocket 接続と subscription 状態を確認します。",
    reconnect: "再接続 / 再購読",
    activeSubscriptions: "有効購読",
    failedSubscriptions: "失敗",
    missingScopes: "不足権限",
    disabledWarning: "EventSub が無効です。チャットコマンドを受信するには、サーバーの .env で TWITCH_ENABLE_EVENTSUB=true を設定してからサーバーを再起動してください。",
    lastEventAt: "最後のイベント",
    sessionId: "Session",
    subscriptions: "購読一覧",
    none: "なし",
    requested: "EventSub 再接続をリクエストしました。",
    failed: "EventSub リクエストに失敗しました。",
    loading: "EventSub 状態を読み込んでいます。",
    close: "閉じる"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

type EventSubToast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

function websocketTone(status?: TwitchEventSubStatus): StatusTone {
  if (status?.websocket === "connected") return "success";
  if (status?.websocket === "reconnecting" || status?.websocket === "disabled") return "warning";
  return "danger";
}

function subscriptionTone(status: string): StatusTone {
  if (status === "active") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString("ko-KR") : t.none;
}

export function EventSubStatusCard() {
  const [status, setStatus] = useState<TwitchConnectionStatus>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<EventSubToast | null>(null);

  function showToast(tone: ToastTone, title: string, description?: string): void {
    setToast({ id: Date.now(), tone, title, description });
  }

  async function loadStatus(silent = false) {
    if (!silent) setLoading(true);
    try {
      setStatus(await apiGet<TwitchConnectionStatus>("/api/twitch/status"));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus().catch(() => setLoading(false));
    const timer = window.setInterval(() => void loadStatus(true).catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function reconnect() {
    setBusy(true);
    try {
      const next = await apiPost<TwitchConnectionStatus>("/api/twitch/eventsub/reconnect", {});
      setStatus(next);
      showToast("success", t.requested);
    } catch {
      showToast("danger", t.failed);
    } finally {
      setBusy(false);
    }
  }

  const eventSub = status?.eventSub;
  const eventSubDisabled = eventSub?.websocket === "disabled";

  return (
    <ToastProvider position="top-right">
      <Card as="section" className="settings-shared-card" padding="lg" variant="glass">
        <CardHeader className="settings-shared-card-header">
          <div>
            <CardTitle as="h2">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <StatusPill tone={websocketTone(eventSub)}>{eventSub?.websocket ?? "unknown"}</StatusPill>
        </CardHeader>

        <CardContent className="settings-shared-card-content">
          {loading && !status ? (
            <SkeletonCard loadingLabel={t.loading} size="md">
              <SkeletonText lines={4} size="md" />
            </SkeletonCard>
          ) : null}

          {!loading && !status ? (
            <EmptyState className="settings-shared-empty" variant="error">
              <EmptyStateIcon>!</EmptyStateIcon>
              <EmptyStateTitle as="h3">{t.failed}</EmptyStateTitle>
              <EmptyStateDescription>{t.description}</EmptyStateDescription>
            </EmptyState>
          ) : null}

          {status ? (
            <div className="settings-shared-metric-grid settings-shared-metric-grid--compact">
              <Metric label={t.activeSubscriptions} value={eventSub?.activeSubscriptions ?? 0} tone="success" size="sm" />
              <Metric label={t.failedSubscriptions} value={eventSub?.failedSubscriptions.length ?? 0} tone={eventSub?.failedSubscriptions.length ? "danger" : "neutral"} size="sm" />
              <Metric label={t.lastEventAt} value={formatDate(eventSub?.lastEventAt)} tone="neutral" size="sm" />
              <Metric label={t.sessionId} value={eventSub?.sessionId ?? t.none} tone="info" size="sm" />
            </div>
          ) : null}

          {eventSub?.missingScopes.length ? (
            <Card className="settings-shared-inline-card" padding="md" variant="warning">
              <CardTitle as="h3">{t.missingScopes}</CardTitle>
              <div className="settings-shared-chip-row">{eventSub.missingScopes.map((scope) => <Badge key={scope} tone="warning" size="sm">{scope}</Badge>)}</div>
            </Card>
          ) : null}

          {eventSubDisabled ? (
            <Card className="settings-shared-inline-card" padding="md" variant="warning">
              <CardTitle as="h3">{t.disabledWarning}</CardTitle>
            </Card>
          ) : null}

          <div className="settings-shared-list">
            <strong>{t.subscriptions}</strong>
            {eventSub?.subscriptions.length ? eventSub.subscriptions.map((subscription) => (
              <div className="settings-shared-list-row" key={subscription.type}>
                <span>
                  <strong>{subscription.type}</strong>
                  <small>{subscription.error ?? subscription.subscribedAt ?? subscription.version}</small>
                </span>
                <StatusPill tone={subscriptionTone(subscription.status)} size="sm">{subscription.status}</StatusPill>
              </div>
            )) : (
              <EmptyState className="settings-shared-empty-inline" variant="default">
                <EmptyStateIcon>0</EmptyStateIcon>
                <EmptyStateTitle as="h3">{t.none}</EmptyStateTitle>
              </EmptyState>
            )}
          </div>
        </CardContent>

        <CardFooter className="settings-shared-actions">
          <Button onClick={() => void reconnect()} loading={busy} disabled={busy}>{t.reconnect}</Button>
        </CardFooter>
      </Card>

      <ToastViewport className="settings-shared-toast-viewport">
        {toast ? (
          <Toast key={toast.id} autoDismiss tone={toast.tone} onDismiss={() => setToast(null)}>
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description ? <ToastDescription>{toast.description}</ToastDescription> : null}
            <ToastCloseButton aria-label={t.close}>×</ToastCloseButton>
          </Toast>
        ) : null}
      </ToastViewport>
    </ToastProvider>
  );
}
