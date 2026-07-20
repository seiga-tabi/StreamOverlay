import type { OverlayChannel, OverlayMessage } from "@streamops/shared";
import { validateOverlayMessage } from "@streamops/shared";
import { runtimeConfig } from "./runtime-config";

const WS_BASE = runtimeConfig().wsBase ?? import.meta.env.VITE_WS_BASE ?? "ws://localhost:3000";
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10_000;

function overlayTokenFromFragment(): string {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get("token")
    ?? hashParams.get("key")
    ?? searchParams.get("token")
    ?? searchParams.get("key")
    ?? "";
}

function overlayStreamerSlugFromPath(): string {
  const segments = window.location.pathname.split("/").map((part) => part.trim()).filter(Boolean);
  const slug = segments[0] === "overlay" ? segments[1] : segments.length === 1 && segments[0] !== "assets" ? segments[0] : "";
  return slug ? decodeURIComponent(slug).trim().toLowerCase() : "";
}

export function connectOverlaySocket(
  channel: OverlayChannel,
  onMessage: (message: OverlayMessage) => void,
  onStatus?: (connected: boolean) => void
): () => void {
  let stopped = false;
  let ws: WebSocket | undefined;
  let reconnectTimer: number | undefined;
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;

  function scheduleReconnect() {
    if (stopped) return;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connect, reconnectDelayMs);
    reconnectDelayMs = Math.min(MAX_RECONNECT_DELAY_MS, reconnectDelayMs * 2);
  }

  function connect() {
    const params = new URLSearchParams({ channel });
    const token = overlayTokenFromFragment();
    const streamerSlug = overlayStreamerSlugFromPath();
    if (streamerSlug) params.set("streamer", streamerSlug);
    reconnectTimer = undefined;
    try {
      ws = new WebSocket(`${WS_BASE}/ws/overlay?${params.toString()}`);
    } catch {
      onStatus?.(false);
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      if (token) ws?.send(JSON.stringify({ type: "overlay.auth", token }));
      onStatus?.(true);
    };
    ws.onclose = () => {
      onStatus?.(false);
      scheduleReconnect();
    };
    ws.onerror = () => {
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
