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
import {
  localizedPublicResourceUrl,
  parseYoroPrefixCommand,
  YoroPrefixCommandHandler
} from "../dist/prefix-command-handler.js";
import { presentPalworldPlayers } from "../dist/player-message-presenter.js";
import { discordProgressGauge } from "../dist/status-message-presenter.js";

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
    options: {
      getSubcommand: () => input.subcommand ?? "setup",
      getString: (name) => name === "nickname" ? input.nickname ?? null : null
    },
    inGuild: () => inGuild,
    reply: async (payload) => calls.reply.push(payload),
    deferReply: async (payload) => calls.deferReply.push(payload),
    editReply: async (payload) => calls.editReply.push(payload),
    ...overrides
  };
  return { value, calls };
}

test("command manifest는 관리 명령과 작성자 전용 Palworld 조회 명령만 등록한다", () => {
  assert.equal(yoroCommandJson.name, "yoro");
  assert.deepEqual(
    yoroCommandJson.options?.map((option) => option.name),
    ["setup", "help", "dashboard", "status", "player", "guide"]
  );
  const player = yoroCommandJson.options?.find(
    (option) => option.name === "player"
  );
  assert.deepEqual(player?.options?.map((option) => option.name), ["nickname"]);
  assert.equal(player?.options?.[0]?.max_length, 80);
  assert.equal(yoroCommandJson.dm_permission, false);
  assert.equal(yoroCommandJson.default_member_permissions, undefined);
});

test("/yoro status는 Organization 정책을 적용한 응답을 작성자에게만 표시한다", async () => {
  const { value, calls } = interaction({ subcommand: "status" });
  const handler = new YoroCommandHandler(
    IDS.application,
    {
      async issueSetupSession() {
        throw new Error("호출되면 안 됩니다.");
      },
      async commandPolicy(input) {
        assert.deepEqual(input, {
          applicationId: IDS.application,
          guildId: IDS.guild,
          command: "status"
        });
        return {
          allowed: true,
          commands: {
            help: true,
            status: true,
            player: true,
            guide: true
          },
          deleteInvocationAfterReply: false,
          preferredLocale: "ko",
          statusFields: {
            players: true,
            version: true,
            latency: false,
            observedAt: false
          },
          revision: 1
        };
      },
      async gameServerStatus() {
        return {
          connected: true,
          server: {
            displayName: "검증 Palworld 서버",
            status: "online",
            source: "rest",
            players: { current: 2, max: 32 },
            version: "v1.0.2"
          }
        };
      },
      async palworldPlayers() {
        throw new Error("호출되면 안 됩니다.");
      }
    },
    Date.now,
    "https://yoro.gg/dashboard/organizations"
  );
  await handler.handle(value);
  assert.equal(calls.reply.length, 0);
  assert.equal(calls.deferReply[0].flags, MessageFlags.Ephemeral);
  assert.equal(calls.editReply.length, 1);
  const embed = calls.editReply[0].embeds[0].toJSON();
  assert.equal(embed.title, "🟢 YORO Palworld 서버");
  assert.equal(
    embed.fields.some((field) => field.value.includes("2 / 32")),
    true
  );
  assert.equal(
    embed.fields.some((field) => field.value.includes("▰")),
    true
  );
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

test("/yoro help는 Organization에서 실제 활성화된 일반 사용자 명령만 표시한다", async () => {
  const { value, calls } = interaction({ subcommand: "help" });
  const handler = new YoroCommandHandler(
    IDS.application,
    {
      async issueSetupSession() {
        throw new Error("호출되면 안 됩니다.");
      },
      async commandPolicy(input) {
        assert.deepEqual(input, {
          applicationId: IDS.application,
          guildId: IDS.guild,
          command: "help"
        });
        return {
          allowed: true,
          commands: {
            help: true,
            status: true,
            player: true,
            guide: false
          },
          deleteInvocationAfterReply: false,
          preferredLocale: "ko",
          statusFields: {
            players: true,
            version: true,
            latency: true,
            observedAt: true
          },
          revision: 1
        };
      }
    },
    Date.now,
    "https://yoro.gg/dashboard/organizations",
    true
  );
  await handler.handle(value);
  const helpEmbed = calls.reply[0].embeds[0].toJSON();
  assert.match(helpEmbed.description, /!yoro status/u);
  assert.doesNotMatch(helpEmbed.description, /!yoro guide/u);
  assert.match(helpEmbed.description, /\/yoro status/u);
  assert.doesNotMatch(helpEmbed.description, /\/yoro guide/u);
  assert.equal(calls.reply[0].components[0].toJSON().components.length, 2);
  assert.equal(calls.reply[0].flags, MessageFlags.Ephemeral);
});

test("상태 게이지는 범위를 안전하게 제한하고 고정 너비로 표시한다", () => {
  assert.equal(discordProgressGauge(0, 32, 8), "▱▱▱▱▱▱▱▱");
  assert.equal(discordProgressGauge(16, 32, 8), "▰▰▰▰▱▱▱▱");
  assert.equal(discordProgressGauge(99, 32, 8), "▰▰▰▰▰▰▰▰");
  assert.equal(discordProgressGauge(-1, 32, 8), "▱▱▱▱▱▱▱▱");
});

test("Gateway client는 prefix 기능이 꺼지면 GUILDS만 요청한다", () => {
  const client = createDiscordClient();
  assert.equal(client.options.intents.has(GatewayIntentBits.Guilds), true);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildMessages), false);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildMembers), false);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildPresences), false);
  assert.equal(client.options.intents.has(GatewayIntentBits.MessageContent), false);
  client.destroy();
});

