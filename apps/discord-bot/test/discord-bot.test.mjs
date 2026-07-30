import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  GatewayIntentBits,
  Events,
  MessageFlags,
  PermissionFlagsBits
} from "discord.js";
import { yoroCommandJson } from "../dist/commands.js";
import {
  hasSetupPermission,
  YoroCommandHandler
} from "../dist/command-handler.js";
import { createDiscordClient, DiscordGateway } from "../dist/gateway.js";
import { DiscordBotHealth } from "../dist/health.js";
import {
  DiscordInternalApiClient,
  DiscordInternalApiError
} from "../dist/internal-api-client.js";

const IDS = {
  application: "100000000000000001",
  guild: "100000000000000002",
  interaction: "100000000000000003",
  user: "100000000000000004"
};

function inspectConfig(environment) {
  return spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import('./dist/config.js').then(({validateBotConfig})=>process.stdout.write(JSON.stringify(validateBotConfig())))"
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      ...environment
    }
  });
}

function interaction(input = {}) {
  const calls = { reply: [], deferReply: [], editReply: [] };
  const { inGuild = true, ...overrides } = input;
  const value = {
    id: IDS.interaction,
    commandName: "yoro",
    locale: "ko",
    guildId: IDS.guild,
    guild: { ownerId: "different" },
    user: { id: IDS.user },
    memberPermissions: { bitfield: PermissionFlagsBits.ManageGuild },
    options: { getSubcommand: () => input.subcommand ?? "setup" },
    inGuild: () => inGuild,
    reply: async (payload) => calls.reply.push(payload),
    deferReply: async (payload) => calls.deferReply.push(payload),
    editReply: async (payload) => calls.editReply.push(payload),
    ...overrides
  };
  return { value, calls };
}

test("command manifest는 실제 제공하는 setup, help, dashboard만 등록한다", () => {
  assert.equal(yoroCommandJson.name, "yoro");
  assert.deepEqual(
    yoroCommandJson.options?.map((option) => option.name),
    ["setup", "help", "dashboard"]
  );
  assert.equal(yoroCommandJson.dm_permission, false);
  assert.equal(yoroCommandJson.default_member_permissions, undefined);
});

test("/yoro dashboard는 token 없는 고정 canonical URL을 ephemeral로 제공한다", async () => {
  const { value, calls } = interaction({ subcommand: "dashboard" });
  const handler = new YoroCommandHandler(
    IDS.application,
    { async issueSetupSession() { throw new Error("호출되면 안 됩니다."); } },
    Date.now,
    "https://yoro.gg/dashboard/organizations"
  );
  await handler.handle(value);
  assert.equal(calls.reply[0].flags, MessageFlags.Ephemeral);
  assert.deepEqual(calls.reply[0].allowedMentions, { parse: [] });
  const component = calls.reply[0].components[0].toJSON();
  assert.equal(component.components[0].url, "https://yoro.gg/dashboard/organizations");
  assert.equal(new URL(component.components[0].url).search, "");
});

test("Gateway client는 privileged intent 없이 GUILDS만 요청한다", () => {
  const client = createDiscordClient();
  assert.equal(client.options.intents.has(GatewayIntentBits.Guilds), true);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildMembers), false);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildPresences), false);
  assert.equal(client.options.intents.has(GatewayIntentBits.MessageContent), false);
  client.destroy();
});

