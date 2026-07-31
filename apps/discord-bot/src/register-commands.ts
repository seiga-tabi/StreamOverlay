import {
  ApplicationCommandType,
  REST,
  Routes,
  type RESTGetAPIApplicationCommandsResult
} from "discord.js";
import { comparableDiscordCommand } from "./command-registration-comparison.js";
import { assertBotConfig, botConfig } from "./config.js";
import { yoroCommandJson } from "./commands.js";

assertBotConfig();
const operation = process.argv[2] ?? "plan";
if (!["plan", "apply"].includes(operation)) {
  throw new Error("commands:plan 또는 commands:apply만 사용할 수 있습니다.");
}
const apply = operation === "apply" && process.argv.includes("--apply");
if (operation === "apply" && !apply) {
  throw new Error("command 등록에는 --apply가 필요합니다.");
}
if (
  apply
  && botConfig.production
  && !process.argv.includes("--confirm-production=REGISTER_YORO_COMMANDS")
) {
  throw new Error("production command 등록에는 명시적인 확인 값이 필요합니다.");
}

const rest = new REST({ version: "10" }).setToken(botConfig.token);
const collectionRoute = botConfig.testGuildId
  ? Routes.applicationGuildCommands(botConfig.applicationId, botConfig.testGuildId)
  : Routes.applicationCommands(botConfig.applicationId);
const existing = await rest.get(collectionRoute) as RESTGetAPIApplicationCommandsResult;
const current = existing.find((command) =>
  command.type === ApplicationCommandType.ChatInput
  && command.name === yoroCommandJson.name
);
const changed = !current
  || JSON.stringify(comparableDiscordCommand(current))
    !== JSON.stringify(comparableDiscordCommand(yoroCommandJson));

process.stdout.write(`${JSON.stringify({
  command: "yoro",
  scope: botConfig.testGuildId ? "guild" : "global",
  action: current ? (changed ? "update" : "none") : "create",
  preservedUnknownCommands: existing.filter((command) => command.name !== "yoro").length
})}\n`);

if (apply && changed) {
  if (current) {
    const route = botConfig.testGuildId
      ? Routes.applicationGuildCommand(botConfig.applicationId, botConfig.testGuildId, current.id)
      : Routes.applicationCommand(botConfig.applicationId, current.id);
    await rest.patch(route, { body: yoroCommandJson });
  } else {
    await rest.post(collectionRoute, { body: yoroCommandJson });
  }
  process.stdout.write('{"result":"applied"}\n');
}
