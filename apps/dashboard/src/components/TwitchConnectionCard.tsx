import { useEffect, useState } from "react";
import type { TwitchConnectionStatus, TwitchEventSubStatus } from "@streamops/shared";
import { apiBase, apiGet, apiPost } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../shared/ui/EmptyState";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "../shared/ui/Modal";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill, type StatusTone } from "../shared/ui/Status";
import { Toast, ToastCloseButton, ToastDescription, ToastProvider, ToastTitle, ToastViewport, type ToastTone } from "../shared/ui/Toast";

const i18n = {
  ko: {
    title: "Twitch 계정 연결",
    description: "방송자 계정을 연결하면 OAuth token으로 EventSub와 채팅 API를 사용할 수 있습니다.",
    loading: "연결 상태를 확인 중입니다.",
    connected: "연결됨",
    disconnected: "연결 안 됨",
    tokenExpired: "토큰 만료",
    missingScopes: "권한 부족",
    connect: "Twitch 연결",
    reconnect: "다시 연결",
    forceReconnect: "권한 다시 승인",
    disconnect: "연결 해제",
    refresh: "토큰 갱신",
    eventSubReconnect: "EventSub 재연결",
    broadcaster: "방송자",
    broadcasterId: "방송자 ID",
    tokenExpiry: "토큰 만료 시각",
    grantedScopes: "승인된 권한",
    requiredScopes: "필수 권한",
    missingScopeWarning: "누락된 권한이 있습니다. 다시 연결해 권한을 승인해주세요.",
    tokenRefreshWarning: "저장된 Twitch token 자동 갱신에 실패했습니다.",
    reconnectRequired: "권한 다시 승인으로 Twitch를 다시 연결해주세요.",
    legacyConfigured: ".env 기반 Twitch token이 설정되어 있습니다. OAuth 연결 후에는 OAuth token을 우선 사용합니다.",
    none: "없음",
    refreshDone: "토큰 상태를 갱신했습니다.",
    disconnectDone: "Twitch 연결을 해제했습니다.",
    actionFailed: "요청 처리에 실패했습니다.",
    eventSub: "EventSub WebSocket",
    websocketConnected: "연결됨",
    websocketDisconnected: "연결 안 됨",
    websocketReconnecting: "재연결 중",
    websocketDisabled: "비활성",
    activeSubscriptions: "활성 구독",
    failedSubscriptions: "실패한 구독",
    lastEventAt: "마지막 이벤트",
    eventSubMissingScopes: "EventSub 누락 권한",
    eventSubDisabledWarning: "EventSub가 비활성입니다. 채팅 명령어와 채널 포인트 보상을 수신하려면 서버 .env에서 TWITCH_ENABLE_EVENTSUB=true로 설정한 뒤 서버를 재시작하세요.",
    subscriptions: "구독 상태",
    chatSender: "채팅 발송",
    chatQueue: "채팅 대기열",
    chatThrottle: "전송 간격",
    chatCooldown: "반복 cooldown",
    recentChatFailures: "최근 채팅 실패",
    noChatFailures: "최근 실패 없음",
    confirmDisconnectTitle: "Twitch 연결 해제",
    confirmDisconnectDescription: "OAuth token을 해제하면 EventSub와 채팅 API가 즉시 사용할 수 없게 됩니다.",
    confirm: "확인",
    cancel: "취소",
    close: "닫기"
  },
  ja: {
    title: "Twitch アカウント接続",
    description: "配信者アカウントを接続すると OAuth token で EventSub とチャット API を使用できます。",
    loading: "接続状態を確認しています。",
    connected: "接続済み",
    disconnected: "未接続",
    tokenExpired: "トークン期限切れ",
    missingScopes: "権限不足",
    connect: "Twitch 接続",
    reconnect: "再接続",
    forceReconnect: "権限を再承認",
    disconnect: "接続解除",
    refresh: "トークン更新",
    eventSubReconnect: "EventSub 再接続",
    broadcaster: "配信者",
    broadcasterId: "配信者 ID",
    tokenExpiry: "トークン期限",
    grantedScopes: "承認済み権限",
    requiredScopes: "必須権限",
    missingScopeWarning: "不足している権限があります。再接続して権限を承認してください。",
    tokenRefreshWarning: "保存済み Twitch token の自動更新に失敗しました。",
    reconnectRequired: "権限を再承認して Twitch を再接続してください。",
    legacyConfigured: ".env ベースの Twitch token が設定されています。OAuth 接続後は OAuth token を優先します。",
    none: "なし",
    refreshDone: "トークン状態を更新しました。",
    disconnectDone: "Twitch 接続を解除しました。",
    actionFailed: "リクエスト処理に失敗しました。",
    eventSub: "EventSub WebSocket",
    websocketConnected: "接続済み",
    websocketDisconnected: "未接続",
    websocketReconnecting: "再接続中",
    websocketDisabled: "無効",
    activeSubscriptions: "有効な購読",
    failedSubscriptions: "失敗した購読",
    lastEventAt: "最後のイベント",
    eventSubMissingScopes: "EventSub 不足権限",
    eventSubDisabledWarning: "EventSub が無効です。チャットコマンドとチャンネルポイント報酬を受信するには、サーバーの .env で TWITCH_ENABLE_EVENTSUB=true を設定してからサーバーを再起動してください。",
    subscriptions: "購読状態",
    chatSender: "チャット送信",
    chatQueue: "チャットキュー",
    chatThrottle: "送信間隔",
    chatCooldown: "重複 cooldown",
    recentChatFailures: "最近のチャット失敗",
    noChatFailures: "最近の失敗なし",
    confirmDisconnectTitle: "Twitch 接続解除",
    confirmDisconnectDescription: "OAuth token を解除すると EventSub とチャット API がすぐに使用できなくなります。",
    confirm: "確認",
    cancel: "キャンセル",
    close: "閉じる"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

type SettingsToast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

function statusLabel(status: TwitchConnectionStatus["state"]): string {
  if (status === "connected") return t.connected;
  if (status === "token_expired") return t.tokenExpired;
  if (status === "missing_scopes") return t.missingScopes;
  return t.disconnected;
}

function statusTone(status: TwitchConnectionStatus["state"]): StatusTone {
  if (status === "connected") return "success";
  if (status === "missing_scopes" || status === "token_expired") return "warning";
  return "danger";
}

function websocketLabel(status: TwitchConnectionStatus["eventSub"]): string {
  if (!status) return t.websocketDisabled;
  if (status.websocket === "connected") return t.websocketConnected;
  if (status.websocket === "reconnecting") return t.websocketReconnecting;
  if (status.websocket === "disabled") return t.websocketDisabled;
  return t.websocketDisconnected;
}

function websocketTone(status: TwitchConnectionStatus["eventSub"]): StatusTone {
  if (status?.websocket === "connected") return "success";
  if (status?.websocket === "reconnecting" || status?.websocket === "disabled") return "warning";
  return "danger";
}

function subscriptionTone(status: string): StatusTone {
  if (status === "active") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

function formatLastEvent(value?: string): string {
  if (!value) return t.none;
  return new Date(value).toLocaleString("ko-KR");
}

function eventSubStatusText(status?: TwitchEventSubStatus): string {
  return status?.websocket ?? "unknown";
}

export function TwitchConnectionCard() {
  const [status, setStatus] = useState<TwitchConnectionStatus>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<SettingsToast | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const eventSubDisabled = status?.eventSub?.websocket === "disabled";

  function showToast(tone: ToastTone, title: string, description?: string): void {
    setToast({ id: Date.now(), tone, title, description });
  }

  async function loadStatus(silent = false) {
    if (!silent) setLoading(true);
    setError(undefined);
    try {
      setStatus(await apiGet<TwitchConnectionStatus>("/api/twitch/status"));
    } catch {
      setError(t.actionFailed);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => {
      void loadStatus(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  function connect(forceVerify = false) {
    const suffix = forceVerify ? "?force_verify=1" : "";
    window.location.href = `${apiBase}/api/twitch/auth/start${suffix}`;
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const next = await apiPost<TwitchConnectionStatus>("/api/twitch/auth/disconnect", {});
      setStatus(next);
      setDisconnectOpen(false);
      showToast("success", t.disconnectDone);
    } catch {
      setError(t.actionFailed);
      showToast("danger", t.actionFailed);
    } finally {
      setDisconnecting(false);
    }
  }

  async function refresh() {
    try {
      const next = await apiPost<TwitchConnectionStatus>("/api/twitch/token/refresh", {});
      setStatus(next);
      showToast("success", t.refreshDone);
    } catch {
      setError(t.actionFailed);
      showToast("danger", t.actionFailed);
    }
  }

  async function reconnectEventSub() {
    try {
      const next = await apiPost<TwitchConnectionStatus>("/api/twitch/eventsub/reconnect", {});
      setStatus(next);
      showToast("success", t.refreshDone);
    } catch {
      setError(t.actionFailed);
      showToast("danger", t.actionFailed);
    }
  }

  return (
    <ToastProvider position="top-right">
      <Card as="section" className="settings-shared-card twitch-connection-card" padding="lg" variant="glass">
        <CardHeader className="settings-shared-card-header">
          <div>
            <CardTitle as="h2">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          {status ? <StatusPill tone={statusTone(status.state)}>{statusLabel(status.state)}</StatusPill> : <StatusPill tone="warning">{t.loading}</StatusPill>}
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
              <EmptyStateTitle as="h3">{error ?? t.actionFailed}</EmptyStateTitle>
              <EmptyStateDescription>{t.description}</EmptyStateDescription>
            </EmptyState>
          ) : null}

          {status ? (
            <>
              <div className="settings-shared-metric-grid">
                <Metric label={t.broadcaster} value={status.broadcaster?.displayName ?? status.broadcaster?.login ?? t.none} tone="streamer" size="sm" />
                <Metric label={t.broadcasterId} value={status.broadcaster?.id ?? t.none} tone="neutral" size="sm" />
                <Metric label={t.tokenExpiry} value={formatLastEvent(status.tokenExpiresAt)} tone={status.state === "token_expired" ? "danger" : "info"} size="sm" />
                <Metric label={t.eventSub} value={websocketLabel(status.eventSub)} tone={websocketTone(status.eventSub)} status={<StatusPill size="sm" tone={websocketTone(status.eventSub)}>{eventSubStatusText(status.eventSub)}</StatusPill>} size="sm" />
                <Metric label={t.activeSubscriptions} value={status.eventSub?.activeSubscriptions ?? 0} tone="success" size="sm" />
                <Metric label={t.failedSubscriptions} value={status.eventSub?.failedSubscriptions.length ?? 0} tone={status.eventSub?.failedSubscriptions.length ? "danger" : "neutral"} size="sm" />
                <Metric label={t.lastEventAt} value={formatLastEvent(status.eventSub?.lastEventAt)} tone="neutral" size="sm" />
                <Metric label={t.chatSender} value={status.chat?.mode ?? t.none} tone="info" size="sm" />
                <Metric label={t.chatQueue} value={status.chat?.queueSize ?? 0} tone="streamer" size="sm" />
                <Metric label={t.chatThrottle} value={status.chat ? `${status.chat.throttleMs}ms` : t.none} tone="neutral" size="sm" />
                <Metric label={t.chatCooldown} value={status.chat ? `${status.chat.cooldownMs}ms` : t.none} tone="neutral" size="sm" />
              </div>

              <div className="settings-shared-scope-grid">
                <Card as="div" className="settings-shared-inline-card" padding="sm" variant="elevated">
                  <CardTitle as="h3">{t.requiredScopes}</CardTitle>
                  <div className="settings-shared-chip-row">
                    {status.requiredScopes.map((scope) => <Badge key={scope} tone="info" size="sm">{scope}</Badge>)}
                  </div>
                </Card>
                <Card as="div" className="settings-shared-inline-card" padding="sm" variant="elevated">
                  <CardTitle as="h3">{t.grantedScopes}</CardTitle>
                  <div className="settings-shared-chip-row">
                    {status.grantedScopes.length > 0 ? status.grantedScopes.map((scope) => <Badge key={scope} tone="streamer" size="sm">{scope}</Badge>) : <Badge tone="warning" size="sm">{t.none}</Badge>}
                  </div>
                </Card>
              </div>
            </>
          ) : null}

          {status?.missingScopes.length ? (
            <Card className="settings-shared-inline-card" padding="md" variant="warning">
              <CardTitle as="h3">{t.missingScopeWarning}</CardTitle>
              <div className="settings-shared-chip-row">{status.missingScopes.map((scope) => <Badge key={scope} tone="warning" size="sm">{scope}</Badge>)}</div>
            </Card>
          ) : null}

          {status?.error ? (
            <Card className="settings-shared-inline-card" padding="md" variant="danger">
              <CardTitle as="h3">{t.tokenRefreshWarning}</CardTitle>
              <CardDescription>{status.error}</CardDescription>
              <CardDescription>{t.reconnectRequired}</CardDescription>
            </Card>
          ) : null}

          {status?.eventSub?.missingScopes.length ? (
            <Card className="settings-shared-inline-card" padding="md" variant="warning">
              <CardTitle as="h3">{t.eventSubMissingScopes}</CardTitle>
              <div className="settings-shared-chip-row">{status.eventSub.missingScopes.map((scope) => <Badge key={scope} tone="warning" size="sm">{scope}</Badge>)}</div>
            </Card>
          ) : null}

          {eventSubDisabled ? (
            <Card className="settings-shared-inline-card" padding="md" variant="warning">
              <CardTitle as="h3">{t.eventSubDisabledWarning}</CardTitle>
            </Card>
          ) : null}

          {status?.eventSub?.subscriptions.length ? (
            <div className="settings-shared-list">
              <strong>{t.subscriptions}</strong>
              {status.eventSub.subscriptions.map((subscription) => (
                <div className="settings-shared-list-row" key={subscription.type}>
                  <code>{subscription.type}</code>
                  <StatusPill tone={subscriptionTone(subscription.status)} size="sm">{subscription.status}</StatusPill>
                </div>
              ))}
            </div>
          ) : null}

          {status?.chat ? (
            <div className="settings-shared-list">
              <strong>{t.recentChatFailures}</strong>
              {status.chat.recentFailures.length > 0 ? status.chat.recentFailures.map((failure) => (
                <div className="settings-shared-list-row" key={failure.id}>
                  <span>
                    <strong>{failure.reason}</strong>
                    <small>{failure.messagePreview}</small>
                  </span>
                  <StatusPill tone="danger" size="sm">{new Date(failure.createdAt).toLocaleTimeString("ko-KR")}</StatusPill>
                </div>
              )) : (
                <EmptyState className="settings-shared-empty-inline" variant="default">
                  <EmptyStateIcon>0</EmptyStateIcon>
                  <EmptyStateTitle as="h3">{t.noChatFailures}</EmptyStateTitle>
                </EmptyState>
              )}
            </div>
          ) : null}

          {status?.legacyConfigured ? <StatusPill tone="info">{t.legacyConfigured}</StatusPill> : null}
          {error ? <StatusPill tone="danger">{error}</StatusPill> : null}
        </CardContent>

        <CardFooter className="settings-shared-actions">
          <Button onClick={() => connect(false)}>{status?.connected ? t.reconnect : t.connect}</Button>
          <Button variant="secondary" onClick={() => connect(true)}>{t.forceReconnect}</Button>
          <Button variant="tertiary" onClick={() => void refresh()} disabled={!status || status.source !== "oauth"}>{t.refresh}</Button>
          <Button variant="tertiary" onClick={() => void reconnectEventSub()} disabled={!status}>{t.eventSubReconnect}</Button>
          <Button variant="danger" onClick={() => setDisconnectOpen(true)} disabled={!status || status.source !== "oauth"}>{t.disconnect}</Button>
        </CardFooter>
      </Card>

      <Modal open={disconnectOpen} onOpenChange={setDisconnectOpen} size="sm" loading={disconnecting}>
        <ModalHeader>
          <ModalTitle>{t.confirmDisconnectTitle}</ModalTitle>
          <ModalDescription>{t.confirmDisconnectDescription}</ModalDescription>
        </ModalHeader>
        <ModalContent>
          <StatusPill tone="danger">{t.disconnect}</StatusPill>
        </ModalContent>
        <ModalFooter>
          <Button variant="danger" loading={disconnecting} onClick={() => void disconnect()}>{t.disconnect}</Button>
          <Button variant="secondary" disabled={disconnecting} onClick={() => setDisconnectOpen(false)}>{t.cancel}</Button>
        </ModalFooter>
      </Modal>

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