test("Gateway lifecycle은 READY·RESUME과 설치 관찰을 분리된 health에 반영한다", async () => {
  class FakeClient extends EventEmitter {
    constructor() {
      super();
      this.guilds = { cache: new Map([[IDS.guild, { id: IDS.guild }]]) };
      this.ws = { ping: 42 };
      this.ready = true;
    }
    isReady() {
      return this.ready;
    }
    destroy() {
      this.ready = false;
    }
  }
  const client = new FakeClient();
  const health = new DiscordBotHealth();
  const observations = [];
  const gateway = new DiscordGateway({
    applicationId: IDS.application,
    client,
    commandHandler: { async handle() {} },
    health,
    internalApi: {
      async observeInstallation(input) {
        observations.push(["observed", input]);
      },
      async revokeInstallation(input) {
        observations.push(["revoked", input]);
      }
    }
  });

  client.emit(Events.ClientReady, client);
  client.emit(Events.ShardResume, 0, 1);
  client.emit(Events.GuildCreate, { id: IDS.guild });
  client.emit(Events.GuildDelete, { id: IDS.guild });
  await new Promise((resolve) => setImmediate(resolve));

  const snapshot = health.snapshot({
    version: "0.1.0-test",
    gitSha: "0".repeat(40),
    builtAt: "2026-07-29T00:00:00.000Z"
  });
  assert.equal(snapshot.state, "ready");
  assert.equal(snapshot.gatewayConnected, true);
  assert.equal(snapshot.reconnectCount, 1);
  assert.equal(observations.filter(([type]) => type === "observed").length, 2);
  assert.equal(observations.filter(([type]) => type === "revoked").length, 1);
  await gateway.stop();
});

