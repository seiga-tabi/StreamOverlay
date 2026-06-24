import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLolRole, redactSensitiveString, redactSensitiveValue, validateBotAction } from "../dist/index.js";

const dangerousActionTypes = [
  "obs.startStream",
  "obs.stopStream",
  "obs.setStreamKey",
  "obs.call",
  "shell.exec",
  "file.delete",
  "file.write_anywhere",
  "browser.open_url_any",
  "url.open"
];

test("위험 action type은 allowlist에서 차단한다", () => {
  for (const type of dangerousActionTypes) {
    const result = validateBotAction({ type });
    assert.equal(result.ok, false, `${type} should be rejected`);
  }
});

test("role parser는 한국어/영어 포지션 입력을 정규화한다", () => {
  assert.equal(normalizeLolRole("미드"), "mid");
  assert.equal(normalizeLolRole("jgl"), "jungle");
  assert.equal(normalizeLolRole("아무라인"), "fill");
  assert.equal(normalizeLolRole("ミッド"), "mid");
  assert.equal(normalizeLolRole("サポート"), "support");
  assert.equal(normalizeLolRole("どこでも"), "fill");
  assert.equal(normalizeLolRole("???"), "unknown");
});

test("허용 action도 정의되지 않은 위험 필드를 거부한다", () => {
  const cases = [
    { type: "twitch.chat", message: "안녕하세요", command: "rm -rf /" },
    { type: "noop", url: "file:///etc/passwd" },
    { type: "obs.saveReplayBuffer", streamKey: "secret" }
  ];

  for (const action of cases) {
    const result = validateBotAction(action);
    assert.equal(result.ok, false, JSON.stringify(action));
  }
});

test("OBS duration은 상한을 넘길 수 없다", () => {
  const result = validateBotAction({
    type: "obs.showSource",
    sceneName: "메인",
    sourceName: "alert",
    durationMs: 60001
  });

  assert.equal(result.ok, false);
});

test("정상 allowlist action은 통과한다", () => {
  const validActions = [
    { type: "obs.saveReplayBuffer" },
    { type: "obs.setText", inputName: "subtitle", text: "테스트" },
    { type: "twitch.chat", message: "테스트 메시지" },
    { type: "queue.question", question: "질문입니다", userName: "viewer" },
    {
      type: "overlay.banner",
      message: "알림",
      subtitle: "안전한 알림",
      variant: "info",
      durationMs: 3000,
      eventKind: "subscription",
      mediaUrl: "/alerts/subscription.gif",
      soundUrl: "https://example.com/subscription.mp3",
      soundVolume: 0.5,
      speechEnabled: true,
      speechText: "サブスクありがとうございます。",
      speechAudioUrl: "/tts/subscription.wav",
      speechLanguage: "ja-JP",
      speechRate: 1,
      speechPitch: 1,
      speechVolume: 0.8
    }
  ];

  for (const action of validActions) {
    const result = validateBotAction(action);
    assert.equal(result.ok, true, JSON.stringify(action));
  }
});

test("overlay.banner action은 안전하지 않은 speech 설정을 거부한다", () => {
  const result = validateBotAction({
    type: "overlay.banner",
    message: "通知",
    speechEnabled: true,
    speechLanguage: "en-US"
  });
  assert.equal(result.ok, false);
});

test("overlay.banner action은 안전하지 않은 alert asset URL을 거부한다", () => {
  const result = validateBotAction({
    type: "overlay.banner",
    message: "알림",
    soundUrl: "file:///tmp/secret.mp3"
  });
  assert.equal(result.ok, false);
});

