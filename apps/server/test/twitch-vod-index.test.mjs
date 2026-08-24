import test from "node:test";
import assert from "node:assert/strict";

/* 경기 → 다시보기 점프 지점 — 목업 page-4 v34 계약.
 *
 * 여기서 지키는 것: 잘못된 지점으로 보내느니 버튼을 안 그린다. 다시보기는 편의
 * 기능이고, 엉뚱한 방송의 엉뚱한 시각으로 보내면 없느니만 못합니다.
 */

const {
  REPLAY_LEAD_IN_SECONDS,
  VOD_LIST_FAILURE_TTL_MS,
  VOD_LIST_TTL_MS,
  TwitchVodIndex,
  parseTwitchVodDuration,
  parseTwitchVods,
  replayForMatch,
  replayTimestampParam
} = await import("../dist/services/twitch-vod-index.js");

const HOUR = 3600 * 1000;

function vod(id, createdAt, durationSeconds) {
  return { id, createdAt, durationSeconds };
}

test("duration 표기를 초로 바꾼다", () => {
  assert.equal(parseTwitchVodDuration("3h21m14s"), 3 * 3600 + 21 * 60 + 14);
  assert.equal(parseTwitchVodDuration("12m"), 720);
  assert.equal(parseTwitchVodDuration("45s"), 45);
  assert.equal(parseTwitchVodDuration("2h"), 7200);
  assert.equal(parseTwitchVodDuration("1h30s"), 3630);
  /* 형식을 벗어나면 그 VOD 는 후보에서 빠집니다 — 0 으로 넘기면 안 됩니다. */
  for (const broken of ["", "   ", "abc", "3:21:14", "-5s", "0s", 3600, null, undefined]) {
    assert.equal(parseTwitchVodDuration(broken), undefined, JSON.stringify(broken));
  }
});

test("아카이브만 후보로 삼고 형식이 깨진 항목은 버린다", () => {
  const parsed = parseTwitchVods({
    data: [
      {
        id: "111",
        stream_id: "987654321",
        user_id: "55",
        user_login: "bamtol",
        user_name: "밤톨",
        title: "솔로 랭크",
        created_at: "2026-08-19T10:00:00Z",
        published_at: "2026-08-19T10:04:00Z",
        duration: "2h",
        type: "archive",
        url: "https://www.twitch.tv/videos/111"
      },
      /* 하이라이트·업로드는 방송 시각과 무관합니다. */
      { id: "222", created_at: "2026-08-19T10:00:00Z", duration: "2h", type: "highlight" },
      { id: "333", created_at: "2026-08-19T10:00:00Z", duration: "2h", type: "upload" },
      /* id 가 숫자가 아니면 링크를 만들 수 없습니다. */
      { id: "../evil", created_at: "2026-08-19T10:00:00Z", duration: "2h", type: "archive" },
      { id: "444", created_at: "어제", duration: "2h", type: "archive" },
      { id: "555", created_at: "2026-08-19T10:00:00Z", duration: "??", type: "archive" },
      /* 1분 미만은 방송 조각이라 점프 대상이 아닙니다. */
      { id: "666", created_at: "2026-08-19T10:00:00Z", duration: "30s", type: "archive" }
    ]
  });
  assert.deepEqual(parsed.map((entry) => entry.id), ["111"]);
  assert.equal(parsed[0].durationSeconds, 7200);
  assert.equal(parsed[0].createdAt, "2026-08-19T10:00:00Z", "published_at이 아니라 방송 created_at을 써야 합니다");

  /* 응답이 형식을 벗어나면 빈 목록입니다 — 던지지 않습니다. */
  for (const broken of [undefined, null, {}, { data: null }, { data: "x" }, []]) {
    assert.deepEqual(parseTwitchVods(broken), [], JSON.stringify(broken));
  }
});

test("경기 시작이 들어가는 방송의 초 위치를 낸다", () => {
  const start = Date.parse("2026-08-19T10:00:00.000Z");
  const vods = [vod("111", new Date(start).toISOString(), 7200)];
  /* 방송 시작 1시간 뒤에 시작한 경기. */
  const replay = replayForMatch(vods, new Date(start + HOUR).toISOString());
  assert.equal(replay.vodId, "111");
  /* 밴픽 끝자락부터 보이도록 조금 당깁니다. */
  assert.equal(replay.offsetSeconds, 3600 - REPLAY_LEAD_IN_SECONDS);
});

test("방송 밖의 경기는 버튼을 만들지 않는다", () => {
  const start = Date.parse("2026-08-19T10:00:00.000Z");
  const vods = [vod("111", new Date(start).toISOString(), 7200)];

  /* 방송 시작 전. */
  assert.equal(replayForMatch(vods, new Date(start - 1000).toISOString()), undefined);
  /* 방송이 끝난 뒤(경계 포함). */
  assert.equal(replayForMatch(vods, new Date(start + 7200 * 1000).toISOString()), undefined);
  /* 방송이 끊겼다 이어진 사이의 경기 — 어느 VOD 에도 안 들어갑니다. */
  const gapped = [
    vod("111", new Date(start).toISOString(), 3600),
    vod("222", new Date(start + 3 * HOUR).toISOString(), 3600)
  ];
  assert.equal(replayForMatch(gapped, new Date(start + 2 * HOUR).toISOString()), undefined);

  /* 아카이브가 없거나 시각을 모르면 없음입니다. */
  assert.equal(replayForMatch([], new Date(start).toISOString()), undefined);
  assert.equal(replayForMatch(vods, undefined), undefined);
  assert.equal(replayForMatch(vods, "어제"), undefined);
});