test("Bot 설정은 기본 비활성이고 production secret file 경계를 강제한다", () => {
  const disabled = inspectConfig({
    NODE_ENV: "production",
    DISCORD_BOT_ENABLED: "false"
  });
  assert.equal(disabled.status, 0, disabled.stderr);
  assert.deepEqual(JSON.parse(disabled.stdout), []);

  const directToken = "discord_bot_token_should_not_be_logged_123456789";
  const rejected = inspectConfig({
    NODE_ENV: "production",
    DISCORD_BOT_ENABLED: "true",
    DISCORD_BOT_TOKEN: directToken,
    DISCORD_BOT_INTERNAL_AUTH_KEY: "i".repeat(64)
  });
  assert.notEqual(rejected.status, 0);
  assert.doesNotMatch(rejected.stderr, new RegExp(directToken, "u"));

  const directory = mkdtempSync(path.join(tmpdir(), "streamops-discord-bot-config-"));
  const tokenPath = path.join(directory, "token");
  const internalKeyPath = path.join(directory, "internal-key");
  try {
    writeFileSync(tokenPath, "discord_bot_token_for_config_validation_123456789", { mode: 0o400 });
    writeFileSync(internalKeyPath, "i".repeat(64), { mode: 0o400 });
    const valid = inspectConfig({
      NODE_ENV: "production",
      DISCORD_BOT_ENABLED: "true",
      DISCORD_BOT_TOKEN_FILE: tokenPath,
      DISCORD_BOT_INTERNAL_AUTH_KEY_FILE: internalKeyPath,
      DISCORD_APPLICATION_ID: IDS.application,
      DISCORD_BOT_INTERNAL_BASE_URL: "http://server:3000",
      DISCORD_BOT_PUBLIC_BASE_URL: "https://yoro.gg"
    });
    assert.equal(valid.status, 0, valid.stderr);
    assert.deepEqual(JSON.parse(valid.stdout), []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("setup 권한은 owner, ADMINISTRATOR, MANAGE_GUILD만 허용한다", () => {
  assert.equal(hasSetupPermission({
    guild: { ownerId: IDS.user },
    user: { id: IDS.user },
    memberPermissions: null
  }), true);
  for (const bitfield of [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild]) {
    assert.equal(hasSetupPermission({
      guild: { ownerId: "different" },
      user: { id: IDS.user },
      memberPermissions: { bitfield }
    }), true);
  }
  assert.equal(hasSetupPermission({
    guild: { ownerId: "different" },
    user: { id: IDS.user },
    memberPermissions: { bitfield: 0n }
  }), false);
});

test("/yoro setup은 먼저 ephemeral defer하고 일회용 link button으로 갱신한다", async () => {
  const { value, calls } = interaction();
  let issued;
  const handler = new YoroCommandHandler(IDS.application, {
    async issueSetupSession(input) {
      issued = input;
      return {
        url: "https://yoro.gg/dashboard/organizations?setup=abcdefghijklmnopqrstuvwxyzABCDEFGH",
        expiresAt: "2026-07-29T00:10:00.000Z"
      };
    }
  });
  await handler.handle(value);
  assert.deepEqual(issued, {
    applicationId: IDS.application,
    guildId: IDS.guild,
    interactionId: IDS.interaction,
    userId: IDS.user
  });
  assert.equal(calls.deferReply[0].flags, MessageFlags.Ephemeral);
  assert.deepEqual(calls.editReply[0].allowedMentions, { parse: [] });
  assert.equal(calls.editReply[0].components.length, 1);
  assert.match(calls.editReply[0].content, /웹 Dashboard/u);
  assert.match(calls.editReply[0].content, /10분 후 만료/u);
});

test("DM과 일반 member의 setup 요청은 ephemeral로 차단한다", async () => {
  const internalApi = {
    async issueSetupSession() {
      throw new Error("호출되면 안 됩니다.");
    }
  };
  const dm = interaction({ inGuild: false, guildId: null, guild: null });
  await new YoroCommandHandler(IDS.application, internalApi).handle(dm.value);
  assert.equal(dm.calls.reply[0].flags, MessageFlags.Ephemeral);

  const member = interaction({ memberPermissions: { bitfield: 0n } });
  await new YoroCommandHandler(IDS.application, internalApi).handle(member.value);
  assert.equal(member.calls.reply[0].flags, MessageFlags.Ephemeral);
  assert.equal(member.calls.deferReply.length, 0);
});

test("같은 interaction 재전달은 setup session을 중복 생성하지 않는다", async () => {
  const { value } = interaction();
  let calls = 0;
  const handler = new YoroCommandHandler(IDS.application, {
    async issueSetupSession() {
      calls += 1;
      return {
        url: "https://yoro.gg/dashboard/organizations?setup=abcdefghijklmnopqrstuvwxyzABCDEFGH",
        expiresAt: "2026-07-29T00:10:00.000Z"
      };
    }
  });
  await handler.handle(value);
  await handler.handle(value);
  assert.equal(calls, 1);
});

test("내부 API client는 body·method·path에 귀속된 HMAC을 전송한다", async () => {
  const requests = [];
  const client = new DiscordInternalApiClient({
    authKey: "i".repeat(64),
    baseUrl: "http://server:3000",
    publicBaseUrl: "https://yoro.gg",
    timeoutMs: 1000,
    now: () => 1_800_000_000_000,
    randomBytes: () => Buffer.alloc(24, 7),
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        url: "https://yoro.gg/dashboard/organizations?setup=abcdefghijklmnopqrstuvwxyzABCDEFGH",
        expiresAt: "2027-01-15T08:10:00.000Z"
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
  });
  await client.issueSetupSession({
    applicationId: IDS.application,
    guildId: IDS.guild,
    interactionId: IDS.interaction,
    userId: IDS.user
  });
  const request = requests[0];
  assert.equal(request.url, "http://server:3000/internal/discord/setup-sessions");
  assert.match(request.init.headers["X-YORO-Auth-Signature"], /^[a-f0-9]{64}$/u);
  assert.equal(
    crypto.createHash("sha256").update(request.init.body).digest("hex").length,
    64
  );
});

test("내부 API client는 다른 origin이나 비정상 setup URL을 거부한다", async () => {
  const client = new DiscordInternalApiClient({
    authKey: "i".repeat(64),
    baseUrl: "http://server:3000",
    publicBaseUrl: "https://yoro.gg",
    timeoutMs: 1000,
    fetchImpl: async () => new Response(JSON.stringify({
      url: "https://evil.example/dashboard/organizations?setup=abcdefghijklmnopqrstuvwxyzABCDEFGH",
      expiresAt: "2027-01-15T08:10:00.000Z"
    }), { status: 201 })
  });
  await assert.rejects(
    () => client.issueSetupSession({
      applicationId: IDS.application,
      guildId: IDS.guild,
      interactionId: IDS.interaction,
      userId: IDS.user
    }),
    (error) => error instanceof DiscordInternalApiError
      && error.code === "invalid_response"
  );
});
