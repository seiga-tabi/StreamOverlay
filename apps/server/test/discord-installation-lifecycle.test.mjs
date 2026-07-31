import assert from "node:assert/strict";
import test from "node:test";
import {
  DiscordOnboardingRepository
} from "../dist/database/repositories/discord-onboarding-repository.js";

const guildId = "123456789012345678";
const applicationId = "234567890123456789";

test("Bot 추방은 관찰과 Organization 설치 상태를 함께 revoked 처리한다", async () => {
  let query;
  const repository = new DiscordOnboardingRepository({
    async query(text, values) {
      query = { text, values };
      return { rows: [] };
    }
  });

  await repository.revokeBotInstallation({ guildId, applicationId });

  assert.deepEqual(query.values, [guildId, applicationId]);
  assert.match(query.text, /INSERT INTO discord_bot_installation_observations/u);
  assert.match(query.text, /status = 'revoked'/u);
  assert.match(query.text, /UPDATE discord_installations/u);
  assert.match(query.text, /SET status = 'revoked', revoked_at = NOW\(\)/u);
  assert.match(query.text, /AND status = 'active'/u);
});

test("같은 Guild에 Bot을 다시 추가하면 기존 revoked 설치를 active로 복구한다", async () => {
  let query;
  const repository = new DiscordOnboardingRepository({
    async query(text, values) {
      query = { text, values };
      return { rows: [] };
    }
  });

  await repository.observeBotInstallation({ guildId, applicationId });

  assert.deepEqual(query.values, [guildId, applicationId]);
  assert.match(query.text, /INSERT INTO discord_bot_installation_observations/u);
  assert.match(query.text, /status = 'observed'/u);
  assert.match(query.text, /UPDATE discord_installations/u);
  assert.match(query.text, /SET status = 'active', revoked_at = NULL/u);
  assert.match(query.text, /AND status = 'revoked'/u);
});