test("Gateway client는 prefix 기능을 명시적으로 켠 경우에만 메시지 intent를 요청한다", () => {
  const client = createDiscordClient(true);
  assert.equal(client.options.intents.has(GatewayIntentBits.Guilds), true);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildMessages), true);
  assert.equal(client.options.intents.has(GatewayIntentBits.MessageContent), true);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildMembers), false);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildPresences), false);
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

test("내부 API client는 HMAC 인증 실패를 일반 장애와 구분한다", async () => {
  const client = new DiscordInternalApiClient({
    authKey: "i".repeat(64),
    baseUrl: "http://server:3000",
    publicBaseUrl: "https://yoro.gg",
    timeoutMs: 1000,
    fetchImpl: async () => new Response(JSON.stringify({
      error: "내부 인증에 실패했습니다.",
      code: "INTERNAL_AUTH_REQUIRED"
    }), { status: 401 })
  });
  await assert.rejects(
    () => client.gameServerStatus({
      applicationId: IDS.application,
      guildId: IDS.guild
    }),
    (error) => error instanceof DiscordInternalApiError
      && error.code === "authentication_failed"
  );
});

test("내부 API client는 짧은 TTL 동안 동일 command policy 요청을 병합한다", async () => {
  let requests = 0;
  const client = new DiscordInternalApiClient({
    authKey: "p".repeat(64),
    baseUrl: "http://server:3000",
    publicBaseUrl: "https://yoro.gg",
    timeoutMs: 1000,
    now: () => 1_800_000_000_000,
    fetchImpl: async () => {
      requests += 1;
      return new Response(JSON.stringify({
        allowed: true,
        commands: { help: true, status: true, player: true, guide: true },
        deleteInvocationAfterReply: false,
        preferredLocale: "auto",
        statusFields: { players: true, version: true, latency: true, observedAt: true },
        revision: 1
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });
  const input = {
    applicationId: IDS.application,
    guildId: IDS.guild,
    command: "status"
  };
  const [first, second] = await Promise.all([
    client.commandPolicy(input),
    client.commandPolicy(input)
  ]);
  const third = await client.commandPolicy(input);
  assert.equal(requests, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
});

test("!yoro parser는 exact allowlist와 100자 상한을 적용한다", () => {
  assert.deepEqual(parseYoroPrefixCommand("!yoro"), { command: "help" });
  assert.deepEqual(parseYoroPrefixCommand("!yoro help"), { command: "help" });
  assert.deepEqual(parseYoroPrefixCommand("!YORO STATUS"), { command: "status" });
  assert.deepEqual(parseYoroPrefixCommand("!yoro player"), { command: "player" });
  assert.deepEqual(parseYoroPrefixCommand("!yoro player 세이가"), {
    command: "player",
    nickname: "세이가"
  });
  assert.deepEqual(parseYoroPrefixCommand("!yoro guide"), { command: "guide" });
  assert.equal(parseYoroPrefixCommand("!yoro 명령어"), undefined);
  assert.equal(parseYoroPrefixCommand("!yoro コマンド"), undefined);
  assert.equal(parseYoroPrefixCommand("!yoro 상태"), undefined);
  assert.equal(parseYoroPrefixCommand("!yoro 状態"), undefined);
  assert.equal(parseYoroPrefixCommand("!yoro 플레이어"), undefined);
  assert.equal(parseYoroPrefixCommand("!yoro プレイヤー"), undefined);
  assert.equal(parseYoroPrefixCommand("!yoro players"), undefined);
  assert.equal(parseYoroPrefixCommand("!yoro history"), undefined);
  assert.equal(parseYoroPrefixCommand("!yoro status extra"), undefined);
  assert.equal(parseYoroPrefixCommand(`!yoro ${"a".repeat(101)}`), undefined);
});

test("!yoro 단독 입력은 현재 사용할 수 있는 느낌표 명령 목록을 응답한다", async () => {
  const replies = [];
  const handler = new YoroPrefixCommandHandler(
    IDS.application,
    {
      async commandPolicy(input) {
        assert.deepEqual(input, {
          applicationId: IDS.application,
          guildId: IDS.guild,
          command: "help"
        });
        return {
          allowed: true,
          commands: {
            help: true,
            status: true,
            player: false,
            guide: true
          },
          deleteInvocationAfterReply: false,
          preferredLocale: "auto",
          statusFields: {
            players: true,
            version: true,
            latency: true,
            observedAt: true
          },
          revision: 1
        };
      }
    },
    "https://yoro.gg"
  );
  await handler.handle({
    content: "!yoro",
    guildId: IDS.guild,
    guild: { preferredLocale: "ko" },
    author: { id: IDS.user, bot: false },
    webhookId: null,
    system: false,
    async reply(payload) {
      replies.push(payload);
    }
  });

  assert.equal(replies.length, 1);
  const embed = replies[0].embeds[0].toJSON();
  assert.equal(embed.title, "🤖 YORO Bot 일반 사용자 명령");
  assert.match(embed.description, /!yoro status/u);
  assert.match(embed.description, /!yoro guide/u);
  assert.match(embed.description, /!yoro help/u);
  assert.doesNotMatch(embed.description, /!yoro player/u);
  assert.deepEqual(replies[0].allowedMentions, {
    parse: [],
    repliedUser: false
  });
});

test("!yoro status는 Guild에 귀속된 안전한 공개 Embed만 응답한다", async () => {
  const replies = [];
  const message = {
    content: "!yoro status",
    guildId: IDS.guild,
    guild: { preferredLocale: "ko" },
    author: { id: IDS.user, bot: false },
    webhookId: null,
    system: false,
    async reply(payload) {
      replies.push(payload);
    }
  };
  const handler = new YoroPrefixCommandHandler(
    IDS.application,
    {
      async commandPolicy(input) {
        assert.deepEqual(input, {
          applicationId: IDS.application,
          guildId: IDS.guild,
          command: "status"
        });
        return {
          allowed: true,
          commands: {
            help: true,
            status: true,
            player: true,
            guide: true
          },
          deleteInvocationAfterReply: false,
          preferredLocale: "auto",
          statusFields: {
            players: true,
            version: false,
            latency: true,
            observedAt: true
          },
          revision: 1
        };
      },
      async gameServerStatus(input) {
        assert.deepEqual(input, {
          applicationId: IDS.application,
          guildId: IDS.guild
        });
        return {
          connected: true,
          server: {
            displayName: "@everyone **Palworld**",
            status: "online",
            source: "rest",
            players: { current: 4, max: 32 },
            version: "v1.0",
            latencyMs: 21,
            observedAt: "2026-07-30T00:00:00.000Z"
          }
        };
      }
    },
    "https://yoro.gg",
    () => 1_800_000_000_000
  );
  await handler.handle(message);
  assert.equal(replies.length, 1);
  assert.deepEqual(replies[0].allowedMentions, {
    parse: [],
    repliedUser: false
  });
  const embed = replies[0].embeds[0].toJSON();
  assert.doesNotMatch(embed.description, /@everyone/u);
  assert.match(embed.description, /＠everyone/u);
  assert.match(embed.description, /온라인/u);
  assert.equal(
    embed.fields.some((field) => field.value.includes("4 / 32")),
    true
  );
  assert.equal(
    embed.fields.some((field) => field.name.includes("게임 버전")),
    false
  );
  const statusActions = replies[0].components[0].toJSON().components;
  assert.deepEqual(
    statusActions.map((component) => component.url),
    [
      "https://yoro.gg/ko/palworld",
      "https://yoro.gg/ko/bot/game-files"
    ]
  );
  assert.equal(statusActions[0].label, "Palworld 홈 열기");
});

test("느린 prefix 명령은 typing을 시작하고 동일 in-flight 요청을 중복 실행하지 않는다", async () => {
  let resolveStatus;
  let policyCalls = 0;
  let statusCalls = 0;
  let typingCalls = 0;
  const replies = [];
  const statusResponse = new Promise((resolve) => {
    resolveStatus = resolve;
  });
  const handler = new YoroPrefixCommandHandler(
    IDS.application,
    {
      async commandPolicy() {
        policyCalls += 1;
        return {
          allowed: true,
          commands: { help: true, status: true, player: true, guide: true },
          deleteInvocationAfterReply: false,
          preferredLocale: "ko",
          statusFields: { players: true, version: true, latency: true, observedAt: true },
          revision: 1
        };
      },
      async gameServerStatus() {
        statusCalls += 1;
        return statusResponse;
      }
    },
    "https://yoro.gg"
  );
  const message = {
    content: "!yoro status",
    guildId: IDS.guild,
    guild: { preferredLocale: "ko" },
    author: { id: IDS.user, bot: false },
    webhookId: null,
    system: false,
    channel: { async sendTyping() { typingCalls += 1; } },
    async reply(payload) { replies.push(payload); }
  };
  const first = handler.handle(message);
  await new Promise((resolve) => setImmediate(resolve));
  await handler.handle(message);
  assert.equal(typingCalls, 1);
  assert.equal(policyCalls, 1);
  assert.equal(statusCalls, 1);
  resolveStatus({ connected: false });
  await first;
  assert.equal(replies.length, 1);
});

test("빠른 도움말 prefix 명령은 typing을 전송하지 않는다", async () => {
  let typingCalls = 0;
  const handler = new YoroPrefixCommandHandler(
    IDS.application,
    {
      async commandPolicy() {
        return {
          allowed: true,
          commands: { help: true, status: true, player: true, guide: true },
          deleteInvocationAfterReply: false,
          preferredLocale: "ko",
          statusFields: { players: true, version: true, latency: true, observedAt: true },
          revision: 1
        };
      }
    },
    "https://yoro.gg"
  );
  await handler.handle({
    content: "!yoro help",
    guildId: IDS.guild,
    guild: { preferredLocale: "ko" },
    author: { id: IDS.user, bot: false },
    webhookId: null,
    system: false,
    channel: { async sendTyping() { typingCalls += 1; } },
    async reply() {}
  });
  assert.equal(typingCalls, 0);
});

test("!yoro 명령 메시지는 설정이 켜진 경우 응답 성공 후에만 삭제한다", async () => {
  async function run({
    enabled,
    deletable = true,
    deleteFails = false
  }) {
    const events = [];
    const handler = new YoroPrefixCommandHandler(
      IDS.application,
      {
        async commandPolicy() {
          return {
            allowed: true,
            commands: {
              help: true,
              status: true,
              player: true,
              guide: true
            },
            deleteInvocationAfterReply: enabled,
            preferredLocale: "ko",
            statusFields: {
              players: true,
              version: true,
              latency: true,
              observedAt: true
            },
            revision: 1
          };
        }
      },
      "https://yoro.gg"
    );
    await handler.handle({
      content: "!yoro help",
      guildId: IDS.guild,
      guild: { preferredLocale: "ko" },
      author: { id: IDS.user, bot: false },
      webhookId: null,
      system: false,
      deletable,
      async reply() {
        events.push("reply");
      },
      async delete() {
        events.push("delete");
        if (deleteFails) {
          throw new Error("missing_permissions");
        }
      }
    });
    return events;
  }

  assert.deepEqual(await run({ enabled: true }), ["reply", "delete"]);
  assert.deepEqual(await run({ enabled: false }), ["reply"]);
  assert.deepEqual(await run({ enabled: true, deletable: false }), ["reply"]);
  assert.deepEqual(
    await run({ enabled: true, deleteFails: true }),
    ["reply", "delete"]
  );
});

test("!yoro 영어 명령의 응답 언어는 Dashboard 설정과 Guild locale을 적용한다", async () => {
  async function responseTitle({
    content,
    guildLocale,
    preferredLocale
  }) {
    const replies = [];
    const handler = new YoroPrefixCommandHandler(
      IDS.application,
      {
        async commandPolicy() {
          return {
            allowed: true,
            commands: {
              help: true,
              status: true,
              player: true,
              guide: true
            },
            deleteInvocationAfterReply: false,
            preferredLocale,
            statusFields: {
              players: true,
              version: true,
              latency: true,
              observedAt: true
            },
            revision: 1
          };
        },
        async gameServerStatus() {
          return {
            connected: true,
            server: {
              displayName: "Palworld",
              status: "online",
              source: "rest"
            }
          };
        }
      },
      "https://yoro.gg"
    );
    await handler.handle({
      content,
      guildId: IDS.guild,
      guild: { preferredLocale: guildLocale },
      author: { id: IDS.user, bot: false },
      webhookId: null,
      system: false,
      async reply(payload) {
        replies.push(payload);
      }
    });
    return replies[0].embeds[0].toJSON().title;
  }

  assert.equal(await responseTitle({
    content: "!yoro status",
    guildLocale: "ja",
    preferredLocale: "auto"
  }), "🟢 YORO Palworldサーバー");
  assert.equal(await responseTitle({
    guildLocale: "ko",
    content: "!yoro status",
    preferredLocale: "auto"
  }), "🟢 YORO Palworld 서버");
  assert.equal(await responseTitle({
    content: "!yoro status",
    guildLocale: "ja",
    preferredLocale: "ko"
  }), "🟢 YORO Palworld 서버");
  assert.equal(await responseTitle({
    content: "!yoro status",
    guildLocale: "ko",
    preferredLocale: "ja"
  }), "🟢 YORO Palworldサーバー");
});

test("!yoro player는 목록과 게임 내 프로필만 안전하게 표시한다", async () => {
  const replies = [];
  const requests = [];
  const handler = new YoroPrefixCommandHandler(
    IDS.application,
    {
      async commandPolicy(input) {
        assert.equal(input.command, "player");
        return {
          allowed: true,
          commands: {
            help: true,
            status: true,
            player: true,
            guide: true
          },
          deleteInvocationAfterReply: false,
          preferredLocale: "ko",
          statusFields: {
            players: true,
            version: true,
            latency: true,
            observedAt: true
          },
          revision: 1
        };
      },
      async palworldPlayers(input) {
        requests.push(input);
        return input.nickname
          ? {
              connected: true,
              serverConfigured: true,
              displayName: "Palworld",
              result: {
                kind: "profile",
                player: {
                  nickname: "@everyone **세이가**",
                  level: 42,
                  buildingCount: 7
                }
              }
            }
          : {
              connected: true,
              serverConfigured: true,
              displayName: "Palworld",
              result: {
                kind: "list",
                nicknames: ["@everyone **세이가**"],
                total: 1
              }
            };
      }
    },
    "https://yoro.gg",
    (() => {
      let now = 1_800_000_000_000;
      return () => {
        now += 11_000;
        return now;
      };
    })()
  );
  const baseMessage = {
    guildId: IDS.guild,
    guild: { preferredLocale: "ko" },
    author: { id: IDS.user, bot: false },
    webhookId: null,
    system: false,
    async reply(payload) {
      replies.push(payload);
    }
  };
  await handler.handle({ ...baseMessage, content: "!yoro player" });
  await handler.handle({ ...baseMessage, content: "!yoro player @everyone **세이가**" });

  assert.deepEqual(requests, [{
    applicationId: IDS.application,
    guildId: IDS.guild
  }, {
    applicationId: IDS.application,
    guildId: IDS.guild,
    nickname: "@everyone **세이가**"
  }]);
  assert.equal(replies.length, 2);
  assert.match(replies[0].embeds[0].toJSON().description, /\\\*\\\*세이가/u);
  const profile = replies[1].embeds[0].toJSON();
  assert.equal(profile.description.includes("\\*\\*세이가"), true);
  assert.equal(profile.fields.some((field) => field.value === "42"), true);
  assert.deepEqual(replies[1].allowedMentions, {
    parse: [],
    repliedUser: false
  });
});

test("!yoro player 연관 검색어는 locale별 제목과 안전한 닉네임만 표시한다", () => {
  const ko = presentPalworldPlayers({
    locale: "ko",
    response: {
      connected: true,
      serverConfigured: true,
      displayName: "Palworld",
      result: {
        kind: "not_found",
        suggestions: ["SeigaTwo", "@everyone **세이가**"]
      }
    },
    searchHint: "`!yoro player {nickname}` 형식으로 검색해 주세요."
  }).toJSON();
  assert.match(ko.description, /연관 검색어/u);
  assert.match(ko.description, /SeigaTwo/u);
  assert.doesNotMatch(ko.description, /@everyone/u);
  assert.match(ko.description, /＠everyone/u);

  const ja = presentPalworldPlayers({
    locale: "ja",
    response: {
      connected: true,
      serverConfigured: true,
      displayName: "Palworld",
      result: {
        kind: "not_found",
        suggestions: ["セイガ"]
      }
    },
    searchHint: "`!yoro player {nickname}`の形式で検索してください。"
  }).toJSON();
  assert.match(ja.description, /関連する検索候補/u);
  assert.match(ja.description, /セイガ/u);
});

test("!yoro는 Organization 정책에서 비활성화된 명령의 안전한 사유를 응답한다", async () => {
  let statusCalls = 0;
  const replies = [];
  const handler = new YoroPrefixCommandHandler(
    IDS.application,
    {
      async commandPolicy() {
        return {
          allowed: false,
          commands: {
            help: true,
            status: false,
            player: true,
            guide: true
          },
          deleteInvocationAfterReply: false,
          preferredLocale: "auto",
          statusFields: {
            players: true,
            version: true,
            latency: true,
            observedAt: true
          },
          revision: 4,
          reason: "command_disabled"
        };
      },
      async gameServerStatus() {
        statusCalls += 1;
        return { connected: true };
      }
    },
    "https://yoro.gg"
  );
  await handler.handle({
    content: "!yoro status",
    guildId: IDS.guild,
    guild: { preferredLocale: "ko" },
    author: { id: IDS.user, bot: false },
    webhookId: null,
    system: false,
    async reply(payload) {
      replies.push(payload);
    }
  });
  assert.equal(statusCalls, 0);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].content, "이 명령은 서버 관리자가 비활성화했습니다.");
});

test("!yoro status는 공개 사유와 고정된 안전한 관리 동작을 표시한다", async () => {
  const replies = [];
  const handler = new YoroPrefixCommandHandler(
    IDS.application,
    {
      async commandPolicy() {
        return {
          allowed: true,
          commands: {
            help: true,
            status: true,
            player: true,
            guide: true
          },
          deleteInvocationAfterReply: false,
          preferredLocale: "ko",
          statusFields: {
            players: true,
            version: true,
            latency: true,
            observedAt: true
          },
          revision: 1
        };
      },
      async gameServerStatus() {
        return {
          connected: true,
          server: {
            displayName: "Palworld",
            status: "unavailable",
            reason: "status_feature_disabled",
            source: "rest"
          }
        };
      }
    },
    "https://yoro.gg"
  );
  await handler.handle({
    content: "!yoro status",
    guildId: IDS.guild,
    guild: { preferredLocale: "ko" },
    author: { id: IDS.user, bot: false },
    webhookId: null,
    system: false,
    async reply(payload) {
      replies.push(payload);
    }
  });
  const embed = replies[0].embeds[0].toJSON();
  assert.match(embed.description, /현재 상태 확인 불가/u);
  assert.equal(
    embed.fields[0].value,
    "Palworld 상태 조회가 현재 운영 설정에서 비활성화되어 있습니다."
  );
  assert.equal(
    replies[0].components[0].toJSON().components[0].url,
    "https://yoro.gg/ko/palworld"
  );
});

test("!yoro 공개 링크는 응답 언어에 맞는 Palworld 경로만 사용한다", () => {
  assert.equal(
    localizedPublicResourceUrl("https://yoro.gg", "ko", "/palworld"),
    "https://yoro.gg/ko/palworld"
  );
  assert.equal(
    localizedPublicResourceUrl("https://yoro.gg", "ja", "/palworld"),
    "https://yoro.gg/ja/palworld"
  );
  assert.equal(
    localizedPublicResourceUrl(
      "https://yoro.gg",
      "ja",
      "/bot/game-files"
    ),
    "https://yoro.gg/ja/bot/game-files"
  );
});

test("!yoro status는 내부 HMAC 인증 실패를 운영 가능한 안내로 구분한다", async () => {
  const replies = [];
  const handler = new YoroPrefixCommandHandler(
    IDS.application,
    {
      async commandPolicy() {
        return {
          allowed: true,
          commands: {
            help: true,
            status: true,
            player: true,
            guide: true
          },
          deleteInvocationAfterReply: false,
          preferredLocale: "ko",
          statusFields: {
            players: true,
            version: true,
            latency: true,
            observedAt: true
          },
          revision: 1
        };
      },
      async gameServerStatus() {
        throw new DiscordInternalApiError("authentication_failed");
      }
    },
    "https://yoro.gg"
  );
  await handler.handle({
    content: "!yoro status",
    guildId: IDS.guild,
    guild: { preferredLocale: "ko" },
    author: { id: IDS.user, bot: false },
    webhookId: null,
    system: false,
    async reply(payload) {
      replies.push(payload);
    }
  });
  assert.equal(
    replies[0].content,
    "YORO Bot과 서버의 내부 연결 인증을 확인해야 합니다. 서비스 운영자에게 문의해 주세요."
  );
});

test("!yoro는 Bot·Webhook·DM 메시지를 처리하지 않는다", async () => {
  let calls = 0;
  const handler = new YoroPrefixCommandHandler(
    IDS.application,
    {
      async commandPolicy() {
        calls += 1;
        return {
          allowed: true,
          commands: {
            help: true,
            status: true,
            player: true,
            guide: true
          },
          deleteInvocationAfterReply: false,
          preferredLocale: "auto",
          statusFields: {
            players: true,
            version: true,
            latency: true,
            observedAt: true
          },
          revision: 0
        };
      },
      async gameServerStatus() {
        calls += 1;
        return { connected: false };
      }
    },
    "https://yoro.gg"
  );
  for (const candidate of [
    { guildId: null, guild: null, author: { id: IDS.user, bot: false }, webhookId: null },
    { guildId: IDS.guild, guild: {}, author: { id: IDS.user, bot: true }, webhookId: null },
    { guildId: IDS.guild, guild: {}, author: { id: IDS.user, bot: false }, webhookId: "1" }
  ]) {
    await handler.handle({
      content: "!yoro status",
      system: false,
      async reply() { calls += 1; },
      ...candidate
    });
  }
  assert.equal(calls, 0);
});

test("내부 API client는 게임 서버 상태 응답의 unknown field를 거부한다", async () => {
  const client = new DiscordInternalApiClient({
    authKey: "i".repeat(64),
    baseUrl: "http://server:3000",
    publicBaseUrl: "https://yoro.gg",
    timeoutMs: 1000,
    fetchImpl: async () => new Response(JSON.stringify({
      connected: true,
      server: {
        displayName: "Palworld",
        status: "online",
        source: "rest",
        secret: "노출되면 안 됨"
      }
    }), { status: 200 })
  });
  await assert.rejects(
    () => client.gameServerStatus({
      applicationId: IDS.application,
      guildId: IDS.guild
    }),
    (error) => error instanceof DiscordInternalApiError
      && error.code === "invalid_response"
  );
});
