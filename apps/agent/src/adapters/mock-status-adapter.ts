import type { PalworldCollectedStatus, PalworldStatusAdapter } from "./palworld-status-adapter.js";
import { PalworldAdapterError } from "./palworld-status-adapter.js";

export class MockPalworldStatusAdapter implements PalworldStatusAdapter {
  constructor(
    private readonly state: "online" | "offline" | "invalid" | "timeout"
  ) {}

  async collect(signal: AbortSignal): Promise<PalworldCollectedStatus> {
    if (this.state === "timeout") {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 60_000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason ?? new Error("aborted"));
        }, { once: true });
      });
      throw new PalworldAdapterError("palworld_timeout");
    }
    if (this.state === "invalid") {
      throw new PalworldAdapterError("palworld_invalid_response");
    }
    if (this.state === "offline") {
      return Object.freeze({ online: false, players: 0, maxPlayers: 16 });
    }
    return Object.freeze({
      online: true,
      players: 2,
      maxPlayers: 16,
      gameVersion: "mock-1",
      uptimeSeconds: 3_600,
      latencyMs: 1
    });
  }
}
