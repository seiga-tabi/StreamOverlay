import test from "node:test";
import assert from "node:assert/strict";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import {
  DiscordAnnouncementPublisher,
  announcementEmbed,
  mentionableRoles,
  publishableChannels
} from "../dist/announcement-publisher.js";

const APPLICATION_ID = "987654321098765432";
const GUILD_ID = "123456789012345678";
const CHANNEL_ID = "223456789012345678";
const ROLE_ID = "323456789012345678";

function fakeGuild(channels, roles = []) {
  const me = {};
  const guild = {
    id: GUILD_ID,
    members: { me },
    channels: { cache: new Map(channels.map((c) => [c.id, c])) },
    roles: { cache: new Map(roles.map((r) => [r.id, r])) }
  };
  return guild;
}

function textChannel(id, name, allow = true) {
  return {
    id,
    name,
    type: ChannelType.GuildText,
    permissionsFor: () => ({ has: () => allow })
  };
}

test("보고 후보는 봇이 실제로 쓸 수 있는 텍스트 채널만 포함한다", () => {
  const guild = fakeGuild([
    textChannel("1".repeat(18), "공지"),
    textChannel("2".repeat(18), "권한없음", false),
    { id: "3".repeat(18), name: "음성", type: ChannelType.GuildVoice, permissionsFor: () => ({ has: () => true }) }
  ]);
  assert.deepEqual(
    publishableChannels(guild).map((entry) => entry.name),
    ["공지"]
  );
});

test("멘션 후보에서 @everyone 역할은 제외한다", () => {
  const guild = fakeGuild([], [
    { id: GUILD_ID, name: "@everyone" },
    { id: ROLE_ID, name: "참여알림" }
  ]);
  const roles = mentionableRoles(guild);
  assert.deepEqual(roles.map((role) => role.id), [ROLE_ID]);
});

test("모집·마감 embed는 상태에 따라 다른 제목과 색을 쓴다", () => {
  const open = announcementEmbed({
    jobId: "11111111-1111-4111-8111-111111111111",
    guildId: GUILD_ID, channelId: CHANNEL_ID, locale: "ko", state: "recruiting",
    streamerDisplayName: "코코넨네",
    participationUrl: "https://yoro.gg/participation?session=ps_x",
    waiting: 12, selected: 1
  }).toJSON();
  assert.match(open.title, /모집 중/u);
  assert.match(open.description, /참여 신청하기/u);
  assert.match(open.footer.text, /대기 12/u);

  const closed = announcementEmbed({
    jobId: "11111111-1111-4111-8111-111111111111",
    guildId: GUILD_ID, channelId: CHANNEL_ID, locale: "ja", state: "closed",
    streamerDisplayName: "코코넨네",
    participationUrl: "https://yoro.gg/participation?session=ps_x"
  }).toJSON();
  assert.match(closed.title, /終了/u);
  assert.notEqual(open.color, closed.color);
});

test("followers 한정이면 인원이 없는 embed 를 만든다", () => {
  const embed = announcementEmbed({
    jobId: "11111111-1111-4111-8111-111111111111",
    guildId: GUILD_ID, channelId: CHANNEL_ID, locale: "ko", state: "recruiting",
    streamerDisplayName: "코코넨네",
    participationUrl: "https://yoro.gg/participation?session=ps_x"
  }).toJSON();
  assert.equal(embed.footer, undefined);
});

function publisherHarness(jobs, channelBehaviour = {}) {
  const acks = [];
  const sent = [];
  const channel = {
    id: CHANNEL_ID,
    async send(payload) {
      if (channelBehaviour.sendError) throw channelBehaviour.sendError;
      sent.push(payload);
      return { id: "999999999999999999" };
    },
    messages: {
      async fetch() {
        if (channelBehaviour.fetchError) throw channelBehaviour.fetchError;
        return {
          async edit(payload) {
            sent.push(payload);
            return { id: "999999999999999999" };
          }
        };
      }
    }
  };
  const publisher = new DiscordAnnouncementPublisher({
    applicationId: APPLICATION_ID,
    client: {
      guilds: {
        cache: new Map(channelBehaviour.noGuild ? [] : [[GUILD_ID, {
          id: GUILD_ID,
          channels: { cache: new Map([[CHANNEL_ID, channel]]) }
        }]])
      }
    },
    internalApi: {
      async pendingAnnouncements() { return jobs; },
      async ackAnnouncement(body) { acks.push(body); },
      async reportGuildDirectory() {}
    }
  });
  return { publisher, acks, sent };
}

