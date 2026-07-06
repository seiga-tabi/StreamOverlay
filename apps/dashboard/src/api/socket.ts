import { runtimeConfig } from "../runtime-config";
import type { DashboardAuthSurface } from "./client";

const WS_BASE = runtimeConfig().wsBase ?? import.meta.env.VITE_WS_BASE ?? "ws://localhost:3000";

export function connectDashboardSocket(
  onMessage: (message: any) => void,
  onStatus?: (connected: boolean) => void,
  surface: DashboardAuthSurface = "admin"
): () => void {
  const query = new URLSearchParams({ surface });
  const ws = new WebSocket(`${WS_BASE}/ws/dashboard?${query.toString()}`);
  ws.onopen = () => onStatus?.(true);
  ws.onclose = () => onStatus?.(false);
  ws.onerror = () => onStatus?.(false);
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore malformed UI messages
    }
  };
  return () => ws.close();
}
