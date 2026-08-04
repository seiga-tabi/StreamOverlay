import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

const {
  PublicLolSocialCardRenderer,
  buildPublicLolSocialSummary,
  safeDataDragonProfileIconUrl,
} = await import("../dist/services/public-lol-social-card.js");

function profile(overrides = {}) {
  return {
    riotId: "Faker#KR1",
    gameName: "Faker",
    tagLine: "KR1",
    lolPlatform: "kr",
    rankedStats: {
      queueType: "RANKED_SOLO_5x5",
      tier: "CHALLENGER",
      rank: "I",
      leaguePoints: 1234,
      wins: 20,
      losses: 10,
      winRate: 67,
      fetchedAt: "2026-08-04T00:00:00.000Z",
    },
    summary: {
      recentGames: 10,
      recentWins: 7,
      recentWinRate: 70,
      averageKda: 4.25,
    },
    fetchedAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

test("공유 메타데이터는 KO/JA 전적 요약과 immutable revision을 생성한다", () => {
  const ko = buildPublicLolSocialSummary(profile(), "ko");
  const ja = buildPublicLolSocialSummary(profile(), "ja");

  assert.equal(ko.title, "Faker#KR1 · Challenger 1,234 LP | YORO.gg");
  assert.match(ko.description, /최근 10게임 · 7승 3패 · 승률 70%/);
  assert.match(ko.description, /평균 KDA 4\.25/);
  assert.equal(ja.title, "Faker#KR1 · Challenger 1,234 LP | YORO.gg");
  assert.match(ja.description, /直近10試合 · 7勝 3敗 · 勝率70%/);
  assert.match(ja.description, /平均KDA 4\.25/);
  assert.match(ko.revision, /^[a-f0-9]{16}$/);
  assert.notEqual(
    ko.revision,
    buildPublicLolSocialSummary(profile({ fetchedAt: "2026-08-04T00:10:00.000Z" }), "ko").revision,
  );
});

test("공유 요약은 비정상 수치와 0 LP를 노출하지 않는다", () => {
  const summary = buildPublicLolSocialSummary(profile({
    rankedStats: { ...profile().rankedStats, leaguePoints: 0 },
    summary: { recentGames: Number.NaN, recentWins: -1, recentWinRate: Number.POSITIVE_INFINITY },
  }), "ko");

  assert.doesNotMatch(summary.description, /0 LP|NaN|Infinity/);
});

test("언랭크와 최근 경기 없음은 locale별 안전한 문구로 표시한다", () => {
  const ko = buildPublicLolSocialSummary(profile({ rankedStats: undefined, summary: undefined }), "ko");
  const ja = buildPublicLolSocialSummary(profile({ rankedStats: undefined, summary: undefined }), "ja");

  assert.equal(ko.title, "Faker#KR1 · 언랭크 | YORO.gg");
  assert.equal(ja.title, "Faker#KR1 · アンランク | YORO.gg");
  assert.doesNotMatch(`${ko.description}${ja.description}`, /undefined|NaN|0 LP/);
});

test("프로필 아이콘은 Data Dragon의 정확한 PNG 경로만 허용한다", () => {
  assert.equal(
    safeDataDragonProfileIconUrl("https://ddragon.leagueoflegends.com/cdn/16.15.1/img/profileicon/29.png"),
    "https://ddragon.leagueoflegends.com/cdn/16.15.1/img/profileicon/29.png",
  );
  assert.equal(safeDataDragonProfileIconUrl("https://evil.example/profile.png"), undefined);
  assert.equal(safeDataDragonProfileIconUrl("https://ddragon.leagueoflegends.com/cdn/16.15.1/img/profileicon/29.png?next=x"), undefined);
  assert.equal(safeDataDragonProfileIconUrl("data:image/png;base64,AAAA"), undefined);
});

test("공유 이미지 native renderer는 서버 시작 경로에서 즉시 로드하지 않는다", async () => {
  let loaderCalls = 0;
  const renderer = new PublicLolSocialCardRenderer(fetch, async () => {
    loaderCalls += 1;
    throw new Error("native renderer unavailable");
  });

  assert.equal(loaderCalls, 0);
  await assert.rejects(
    renderer.render(profile(), "ko"),
    /native renderer unavailable/u,
  );
  assert.equal(loaderCalls, 1);
});

test("공유 이미지는 1200x630 PNG로 결정적으로 렌더링한다", async () => {
  let fetchCalls = 0;
  const renderer = new PublicLolSocialCardRenderer(async () => {
    fetchCalls += 1;
    throw new Error("외부 요청은 호출되면 안 됩니다.");
  });
  const first = await renderer.render(profile({ profileIconUrl: "https://evil.example/icon.png" }), "ko");
  const second = await renderer.render(profile({ profileIconUrl: "https://evil.example/icon.png" }), "ko");
  const metadata = await sharp(first.body).metadata();

  assert.equal(fetchCalls, 0);
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.deepEqual(first.body, second.body);
});

test("공유 이미지는 검증된 Data Dragon 프로필 아이콘만 포함하고 결과를 캐시한다", async () => {
  const icon = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 118, g: 103, b: 255, alpha: 1 } },
  }).png().toBuffer();
  let fetchCalls = 0;
  const renderer = new PublicLolSocialCardRenderer(async () => {
    fetchCalls += 1;
    return new Response(icon, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-length": String(icon.length),
      },
    });
  });
  const withIcon = profile({
    profileIconUrl: "https://ddragon.leagueoflegends.com/cdn/16.15.1/img/profileicon/29.png",
  });

  const first = await renderer.render(withIcon, "ko");
  const second = await renderer.render(withIcon, "ko");

  assert.equal(fetchCalls, 1);
  assert.deepEqual(first.body, second.body);
});