const baseJob = {
  jobId: "11111111-1111-4111-8111-111111111111",
  guildId: GUILD_ID,
  channelId: CHANNEL_ID,
  locale: "ko",
  state: "recruiting",
  streamerDisplayName: "코코넨네",
  participationUrl: "https://yoro.gg/participation?session=ps_x",
  waiting: 3
};

test("발행 성공은 messageId와 함께 ack 한다", async () => {
  const { publisher, acks, sent } = publisherHarness([baseJob]);
  await publisher.tick();
  assert.equal(sent.length, 1);
  assert.deepEqual(acks, [{
    applicationId: APPLICATION_ID,
    jobId: baseJob.jobId,
    result: "ok",
    messageId: "999999999999999999"
  }]);
});

test("멘션은 지정한 역할만 허용하고 everyone 을 켜지 않는다", async () => {
  const { publisher, sent } = publisherHarness([{ ...baseJob, mentionRoleId: ROLE_ID }]);
  await publisher.tick();
  assert.deepEqual(sent[0].allowedMentions, { parse: [], roles: [ROLE_ID] });
  assert.equal(sent[0].content, `<@&${ROLE_ID}>`);

  const { publisher: plain, sent: plainSent } = publisherHarness([baseJob]);
  await plain.tick();
  assert.deepEqual(plainSent[0].allowedMentions, { parse: [] });
  assert.equal(plainSent[0].content, undefined);
});

test("편집은 새 메시지를 만들지 않고 멘션을 다시 보내지 않는다", async () => {
  const { publisher, sent, acks } = publisherHarness([
    { ...baseJob, messageId: "888888888888888888", mentionRoleId: ROLE_ID }
  ]);
  await publisher.tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content, undefined, "편집할 때마다 멘션을 다시 보내면 안 됩니다.");
  assert.equal(acks[0].result, "ok");
});

test("Discord 오류는 안전한 ack 코드로 바뀐다", async () => {
  for (const [code, expected] of [
    [10003, "channel_missing"],
    [10008, "message_deleted"],
    [50013, "permission_missing"],
    [50001, "permission_missing"],
    [99999, "failed"]
  ]) {
    const error = Object.assign(new Error("discord"), { code });
    const { publisher, acks } = publisherHarness([baseJob], { sendError: error });
    await publisher.tick();
    assert.equal(acks[0].result, expected, String(code));
    assert.equal("messageId" in acks[0], false);
  }
});

test("길드나 채널이 없으면 channel_missing 으로 보고한다", async () => {
  const { publisher, acks } = publisherHarness([baseJob], { noGuild: true });
  await publisher.tick();
  assert.equal(acks[0].result, "channel_missing");
});

test("폴링은 겹쳐 돌지 않는다", async () => {
  let calls = 0;
  const publisher = new DiscordAnnouncementPublisher({
    applicationId: APPLICATION_ID,
    client: { guilds: { cache: new Map() } },
    internalApi: {
      async pendingAnnouncements() {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return [];
      },
      async ackAnnouncement() {},
      async reportGuildDirectory() {}
    }
  });
  await Promise.all([publisher.tick(), publisher.tick(), publisher.tick()]);
  assert.equal(calls, 1);
});

test("서버 응답이 형식을 벗어나면 아무것도 발행하지 않는다", async () => {
  const sent = [];
  const publisher = new DiscordAnnouncementPublisher({
    applicationId: APPLICATION_ID,
    client: { guilds: { cache: new Map() } },
    internalApi: {
      async pendingAnnouncements() { throw new Error("invalid_response"); },
      async ackAnnouncement() { sent.push("ack"); },
      async reportGuildDirectory() {}
    }
  });
  await publisher.tick();
  assert.deepEqual(sent, []);
});
