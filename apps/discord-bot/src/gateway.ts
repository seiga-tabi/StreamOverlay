import {
  Client,
  Events,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
  type Message
} from "discord.js";
import type { YoroCommandHandler } from "./command-handler.js";
import type { YoroPrefixCommandHandler } from "./prefix-command-handler.js";
import type { DiscordInternalApiClient } from "./internal-api-client.js";
import type { DiscordBotHealth } from "./health.js";
import { auditEvent, safeReference } from "./logger.js";

export function createDiscordClient(prefixCommandsEnabled = false): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      ...(prefixCommandsEnabled
        ? [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
        : [])
    ],
    allowedMentions: { parse: [] }
  });
}

export class DiscordGateway {
  private heartbeatObservation?: NodeJS.Timeout;
  private lastHeartbeatTimestamp = -1;

  constructor(
    private readonly options: {
      applicationId: string;
      client: Client;
      commandHandler: YoroCommandHandler;
      prefixCommandHandler?: YoroPrefixCommandHandler;
      health: DiscordBotHealth;
      internalApi: Pick<
        DiscordInternalApiClient,
        "observeInstallation" | "revokeInstallation"
      >;
    }
  ) {
    this.registerEvents();
  }

  async start(token: string): Promise<void> {
    this.options.health.setState("connecting");
    auditEvent("discord.bot.started");
    try {
      await this.options.client.login(token);
    } catch {
      this.options.health.setState("unavailable");
      auditEvent("discord.bot.disconnected", { result: "authentication_failed" });
      throw new Error("Discord Gateway 인증에 실패했습니다.");
    }
  }

  async stop(): Promise<void> {
    this.options.health.setState("stopping");
    if (this.heartbeatObservation) clearInterval(this.heartbeatObservation);
    this.heartbeatObservation = undefined;
    this.options.client.destroy();
  }

  private registerEvents(): void {
    const {
      client,
      health,
      internalApi,
      commandHandler,
      prefixCommandHandler,
      applicationId
    } = this.options;
    client.once(Events.ClientReady, () => {
      health.setState("ready");
      auditEvent("discord.bot.ready");
      for (const guild of client.guilds.cache.values()) {
        this.observeInstallation(guild.id);
      }
      this.heartbeatObservation = setInterval(() => {
        if (!client.isReady()) return;
        const heartbeatTimestamp = Math.max(
          -1,
          ...client.ws.shards.map((shard) => shard.lastPingTimestamp)
        );
        if (heartbeatTimestamp > this.lastHeartbeatTimestamp) {
          this.lastHeartbeatTimestamp = heartbeatTimestamp;
          health.heartbeatObserved();
        }
      }, 5_000);
      this.heartbeatObservation.unref();
    });
    client.on(Events.ShardResume, () => {
      health.setState("ready");
      health.reconnected();
      auditEvent("discord.bot.resumed");
    });
    client.on(Events.ShardDisconnect, () => {
      health.setState("resuming");
      auditEvent("discord.bot.disconnected");
    });
    client.on(Events.Error, () => {
      if (client.isReady()) health.setState("degraded");
    });
    client.on(Events.GuildCreate, (guild) => {
      this.observeInstallation(guild.id);
    });
    client.on(Events.GuildDelete, (guild) => {
      void internalApi.revokeInstallation({
        applicationId,
        guildId: guild.id
      }).then(() => {
        auditEvent("discord.installation.revoked", {
          guild: safeReference(guild.id)
        });
      }).catch(() => {
        health.setState(client.isReady() ? "degraded" : "unavailable");
      });
    });
    client.on(Events.InteractionCreate, (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      void commandHandler.handle(interaction as ChatInputCommandInteraction).catch(() => {
        auditEvent("discord.command.denied", { result: "handler_failed" });
      });
    });
    if (prefixCommandHandler) {
      client.on(Events.MessageCreate, (message) => {
        void prefixCommandHandler.handle(message as Message).catch(() => {
          auditEvent("discord.prefix_command.denied", { result: "handler_failed" });
        });
      });
    }
  }

  private observeInstallation(guildId: string): void {
    const { client, health, internalApi, applicationId } = this.options;
    void internalApi.observeInstallation({
      applicationId,
      guildId
    }).then(() => {
      if (client.isReady()) health.setState("ready");
      auditEvent("discord.installation.observed", {
        guild: safeReference(guildId)
      });
    }).catch(() => {
      health.setState(client.isReady() ? "degraded" : "unavailable");
    });
  }
}
