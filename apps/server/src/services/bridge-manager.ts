import type WebSocket from "ws";
import type { BridgeCommand, BridgeCommandAck, BotAction } from "@streamops/shared";
import { newId, nowIso, toSafeErrorMessage } from "@streamops/shared";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type { Store } from "./store.js";
import type { DashboardHub } from "./dashboard-hub.js";

const BRIDGE_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._ -]{0,63}$/u;
const STREAMER_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

type BridgeConnection = {
  key: string;
  bridgeName: string;
  streamerId?: string;
  socket: WebSocket;
  obsConnected?: boolean;
};

function normalizeBridgeName(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!BRIDGE_NAME_PATTERN.test(normalized)) {
    throw new TypeError("Bridge 이름은 1~64자의 문자, 숫자, 공백, 점, 밑줄 또는 하이픈이어야 합니다.");
  }
  return normalized;
}

function normalizeStreamerId(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (!STREAMER_ID_PATTERN.test(normalized)) {
    throw new TypeError("Bridge streamerId 형식이 올바르지 않습니다.");
  }
  return normalized;
}

function connectionKey(bridgeName: string, streamerId?: string): string {
  return streamerId ? `streamer:${streamerId}` : `bridge:${bridgeName.toLowerCase()}`;
}

export class BridgeManager {
  private readonly connections = new Map<string, BridgeConnection>();

  constructor(
    private readonly logger: JsonlLogger,
    private readonly store: Store,
    private readonly dashboard: DashboardHub
  ) {}

  attach(socket: WebSocket, rawBridgeName: string, rawStreamerId?: string): void {
    const bridgeName = normalizeBridgeName(rawBridgeName);
    const streamerId = normalizeStreamerId(rawStreamerId);
    const key = connectionKey(bridgeName, streamerId);
    const previous = this.connections.get(key);
    const connection: BridgeConnection = { key, bridgeName, streamerId, socket };

    // 새 연결을 먼저 등록해야 이전 socket의 늦은 close가 replacement를 삭제하지 않습니다.
    this.connections.set(key, connection);
    if (previous && previous.socket !== socket && this.socketIsOpen(previous.socket)) {
      try {
        previous.socket.close(4000, "동일한 Bridge 식별자의 새 연결로 교체됨");
      } catch (error) {
        this.logger.error({
          type: "bridge.replacement_close_failed",
          bridgeName,
          streamerId,
          error: toSafeErrorMessage(error)
        });
      }
    }

    this.logger.event({ type: "bridge.connected", bridgeName, streamerId, bridgeCount: this.count() });
    this.syncAggregateStatus();

    socket.on("message", (raw) => {
      if (!this.isCurrentConnection(connection)) return;
      try {
        const payload = JSON.parse(raw.toString()) as BridgeCommandAck | { type: "obs.status"; connected: boolean };
        if ("type" in payload && payload.type === "obs.status") {
          connection.obsConnected = payload.connected;
          this.syncAggregateStatus();
          return;
        }
        this.logger.action({ type: "bridge.ack", bridgeName, streamerId, ...payload });
      } catch (error) {
        this.logger.error({
          type: "bridge.message_parse_failed",
          bridgeName,
          streamerId,
          error: toSafeErrorMessage(error)
        });
      }
    });

    socket.on("close", () => {
      if (!this.isCurrentConnection(connection)) return;
      this.connections.delete(key);
      this.logger.event({ type: "bridge.disconnected", bridgeName, streamerId, bridgeCount: this.count() });
      this.syncAggregateStatus();
    });
  }

  count(): number {
    return this.liveConnections().length;
  }

  isConnected(streamerId?: string): boolean {
    const normalizedStreamerId = normalizeStreamerId(streamerId);
    if (!normalizedStreamerId) return this.liveConnections().length > 0;
    return this.liveConnections().some((connection) => connection.streamerId === normalizedStreamerId);
  }

  send(action: BotAction, reason?: string, targetStreamerId?: string): string {
    const connection = this.resolveConnection(targetStreamerId);
    const command = {
      ...action,
      id: newId("cmd"),
      reason,
      createdAt: nowIso()
    } as BridgeCommand;
    connection.socket.send(JSON.stringify(command));
    return command.id;
  }

  private resolveConnection(targetStreamerId?: string): BridgeConnection {
    const live = this.liveConnections();
    const streamerId = normalizeStreamerId(targetStreamerId);

    if (streamerId) {
      const target = live.find((connection) => connection.streamerId === streamerId);
      if (target) return target;

      // 기존 단일 Bridge 설치만 tenant 정보 없이 그대로 동작하게 합니다.
      if (live.length === 1 && live[0]!.streamerId === undefined) return live[0]!;
      throw new Error("요청한 스트리머의 OBS bridge가 연결되어 있지 않습니다.");
    }

    if (live.length === 1) return live[0]!;
    if (live.length === 0) throw new Error("OBS bridge가 연결되어 있지 않습니다.");
    throw new Error("여러 OBS bridge가 연결되어 있어 대상 스트리머가 필요합니다.");
  }

  private liveConnections(): BridgeConnection[] {
    return [...this.connections.values()].filter((connection) => this.socketIsOpen(connection.socket));
  }

  private socketIsOpen(socket: WebSocket): boolean {
    return socket.readyState === socket.OPEN;
  }

  private isCurrentConnection(connection: BridgeConnection): boolean {
    return this.connections.get(connection.key)?.socket === connection.socket;
  }

  private syncAggregateStatus(): void {
    const live = this.liveConnections();
    let obs: "connected" | "disconnected" | "unknown" = "unknown";
    if (live.length > 0 && live.every((connection) => connection.obsConnected === true)) {
      obs = "connected";
    } else if (live.length > 0 && live.every((connection) => connection.obsConnected === false)) {
      obs = "disconnected";
    }
    this.store.patchStatus({
      bridge: live.length > 0 ? "connected" : "disconnected",
      obs
    });
    this.dashboard.broadcastSnapshot();
  }
}
