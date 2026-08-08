import { botConfig, assertBotConfig } from "./config.js";
import { YoroCommandHandler } from "./command-handler.js";
import { DiscordGateway, createDiscordClient } from "./gateway.js";
import { DiscordBotHealth, startHealthServer } from "./health.js";
import { DiscordInternalApiClient } from "./internal-api-client.js";
import { auditEvent } from "./logger.js";
import { YoroPrefixCommandHandler } from "./prefix-command-handler.js";
import { DiscordAnnouncementPublisher } from "./announcement-publisher.js";

assertBotConfig();

const health = new DiscordBotHealth();
health.setState(botConfig.enabled ? "starting" : "disabled");
const healthServer = await startHealthServer({
  health,
  port: botConfig.healthPort,
  release: botConfig.release
});

let gateway: DiscordGateway | undefined;
if (botConfig.enabled) {
  const internalApi = new DiscordInternalApiClient({
    authKey: botConfig.internalAuthKey,
    baseUrl: botConfig.internalBaseUrl,
    publicBaseUrl: botConfig.publicBaseUrl,
    timeoutMs: botConfig.requestTimeoutMs
  });
  const client = createDiscordClient(botConfig.prefixCommandsEnabled);
  gateway = new DiscordGateway({
    applicationId: botConfig.applicationId,
    client,
    commandHandler: new YoroCommandHandler(
      botConfig.applicationId,
      internalApi,
      Date.now,
      new URL("/dashboard/organizations", botConfig.publicBaseUrl).toString(),
      botConfig.prefixCommandsEnabled
    ),
    ...(botConfig.prefixCommandsEnabled
      ? {
          prefixCommandHandler: new YoroPrefixCommandHandler(
            botConfig.applicationId,
            internalApi,
            botConfig.publicBaseUrl
          )
        }
      : {}),
    ...(botConfig.participationAnnounceEnabled
      ? {
          announcements: new DiscordAnnouncementPublisher({
            applicationId: botConfig.applicationId,
            client,
            internalApi
          })
        }
      : {}),
    health,
    internalApi
  });
  try {
    await gateway.start(botConfig.token);
  } catch {
    client.destroy();
    // 잘못된 token으로 컨테이너가 무한 재시작되지 않도록 health만 unavailable로 유지합니다.
  }
}

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  auditEvent("discord.bot.disconnected", { result: signal });
  await gateway?.stop();
  await new Promise<void>((resolve) => healthServer.close(() => resolve()));
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal).finally(() => process.exit(0));
  });
}
