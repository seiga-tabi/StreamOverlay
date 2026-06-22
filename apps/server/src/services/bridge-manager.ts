import type WebSocket from "ws";
import type { BridgeCommand, BridgeCommandAck, BotAction } from "@streamops/shared";
import { newId, nowIso, toSafeErrorMessage } from "@streamops/shared";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type { Store } from "./store.js";
import type { DashboardHub } from "./dashboard-hub.js";

export class BridgeManager {
  private socket?: WebSocket;
  private bridgeName?: string;

  constructor(
    private readonly logger: JsonlLogger,
    private readonly store: Store,
    private readonly dashboard: DashboardHub
  ) {}

  attach(socket: WebSocket, bridgeName: string): void {
    if (this.socket && this.socket.readyState === this.socket.OPEN) {
      this.socket.close(4000, "replaced by new bridge connection");
    }
    this.socket = socket;
    this.bridgeName = bridgeName;
    this.store.patchStatus({ bridge: "connected" });
    this.logger.event({ type: "bridge.connected", bridgeName });
    this.dashboard.broadcastSnapshot();

    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as BridgeCommandAck | { type: "obs.status"; connected: boolean };
        if ("type" in payload && payload.type === "obs.status") {
          this.store.patchStatus({ obs: payload.connected ? "connected" : "disconnected" });
          this.dashboard.broadcastSnapshot();
          return;
        }
        this.logger.action({ type: "bridge.ack", ...payload });
      } catch (error) {
        this.logger.error({ type: "bridge.message_parse_failed", error: toSafeErrorMessage(error) });
      }
    });

    socket.on("close", () => {
      if (this.socket === socket) {
        this.socket = undefined;
        this.bridgeName = undefined;
        this.store.patchStatus({ bridge: "disconnected", obs: "unknown" });
        this.logger.event({ type: "bridge.disconnected" });
        this.dashboard.broadcastSnapshot();
      }
    });
  }

  isConnected(): boolean {
    return !!this.socket && this.socket.readyState === this.socket.OPEN;
  }

  send(action: BotAction, reason?: string): string {
    if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
      throw new Error("bridge is not connected");
    }
    const command = {
      ...action,
      id: newId("cmd"),
      reason,
      createdAt: nowIso()
    } as BridgeCommand;
    this.socket.send(JSON.stringify(command));
    return command.id;
  }
}
