import { useEffect, useState } from "react";
import type { TwitchConnectionStatus } from "@streamops/shared";
import { apiBase, apiGet, apiPost } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";

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
    noChatFailures: "최근 실패 없음"
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
    noChatFailures: "最近の失敗なし"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

function statusLabel(status: TwitchConnectionStatus["state"]): string {
  if (status === "connected") return t.connected;
  if (status === "token_expired") return t.tokenExpired;
  if (status === "missing_scopes") return t.missingScopes;
  return t.disconnected;
}

function statusClass(status: TwitchConnectionStatus["state"]): string {
  if (status === "connected") return "good";
  if (status === "missing_scopes" || status === "token_expired") return "neutral";
  return "bad";
}

function websocketLabel(status: TwitchConnectionStatus["eventSub"]): string {
  if (!status) return t.websocketDisabled;
  if (status.websocket === "connected") return t.websocketConnected;
  if (status.websocket === "reconnecting") return t.websocketReconnecting;
  if (status.websocket === "disabled") return t.websocketDisabled;
  return t.websocketDisconnected;
}

function websocketClass(status: TwitchConnectionStatus["eventSub"]): string {
  if (status?.websocket === "connected") return "good";
  if (status?.websocket === "reconnecting") return "neutral";
  if (status?.websocket === "disabled") return "neutral";
  return "bad";
}

function formatLastEvent(value?: string): string {
  if (!value) return t.none;
  return new Date(value).toLocaleString("ko-KR");
}

