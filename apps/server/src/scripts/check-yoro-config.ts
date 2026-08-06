import fs from "node:fs";
import path from "node:path";
import {
  loadFixedSecret,
  loadYoroRuntimeConfig,
  YORO_SECRET_FILES
} from "../runtime-configuration.js";

const command = process.argv[2] ?? "check";
const projectRoot = path.basename(process.cwd()) === "server"
  && path.basename(path.dirname(process.cwd())) === "apps"
  ? path.resolve(process.cwd(), "..", "..")
  : process.cwd();
const requestedPath = process.env.YORO_CONFIG_FILE?.trim();
const configPath = requestedPath
  ? path.isAbsolute(requestedPath) ? requestedPath : path.resolve(projectRoot, requestedPath)
  : path.resolve(projectRoot, "config", "runtime.development.json");

if (!requestedPath && !fs.existsSync(configPath)) {
  if (command === "explain") {
    const enabled = (name: string): boolean =>
      process.env[name]?.trim().toLowerCase() === "true";
    console.log(`environment: ${process.env.NODE_ENV === "production" ? "production" : "development"}`);
    console.log("configuration: legacy_environment");
    console.log(`database: ${enabled("DATABASE_ENABLED") ? "enabled" : "disabled"}`);
    console.log(`discordSaas: ${enabled("DISCORD_SAAS_ENABLED") ? "enabled" : "disabled"}`);
    console.log(`discordBot: ${enabled("DISCORD_BOT_INTERNAL_API_ENABLED") ? "enabled" : "disabled"}`);
    console.log(`discordBotManagement: ${enabled("DISCORD_BOT_MANAGEMENT_ENABLED") ? "enabled" : "disabled"}`);
    process.exit(0);
  }
  throw new Error("runtime_config_not_configured");
}
const runtime = loadYoroRuntimeConfig(configPath);

const requirements: Array<{
  label: string;
  path: string;
  active: boolean;
  required: boolean;
}> = [
  {
    label: "database",
    path: YORO_SECRET_FILES.databaseUrl,
    active: runtime.features.database,
    required: runtime.features.database
  },
  {
    label: "twitchClientSecret",
    path: YORO_SECRET_FILES.twitchClientSecret,
    active: Boolean(runtime.twitch),
    required: runtime.features.twitchEventSub
  },
  {
    label: "twitchEncryptionKey",
    path: YORO_SECRET_FILES.twitchTokenEncryptionKey,
    active: Boolean(runtime.twitch),
    required: runtime.environment === "production" && Boolean(runtime.twitch)
  },
  {
    label: "riotApi",
    path: YORO_SECRET_FILES.riotApiKey,
    active: Boolean(runtime.riot),
    required: false
  },
  {
    label: "discordClientSecret",
    path: YORO_SECRET_FILES.discordClientSecret,
    active: runtime.features.discordSaas,
    required: runtime.features.discordSaas
  },
  {
    label: "discordOAuthEncryptionKey",
    path: YORO_SECRET_FILES.discordOAuthEncryptionKey,
    active: runtime.features.discordSaas,
    required: runtime.features.discordSaas
  },
  {
    label: "discordInternalAuth",
    path: YORO_SECRET_FILES.discordInternalAuthKey,
    active: runtime.features.discordBot,
    required: runtime.features.discordBot
  },
  {
    label: "dashboardAuth",
    path: YORO_SECRET_FILES.dashboardAuthToken,
    active: runtime.environment === "production",
    required: runtime.environment === "production"
  }
];

if (command === "check") {
  console.log("Runtime config validation passed");
} else if (command === "explain") {
  const configured = new Map<string, boolean>();
  for (const item of requirements.filter((entry) => entry.active)) {
    configured.set(item.label, Boolean(loadFixedSecret(item.path)));
  }
  console.log(`environment: ${runtime.environment}`);
  console.log(`configuration: runtime_file`);
  console.log(`database: ${runtime.features.database ? "enabled" : "disabled"}, ${configured.get("database") ? "configured" : "not configured"}`);
  console.log(`discordSaas: ${runtime.features.discordSaas ? "enabled" : "disabled"}, ${configured.get("discordClientSecret") ? "configured" : "not configured"}`);
  console.log(`discordBot: ${runtime.features.discordBot ? "enabled" : "disabled"}, ${configured.get("discordInternalAuth") ? "configured" : "not configured"}`);
  console.log(`twitchEventSub: ${runtime.features.twitchEventSub ? "enabled" : "disabled"}, ${configured.get("twitchClientSecret") ? "configured" : "not configured"}`);
  console.log(`riotApi: ${runtime.riot ? (configured.get("riotApi") ? "configured" : "not configured") : "disabled"}`);
} else if (command === "secrets") {
  for (const item of requirements.filter((entry) => entry.required)) {
    loadFixedSecret(item.path, { required: true });
    console.log(`${item.label}: configured`);
  }
  console.log("Required secret validation passed");
} else {
  throw new Error("configuration_command_invalid");
}
