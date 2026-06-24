import type { OverlayChannel, OverlayMessage } from "@streamops/shared";
import { validateOverlayMessage } from "@streamops/shared";
import { runtimeConfig } from "./runtime-config";

const WS_BASE = runtimeConfig().wsBase ?? import.meta.env.VITE_WS_BASE ?? "ws://localhost:3000";
const RECONNECT_DELAY_MS = 1500;
const RELOAD_COOLDOWN_MS = 30_000;
const LAST_RELOAD_AT_KEY = "streamops.overlay.lastReloadAt";

function autoReloadEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reload") === "0" || params.get("autoReload") === "0") return false;
  return import.meta.env.VITE_OVERLAY_AUTO_RELOAD !== "false";
}

function lastReloadAt(): number {
  try {
    const value = Number(window.sessionStorage.getItem(LAST_RELOAD_AT_KEY) ?? "0");
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function markReload(now: number): void {
  try {
    window.sessionStorage.setItem(LAST_RELOAD_AT_KEY, String(now));
  } catch {
    // OBS Browser Source 환경에서 storage 접근이 막혀도 reload 기능은 계속 동작합니다.
  }
}

function reloadAfterRecoveredConnection(): boolean {
  if (!autoReloadEnabled()) return false;
  const now = Date.now();
  if (now - lastReloadAt() < RELOAD_COOLDOWN_MS) return false;
  markReload(now);
  window.setTimeout(() => window.location.reload(), 100);
  return true;
}

function overlayTokenFromFragment(): string {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash).get("token") ?? "";
}

export function connectOverlaySocket(
  channel: OverlayChannel,
  onMessage: (message: OverlayMessage) => void,
  onStatus?: (connected: boolean) => void
): () => void {
  let stopped = false;
  let ws: WebSocket | undefined;
  let reconnectTimer: number | undefined;
  let hadConnectionLoss = false;

  function scheduleReconnect() {
    if (stopped) return;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
  }

  function connect() {
    const params = new URLSearchParams({ channel });
    const token = overlayTokenFromFragment();
    reconnectTimer = undefined;
    try {
      ws = new WebSocket(`${WS_BASE}/ws/overlay?${params.toString()}`);
    } catch {
      hadConnectionLoss = true;
      onStatus?.(false);
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      if (token) ws?.send(JSON.stringify({ type: "overlay.auth", token }));
      onStatus?.(true);
      if (hadConnectionLoss) {
        hadConnectionLoss = false;
        reloadAfterRecoveredConnection();
      }
    };
    ws.onclose = () => {
      hadConnectionLoss = true;
      onStatus?.(false);
      scheduleReconnect();
    };
    ws.onerror = () => {
      hadConnectionLoss = true;
      onStatus?.(false);
    };
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as unknown;
        const validation = validateOverlayMessage(parsed);
        if (validation.ok) onMessage(parsed as OverlayMessage);
      } catch {
        // 잘못된 메시지는 public overlay 상태에 반영하지 않습니다.
      }
    };
  }

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    ws?.close();
  };
}
