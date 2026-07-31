import test from "node:test";
import assert from "node:assert/strict";
import { DiscordBotControlRepository } from "../dist/database/repositories/discord-bot-control-repository.js";

test("저장된 Discord Bot 설정은 플레이어 명령 상태까지 다시 조회한다", async () => {
  let controlQuery = "";
  const queryable = {
    async query(text) {
      if (text.includes("FROM discord_installations installation")) {
        return {
          rows: [{
            discord_guild_id: "123456789012345678",
            guild_display_name: "검증 Discord 서버",
            application_id: "234567890123456789"
          }]
        };
      }
      if (text.includes("FROM discord_bot_control_configs")) {
        controlQuery = text;
        return {
          rows: [{
            public_commands_enabled: true,
            palworld_status_enabled: true,
            status_command_enabled: true,
            player_command_enabled: false,
            guide_command_enabled: true,
            delete_invocation_after_reply: true,
            preferred_locale: "ko",
            show_players: true,
            show_version: true,
            show_latency: false,
            show_observed_at: true,
            revision: "3"
          }]
        };
      }
      throw new Error("예상하지 않은 query입니다.");
    }
  };

  const overview = await new DiscordBotControlRepository(queryable).overview({
    context: {
      organizationId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "22222222-2222-4222-8222-222222222222"
    },
    role: "owner",
    applicationId: "234567890123456789",
    globalPrefixCommandsEnabled: true
  });

  assert.match(controlQuery, /\bplayer_command_enabled\b/u);
  assert.match(controlQuery, /\bdelete_invocation_after_reply\b/u);
  assert.equal(overview.settings.playerCommandEnabled, false);
  assert.equal(overview.settings.deleteInvocationAfterReply, true);
  assert.equal(overview.settings.revision, 3);
});
