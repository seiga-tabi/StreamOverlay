import WebSocket from "ws";
import { nowIso, toSafeErrorMessage } from "@streamops/shared";
import type { ObsController } from "./obs.js";
import { bridgeConfig } from "./config.js";
import { validateBridgeCommand } from "./validator.js";

const MAX_SERVER_MESSAGE_BYTES = 64 * 1024;
export const BRIDGE_REPLACED_CLOSE_CODE = 4000;
const DEFAULT_RECONNECT_DELAY_MS = 5000;

type ServerConnectionOptions = {
  webSocketFactory?: (url: string, headers: Record<string, string>) => WebSocket;
  reconnectDelayMs?: number;
};

export function buildServerWebSocketUrl(serverWsUrl: string, bridgeName: string, streamerId?: string): URL {
  const url = new URL(serverWsUrl);
  url.searchParams.set("name", bridgeName);
  if (streamerId) url.searchParams.set("streamerId", streamerId);
  return url;
}

export function shouldReconnectAfterServerClose(code: number): boolean {
  return code !== BRIDGE_REPLACED_CLOSE_CODE;
}

export class ServerConnection {
  private socket?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private readonly webSocketFactory: NonNullable<ServerConnectionOptions["webSocketFactory"]>;
  private readonly reconnectDelayMs: number;

  constructor(private readonly obs: ObsController, options: ServerConnectionOptions = {}) {
    this.webSocketFactory = options.webSocketFactory
      ?? ((url, headers) => new WebSocket(url, { headers }));
    this.reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  }

  start(): void {
    this.connect();
  }

  private connect(): void {
    const url = buildServerWebSocketUrl(
      bridgeConfig.serverWsUrl,
      bridgeConfig.bridgeName,
      bridgeConfig.streamerId
    );
    const socket = this.webSocketFactory(url.toString(), {
      Authorization: `Bearer ${bridgeConfig.sharedSecret}`
    });
    this.socket = socket;

    socket.on("open", () => {
      if (this.socket !== socket) return;
      console.log(`서버에 연결되었습니다: ${url.origin}`);
      this.reportObsStatus(socket);
    });

    socket.on("message", (raw) => {
      if (this.socket !== socket) return;
      void this.handleMessage(raw.toString(), socket);
    });
    socket.on("close", (code) => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      if (!shouldReconnectAfterServerClose(code)) {
        console.error(
          "서버가 동일한 Bridge 식별자의 새 연결로 현재 연결을 교체했습니다. "
          + "각 방송 PC의 BRIDGE_NAME이 고유한지, BRIDGE_STREAMER_ID가 올바른 스트리머인지 확인한 뒤 "
          + "Bridge를 다시 시작하세요. 자동 재연결을 중단합니다."
        );
        return;
      }
      console.warn("서버 연결이 종료되었습니다. 5초 후 재연결합니다.");
      this.scheduleReconnect();
    });
    socket.on("error", (error) => {
      if (this.socket !== socket) return;
      console.error("서버 연결 오류:", toSafeErrorMessage(error));
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.reconnectDelayMs);
  }

  private async handleMessage(raw: string, socket: WebSocket): Promise<void> {
    if (Buffer.byteLength(raw, "utf8") > MAX_SERVER_MESSAGE_BYTES) {
      this.send({ id: "unknown", ok: false, error: "서버 메시지가 너무 큽니다.", executedAt: nowIso() }, socket);
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      console.error("잘못된 서버 메시지:", toSafeErrorMessage(error));
      return;
    }
    const validation = validateBridgeCommand(payload);
    if (!validation.ok) {
      this.send({ id: (payload as { id?: string })?.id ?? "unknown", ok: false, error: validation.error, executedAt: nowIso() }, socket);
      return;
    }
    try {
      await this.obs.execute(validation.command);
      this.send({ id: validation.command.id, ok: true, executedAt: nowIso() }, socket);
      this.reportObsStatus(socket);
    } catch (error) {
      this.send({ id: validation.command.id, ok: false, error: toSafeErrorMessage(error), executedAt: nowIso() }, socket);
      this.reportObsStatus(socket);
    }
  }

  private reportObsStatus(socket: WebSocket): void {
    this.send({ type: "obs.status", connected: this.obs.isConnected() }, socket);
  }

  private send(payload: unknown, socket = this.socket): void {
    if (socket && this.socket === socket && socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }
}