export function TwitchConnectionCard() {
  const [status, setStatus] = useState<TwitchConnectionStatus>();
  const [error, setError] = useState<string>();
  const eventSubDisabled = status?.eventSub?.websocket === "disabled";

  async function loadStatus() {
    setError(undefined);
    setStatus(await apiGet<TwitchConnectionStatus>("/api/twitch/status"));
  }

  useEffect(() => {
    void loadStatus().catch(() => setError(t.actionFailed));
    const timer = window.setInterval(() => {
      void loadStatus().catch(() => setError(t.actionFailed));
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  function connect(forceVerify = false) {
    const suffix = forceVerify ? "?force_verify=1" : "";
    window.location.href = `${apiBase}/api/twitch/auth/start${suffix}`;
  }

  async function disconnect() {
    try {
      const next = await apiPost<TwitchConnectionStatus>("/api/twitch/auth/disconnect", {});
      setStatus(next);
      alert(t.disconnectDone);
    } catch {
      setError(t.actionFailed);
    }
  }

  async function refresh() {
    try {
      const next = await apiPost<TwitchConnectionStatus>("/api/twitch/token/refresh", {});
      setStatus(next);
      alert(t.refreshDone);
    } catch {
      setError(t.actionFailed);
    }
  }

  async function reconnectEventSub() {
    try {
      const next = await apiPost<TwitchConnectionStatus>("/api/twitch/eventsub/reconnect", {});
      setStatus(next);
      alert(t.refreshDone);
    } catch {
      setError(t.actionFailed);
    }
  }

  return (
    <div className="card twitch-connection-card">
      <div className="card-title-row">
        <div>
          <h2>{t.title}</h2>
          <p className="muted">{t.description}</p>
        </div>
        {status ? <span className={`queue-status ${statusClass(status.state)}`}>{statusLabel(status.state)}</span> : null}
      </div>

      {!status ? <p className="muted empty-state">{error ?? t.loading}</p> : null}

      {status ? (
        <div className="twitch-status-grid">
          <div>
            <span className="muted">{t.broadcaster}</span>
            <strong>{status.broadcaster?.displayName ?? status.broadcaster?.login ?? t.none}</strong>
          </div>
          <div>
            <span className="muted">{t.broadcasterId}</span>
            <code>{status.broadcaster?.id ?? t.none}</code>
          </div>
          <div>
            <span className="muted">{t.tokenExpiry}</span>
            <strong>{formatLastEvent(status.tokenExpiresAt)}</strong>
          </div>
          <div>
            <span className="muted">{t.requiredScopes}</span>
            <div className="chips">{status.requiredScopes.map((scope) => <code key={scope}>{scope}</code>)}</div>
          </div>
          <div>
            <span className="muted">{t.grantedScopes}</span>
            <div className="chips">
              {status.grantedScopes.length > 0 ? status.grantedScopes.map((scope) => <code key={scope}>{scope}</code>) : <code>{t.none}</code>}
            </div>
          </div>
          <div>
            <span className="muted">{t.eventSub}</span>
            <strong className={websocketClass(status.eventSub)}>{websocketLabel(status.eventSub)}</strong>
          </div>
          <div>
            <span className="muted">{t.activeSubscriptions}</span>
            <strong>{status.eventSub?.activeSubscriptions ?? 0}</strong>
          </div>
          <div>
            <span className="muted">{t.failedSubscriptions}</span>
            <strong>{status.eventSub?.failedSubscriptions.length ?? 0}</strong>
          </div>
          <div>
            <span className="muted">{t.lastEventAt}</span>
            <strong>{formatLastEvent(status.eventSub?.lastEventAt)}</strong>
          </div>
          <div>
            <span className="muted">{t.chatSender}</span>
            <strong>{status.chat?.mode ?? t.none}</strong>
          </div>
          <div>
            <span className="muted">{t.chatQueue}</span>
            <strong>{status.chat?.queueSize ?? 0}</strong>
          </div>
          <div>
            <span className="muted">{t.chatThrottle}</span>
            <strong>{status.chat ? `${status.chat.throttleMs}ms` : t.none}</strong>
          </div>
          <div>
            <span className="muted">{t.chatCooldown}</span>
            <strong>{status.chat ? `${status.chat.cooldownMs}ms` : t.none}</strong>
          </div>
        </div>
      ) : null}

      {status?.missingScopes.length ? (
        <div className="scope-warning">
          <strong>{t.missingScopeWarning}</strong>
          <div className="chips">{status.missingScopes.map((scope) => <code key={scope}>{scope}</code>)}</div>
        </div>
      ) : null}
      {status?.error ? (
        <div className="scope-warning">
          <strong>{t.tokenRefreshWarning}</strong>
          <p className="muted">{status.error}</p>
          <p className="muted">{t.reconnectRequired}</p>
        </div>
      ) : null}
      {status?.eventSub?.missingScopes.length ? (
        <div className="scope-warning">
          <strong>{t.eventSubMissingScopes}</strong>
          <div className="chips">{status.eventSub.missingScopes.map((scope) => <code key={scope}>{scope}</code>)}</div>
        </div>
      ) : null}
      {eventSubDisabled ? (
        <div className="scope-warning">
          <strong>{t.eventSubDisabledWarning}</strong>
        </div>
      ) : null}
      {status?.eventSub?.subscriptions.length ? (
        <div className="subscription-list">
          <span className="muted">{t.subscriptions}</span>
          {status.eventSub.subscriptions.map((subscription) => (
            <div className="subscription-row" key={subscription.type}>
              <code>{subscription.type}</code>
              <span className={`queue-status ${subscription.status === "active" ? "good" : subscription.status === "failed" ? "bad" : "neutral"}`}>
                {subscription.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {status?.chat ? (
        <div className="subscription-list">
          <span className="muted">{t.recentChatFailures}</span>
          {status.chat.recentFailures.length > 0 ? status.chat.recentFailures.map((failure) => (
            <div className="subscription-row" key={failure.id}>
              <span>
                <strong>{failure.reason}</strong>
                <small className="muted">{failure.messagePreview}</small>
              </span>
              <span className="queue-status bad">{new Date(failure.createdAt).toLocaleTimeString("ko-KR")}</span>
            </div>
          )) : <p className="muted empty-state">{t.noChatFailures}</p>}
        </div>
      ) : null}
      {status?.legacyConfigured ? <p className="muted">{t.legacyConfigured}</p> : null}
      {error ? <p className="bad-text">{error}</p> : null}

      <div className="button-row">
        <button onClick={() => connect(false)}>{status?.connected ? t.reconnect : t.connect}</button>
        <button className="secondary" onClick={() => connect(true)}>{t.forceReconnect}</button>
        <button className="secondary" onClick={() => void refresh()} disabled={!status || status.source !== "oauth"}>{t.refresh}</button>
        <button className="secondary" onClick={() => void reconnectEventSub()} disabled={!status}>{t.eventSubReconnect}</button>
        <button className="secondary" onClick={() => void disconnect()} disabled={!status || status.source !== "oauth"}>{t.disconnect}</button>
      </div>
    </div>
  );
}
