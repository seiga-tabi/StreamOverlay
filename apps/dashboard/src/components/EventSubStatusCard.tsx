import { useEffect, useState } from "react";
import type { TwitchConnectionStatus, TwitchEventSubStatus } from "@streamops/shared";
import { apiGet, apiPost } from "../api/client";

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
    failed: "EventSub 요청에 실패했습니다."
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
    failed: "EventSub リクエストに失敗しました。"
  }
} as const;

const t = i18n.ko;

function websocketClass(status?: TwitchEventSubStatus): string {
  if (status?.websocket === "connected") return "good";
  if (status?.websocket === "reconnecting" || status?.websocket === "disabled") return "neutral";
  return "bad";
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString("ko-KR") : t.none;
}

export function EventSubStatusCard() {
  const [status, setStatus] = useState<TwitchConnectionStatus>();
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    setStatus(await apiGet<TwitchConnectionStatus>("/api/twitch/status"));
  }

  useEffect(() => {
    void loadStatus().catch(() => undefined);
    const timer = window.setInterval(() => void loadStatus().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function reconnect() {
    setBusy(true);
    try {
      const next = await apiPost<TwitchConnectionStatus>("/api/twitch/eventsub/reconnect", {});
      setStatus(next);
      alert(t.requested);
    } catch {
      alert(t.failed);
    } finally {
      setBusy(false);
    }
  }

  const eventSub = status?.eventSub;
  const eventSubDisabled = eventSub?.websocket === "disabled";

  return (
    <div className="card">
      <div className="card-title-row">
        <div>
          <h2>{t.title}</h2>
          <p className="muted">{t.description}</p>
        </div>
        <span className={`queue-status ${websocketClass(eventSub)}`}>{eventSub?.websocket ?? "unknown"}</span>
      </div>
      <div className="metric-grid compact">
        <div>
          <span className="muted">{t.activeSubscriptions}</span>
          <strong>{eventSub?.activeSubscriptions ?? 0}</strong>
        </div>
        <div>
          <span className="muted">{t.failedSubscriptions}</span>
          <strong>{eventSub?.failedSubscriptions.length ?? 0}</strong>
        </div>
        <div>
          <span className="muted">{t.lastEventAt}</span>
          <strong>{formatDate(eventSub?.lastEventAt)}</strong>
        </div>
        <div>
          <span className="muted">{t.sessionId}</span>
          <code>{eventSub?.sessionId ?? t.none}</code>
        </div>
      </div>
      {eventSub?.missingScopes.length ? (
        <div className="scope-warning">
          <strong>{t.missingScopes}</strong>
          <div className="chips">{eventSub.missingScopes.map((scope) => <code key={scope}>{scope}</code>)}</div>
        </div>
      ) : null}
      {eventSubDisabled ? (
        <div className="scope-warning">
          <strong>{t.disabledWarning}</strong>
        </div>
      ) : null}
      <div className="subscription-list">
        <span className="muted">{t.subscriptions}</span>
        {eventSub?.subscriptions.length ? eventSub.subscriptions.map((subscription) => (
          <div className="subscription-row" key={subscription.type}>
            <span>
              <strong>{subscription.type}</strong>
              <small className="muted">{subscription.error ?? subscription.subscribedAt ?? subscription.version}</small>
            </span>
            <span className={`queue-status ${subscription.status === "active" ? "good" : subscription.status === "failed" ? "bad" : "neutral"}`}>
              {subscription.status}
            </span>
          </div>
        )) : <p className="muted empty-state">{t.none}</p>}
      </div>
      <div className="button-row">
        <button onClick={() => void reconnect()} disabled={busy}>{t.reconnect}</button>
      </div>
    </div>
  );
}