test("overlay.participationQueue action은 안전한 rankedStats만 허용한다", () => {
  const valid = validateBotAction({
    type: "overlay.participationQueue",
    queue: [
      {
        position: 1,
        twitchUserName: "viewer",
        status: "verified",
        topChampions: [
          {
            championId: 266,
            championKey: "Aatrox",
            nameKo: "아트록스",
            splashUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg",
            loadingUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Aatrox_0.jpg",
            imageVersion: "16.12.1",
            imageLocale: "neutral",
            masteryLevel: 24
          }
        ],
        rankedStats: {
          queueType: "RANKED_SOLO_5x5",
          tier: "EMERALD",
          rank: "IV",
          leaguePoints: 11,
          wins: 44,
          losses: 39,
          winRate: 53,
          fetchedAt: "2026-06-16T00:00:00.000Z"
        }
      }
    ]
  });
  assert.equal(valid.ok, true);

  const invalid = validateBotAction({
    type: "overlay.participationQueue",
    queue: [
      {
        position: 1,
        twitchUserName: "viewer",
        status: "verified",
        rankedStats: {
          queueType: "RANKED_SOLO_5x5",
          tier: "EMERALD",
          leaguePoints: 11,
          wins: 44,
          losses: 39,
          winRate: 53,
          fetchedAt: "2026-06-16T00:00:00.000Z",
          raw: { riotId: "HideOnBush#KR1" }
        }
      }
    ]
  });
  assert.equal(invalid.ok, false);
});

test("overlay.participationStatus action은 방송자 프로필 표시 정보를 허용한다", () => {
  const result = validateBotAction({
    type: "overlay.participationStatus",
    isOpen: true,
    mode: "normal5",
    streamerProfile: {
      displayName: "Streamer",
      profileStatus: "ready",
      mainRole: "MIDDLE",
      topChampions: [
        {
          championId: 103,
          championKey: "Ahri",
          nameKo: "아리",
          masteryLevel: 7,
          masteryPoints: 315000
        }
      ]
    }
  });
  assert.equal(result.ok, true);
});

test("overlay.soloRankProfile action은 방송자 전적 표시 payload를 허용한다", () => {
  const valid = validateBotAction({
    type: "overlay.soloRankProfile",
    region: "KR",
    queueLabel: "Solo/Duo",
    profile: {
      displayName: "Streamer",
      profileStatus: "ready",
      mainRole: "MIDDLE",
      mainRoleConfidence: 66,
      topChampions: [
        {
          championId: 238,
          championKey: "Zed",
          nameKo: "제드",
          nameJa: "ゼド",
          splashUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Zed_0.jpg",
          skinNum: 0,
          masteryLevel: 28,
          masteryPoints: 273918
        }
      ],
      rankedStats: {
        queueType: "RANKED_SOLO_5x5",
        tier: "DIAMOND",
        rank: "I",
        leaguePoints: 75,
        wins: 123,
        losses: 97,
        winRate: 55,
        summonerLevel: 512,
        profileIconId: 29,
        tierIconUrl: "/riot/ranked-emblems/diamond.png?v=ranked-emblems-1",
        fetchedAt: "2026-06-16T00:00:00.000Z"
      },
      performanceStats: { sampleSize: 20, averageKills: 5.7, averageDeaths: 4.1, averageAssists: 6.1, kda: 2.85 },
      recentMatches: [
        {
          championId: 238,
          championKey: "Zed",
          nameKo: "제드",
          nameJa: "ゼド",
          iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.12.1/img/champion/Zed.png",
          won: true
        }
      ]
    }
  });
  assert.equal(valid.ok, true);

  const invalid = validateBotAction({
    type: "overlay.soloRankProfile",
    profile: {
      displayName: "Streamer",
      performanceStats: { sampleSize: 20, averageKills: 5.7, averageDeaths: 4.1, averageAssists: 6.1, kda: 2.85, puuid: "secret" }
    }
  });
  assert.equal(invalid.ok, false);
});

test("로그 redaction은 민감정보 문자열과 키를 가린다", () => {
  assert.equal(
    redactSensitiveString("Bearer abc.def secret=top access_token=token-value"),
    "Bearer [REDACTED] secret=[REDACTED] access_token=[REDACTED]"
  );

  assert.deepEqual(redactSensitiveValue({ streamKey: "abc", nested: { message: "password=hunter2" } }), {
    streamKey: "[REDACTED]",
    nested: { message: "password=[REDACTED]" }
  });
});
