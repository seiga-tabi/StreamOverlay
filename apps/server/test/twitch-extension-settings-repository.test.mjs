import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { TwitchExtensionSettingsRepository } from "../dist/database/repositories/twitch-extension-settings-repository.js";

test("Twitch Extension 설정 조회는 row가 없을 때 안전한 기본값을 반환한다", async () => {
  const repository = new TwitchExtensionSettingsRepository({
    async query() {
      return { rows: [], rowCount: 0 };
    }
  });
  const settings = await repository.readForOwner({
    userId: crypto.randomUUID(),
    streamerTwitchUserId: "1234",
    connectionState: "configuration_required"
  });
  assert.equal(settings.configured, false);
  assert.equal(settings.display.joinButton, true);
  assert.equal(settings.connectionState, "configuration_required");
  assert.equal(settings.revision, 0);
});

test("Twitch Extension 설정 저장은 소유 계정·채널을 parameter binding하고 revision을 반환한다", async () => {
  const calls = [];
  const repository = new TwitchExtensionSettingsRepository({
    async query(text, values) {
      calls.push({ text, values });
      return {
        rows: [{
          display_join_button: false,
          display_game: true,
          display_waiting_count: true,
          display_my_position: true,
          display_cancel_button: true,
          display_next_state: true,
          inactive_behavior: "message",
          extension_type: "overlay",
          revision: "2",
          updated_at: new Date("2026-08-14T00:00:00.000Z")
        }],
        rowCount: 1
      };
    }
  });
  const userId = crypto.randomUUID();
  const settings = await repository.replace({
    userId,
    streamerTwitchUserId: "1234",
    connectionState: "connected",
    settings: {
      display: {
        joinButton: false,
        game: true,
        waitingCount: true,
        myPosition: true,
        cancelButton: true,
        nextState: true
      },
      inactiveBehavior: "message",
      extensionType: "overlay"
    }
  });
  assert.match(calls[0].text, /ON CONFLICT \(user_id\) DO UPDATE/u);
  assert.deepEqual(calls[0].values.slice(0, 2), [userId, "1234"]);
  assert.equal(settings.configured, true);
  assert.equal(settings.revision, 2);
  assert.equal(settings.updatedAt, "2026-08-14T00:00:00.000Z");
});