test("겹치는 방송은 나중에 시작한 쪽을 쓴다", () => {
  const start = Date.parse("2026-08-19T10:00:00.000Z");
  const vods = [
    vod("older", new Date(start).toISOString(), 4 * 3600),
    vod("newer", new Date(start + HOUR).toISOString(), 4 * 3600)
  ];
  const replay = replayForMatch(vods, new Date(start + 2 * HOUR).toISOString());
  assert.equal(replay.vodId, "newer");
  assert.equal(replay.offsetSeconds, 3600 - REPLAY_LEAD_IN_SECONDS);
});

test("시작 직후 경기는 음수로 밀리지 않는다", () => {
  const start = Date.parse("2026-08-19T10:00:00.000Z");
  const vods = [vod("111", new Date(start).toISOString(), 7200)];
  const replay = replayForMatch(vods, new Date(start + 5000).toISOString());
  assert.equal(replay.offsetSeconds, 0);
});

test("t 파라미터 표기", () => {
  assert.equal(replayTimestampParam(0), "0h00m00s");
  assert.equal(replayTimestampParam(3661), "1h01m01s");
  assert.equal(replayTimestampParam(-5), "0h00m00s");
});

test("VOD 목록은 채널별로 캐시하고 실패해도 화면을 막지 않는다", async () => {
  let calls = 0;
  let now = 1_000;
  const loads = [];
  const start = Date.parse("2026-08-19T10:00:00.000Z");
  const index = new TwitchVodIndex({
    videosFor: async (twitchUserId) => {
      calls += 1;
      if (twitchUserId === "999") return { state: "failed", reason: "http_503" };
      return { state: "ready", vods: [vod("111", new Date(start).toISOString(), 7200)] };
    },
    now: () => now,
    onLoad: (result) => loads.push(result)
  });

  const first = await index.replayFor("55", new Date(start + HOUR).toISOString());
  assert.equal(first.vodId, "111");
  await index.replayFor("55", new Date(start + HOUR).toISOString());
  assert.equal(calls, 1, "같은 채널은 캐시에서 나옵니다");

  /* 한 화면의 여러 경기는 한 번만 묻습니다. */
  const many = await index.replaysFor("55", [
    new Date(start + HOUR).toISOString(),
    new Date(start - HOUR).toISOString(),
    undefined
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(many.map((entry) => entry?.vodId), ["111", undefined, undefined]);

  /* Twitch 가 흔들려도 던지지 않습니다 — 버튼만 사라집니다. */
  assert.equal(await index.replayFor("999", new Date(start).toISOString()), undefined);
  /* 실패도 짧게 캐시해 연속 재시도를 막습니다. */
  const callsAfterFailure = calls;
  assert.equal(await index.replayFor("999", new Date(start).toISOString()), undefined);
  assert.equal(calls, callsAfterFailure);
  assert.deepEqual(loads.at(-1), {
    twitchUserId: "999",
    state: "failed",
    vodCount: 0,
    cacheTtlMs: VOD_LIST_FAILURE_TTL_MS,
    reason: "http_503"
  });

  /* 30초가 지나면 실패를 다시 확인합니다 — 기존 10분 고정 문제의 회귀 방지입니다. */
  now += VOD_LIST_FAILURE_TTL_MS + 1;
  assert.equal(await index.replayFor("999", new Date(start).toISOString()), undefined);
  assert.equal(calls, callsAfterFailure + 1);

  /* 채널 id 형식이 아니면 조회 자체를 하지 않습니다. */
  assert.equal(await index.replayFor("../evil", new Date(start).toISOString()), undefined);
  assert.deepEqual(await index.replaysFor("", [new Date(start).toISOString()]), [undefined]);
  assert.equal(calls, callsAfterFailure + 1);
});

test("성공한 빈 VOD 목록은 정상 TTL로 캐시한다", async () => {
  let calls = 0;
  let now = 5_000;
  const index = new TwitchVodIndex({
    videosFor: async () => {
      calls += 1;
      return { state: "ready", vods: [] };
    },
    now: () => now
  });
  const at = "2026-08-19T10:00:00.000Z";
  assert.equal(await index.replayFor("77", at), undefined);
  now += VOD_LIST_FAILURE_TTL_MS + 1;
  assert.equal(await index.replayFor("77", at), undefined);
  assert.equal(calls, 1, "정상 빈 목록은 실패 TTL 뒤에도 캐시되어야 합니다");
  now += VOD_LIST_TTL_MS;
  assert.equal(await index.replayFor("77", at), undefined);
  assert.equal(calls, 2);
});

test("동시에 같은 채널을 물어도 한 번만 조회한다", async () => {
  let calls = 0;
  const start = Date.parse("2026-08-19T10:00:00.000Z");
  const index = new TwitchVodIndex({
    videosFor: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { state: "ready", vods: [vod("111", new Date(start).toISOString(), 7200)] };
    }
  });
  const at = new Date(start + HOUR).toISOString();
  const [a, b] = await Promise.all([index.replayFor("55", at), index.replayFor("55", at)]);
  assert.equal(a.vodId, b.vodId);
  assert.equal(calls, 1);
});
