import {
  DISCORD_INTERNAL_AUTH_DIRECTORY,
  DiscordInternalAuthBootstrapError,
  bootstrapDiscordInternalAuth
} from "../services/discord-internal-auth-bootstrap.js";

const SERVER_UID = 10_001;
const BOT_UID = 10_002;

try {
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    throw new DiscordInternalAuthBootstrapError("permission_denied");
  }
  const result = bootstrapDiscordInternalAuth({
    directory: DISCORD_INTERNAL_AUTH_DIRECTORY,
    serverUid: SERVER_UID,
    serverGid: SERVER_UID,
    botUid: BOT_UID,
    botGid: BOT_UID
  });
  process.stdout.write(`${JSON.stringify({
    type: "discord.internal_auth_ready",
    keyStatus: result.keyStatus
  })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    type: "discord.internal_auth_unavailable",
    errorCode: error instanceof DiscordInternalAuthBootstrapError
      ? error.code
      : "write_failed"
  })}\n`);
  process.exitCode = 1;
}
