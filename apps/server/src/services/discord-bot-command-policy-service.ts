import type {
  DiscordBotCommandPolicyRequest,
  DiscordBotCommandPolicyResponse,
  DiscordBotResponseLocaleUpdateRequest,
  DiscordBotResponseLocaleUpdateResponse
} from "@streamops/shared";
import type { Pool } from "pg";
import { withTransaction } from "../database/transaction.js";
import { DiscordBotControlRepository } from "../database/repositories/discord-bot-control-repository.js";

export class DiscordBotCommandPolicyService {
  private readonly repository: DiscordBotControlRepository;

  constructor(private readonly pool: Pool) {
    this.repository = new DiscordBotControlRepository(pool);
  }

  resolve(
    input: DiscordBotCommandPolicyRequest
  ): Promise<DiscordBotCommandPolicyResponse> {
    return this.repository.commandPolicy(input);
  }

  updateResponseLocale(
    input: DiscordBotResponseLocaleUpdateRequest
  ): Promise<DiscordBotResponseLocaleUpdateResponse> {
    return withTransaction(this.pool, (client) =>
      new DiscordBotControlRepository(client).updateResponseLocale(input)
    );
  }
}
