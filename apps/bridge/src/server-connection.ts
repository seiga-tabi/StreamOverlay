import WebSocket from "ws";
import { nowIso, toSafeErrorMessage } from "@streamops/shared";
import type { ObsController } from "./obs.js";
import { bridgeConfig } from "./config.js";
import { validateBridgeCommand } from "./validator.js";

const MAX_SERVER_MESSAGE_BYTES = 64 * 1024;

export class ServerConnection {
  private socket?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(private readonly obs: ObsController) {}

  start(): void {
    this.connect();
  }

  private connect(): void {
    const url = new URL(bridgeConfig.serverWsUrl);
    url.searchParams.set("name", bridgeConfig.bridgeName);
    this.socket = new WebSocket(url.toString(), {
      headers: {
        Authorization: `Bearer ${bridgeConfig.sharedSecret}`
      }
    });

    this.socket.on("open", () => {
      console.log(`Connected to server: ${url.origin}`);
      this.reportObsStatus();
    });

    this.socket.on("message", (raw) => void this.handleMessage(raw.toString()));
    this.socket.on("close", () => {
      console.warn("Server connection closed. Reconnecting...");
      this.scheduleReconnect();
    });
    this.socket.on("error", (error) => {
      console.error("Server connection error:", toSafeErrorMessage(error));
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, 5000);
  }

  private async handleMessage(raw: string): Promise<void> {
    if (Buffer.byteLength(raw, "utf8") > MAX_SERVER_MESSAGE_BYTES) {
      this.send({ id: "unknown", ok: false, error: "서버 메시지가 너무 큽니다.", executedAt: nowIso() });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      console.error("Invalid server message:", toSafeErrorMessage(error));
      return;
    }
    const validation = validateBridgeCommand(payload);
    if (!validation.ok) {
      this.send({ id: (payload as { id?: string })?.id ?? "unknown", ok: false, error: validation.error, executedAt: nowIso() });
      return;
    }
    try {
      await this.obs.execute(validation.command);
      this.send({ id: validation.command.id, ok: true, executedAt: nowIso() });
      this.reportObsStatus();
    } catch (error) {
      this.send({ id: validation.command.id, ok: false, error: toSafeErrorMessage(error), executedAt: nowIso() });
      this.reportObsStatus();
    }
  }

  private reportObsStatus(): void {
    this.send({ type: "obs.status", connected: this.obs.isConnected() });
  }

  private send(payload: unknown): void {
    if (this.socket && this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}
