import OBSWebSocket from "obs-websocket-js";
import type { BridgeCommand } from "@streamops/shared";
import { sleep, toSafeErrorMessage } from "@streamops/shared";
import { bridgeConfig } from "./config.js";

export class ObsController {
  private readonly obs = new OBSWebSocket();
  private connected = false;

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    try {
      await this.obs.connect(bridgeConfig.obsUrl, bridgeConfig.obsPassword || undefined);
      this.connected = true;
      console.log("Connected to OBS WebSocket.");
    } catch (error) {
      this.connected = false;
      console.error("OBS connection failed:", toSafeErrorMessage(error));
      throw error;
    }
  }

  async ensureConnected(): Promise<void> {
    if (!this.connected) await this.connect();
  }

  async execute(command: BridgeCommand): Promise<void> {
    await this.ensureConnected();
    switch (command.type) {
      case "obs.setScene":
        await this.obs.call("SetCurrentProgramScene", { sceneName: command.sceneName });
        return;
      case "obs.showSource":
        await this.setSceneItemEnabled(command.sceneName, command.sourceName, true);
        if (command.durationMs && command.durationMs > 0) {
          await sleep(command.durationMs);
          await this.setSceneItemEnabled(command.sceneName, command.sourceName, false);
        }
        return;
      case "obs.hideSource":
        await this.setSceneItemEnabled(command.sceneName, command.sourceName, false);
        return;
      case "obs.toggleSource":
        await this.setSceneItemEnabled(command.sceneName, command.sourceName, true);
        if (command.durationMs && command.durationMs > 0) {
          await sleep(command.durationMs);
          await this.setSceneItemEnabled(command.sceneName, command.sourceName, false);
        }
        return;
      case "obs.saveReplayBuffer":
        await this.obs.call("SaveReplayBuffer");
        return;
      case "obs.setInputMute":
        await this.obs.call("SetInputMute", { inputName: command.inputName, inputMuted: command.muted });
        return;
      case "obs.setText":
        await this.obs.call("SetInputSettings", { inputName: command.inputName, inputSettings: { text: command.text }, overlay: true });
        return;
      case "obs.playMedia":
        await this.obs.call("TriggerMediaInputAction", { inputName: command.inputName, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" });
        return;
      default:
        throw new Error(`지원하지 않는 OBS command입니다: ${(command as { type: string }).type}`);
    }
  }

  private async setSceneItemEnabled(sceneName: string, sourceName: string, enabled: boolean): Promise<void> {
    const item = await this.obs.call("GetSceneItemId", { sceneName, sourceName });
    await this.obs.call("SetSceneItemEnabled", { sceneName, sceneItemId: item.sceneItemId, sceneItemEnabled: enabled });
  }
}
