import type {
  DiscordBotCommandPolicyRequest,
  DiscordBotCommandPolicyResponse
} from "@streamops/shared";
import { DiscordBotControlRepository } from "../database/repositories/discord-bot-control-repository.js";
import type { RepositoryQueryable } from "../database/repositories/types.js";

export class DiscordBotCommandPolicyService {
  private readonly repository: DiscordBotControlRepository;

  constructor(queryable: RepositoryQueryable) {
    this.repository = new DiscordBotControlRepository(queryable);
  }

  resolve(
    input: DiscordBotCommandPolicyRequest
  ): Promise<DiscordBotCommandPolicyResponse> {
    return this.repository.commandPolicy(input);
  }
}
