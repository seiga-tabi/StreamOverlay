import test from "node:test";
import assert from "node:assert/strict";
import {
  overlayChannelForMessage,
  overlayMessageMatchesChannel,
  parseRiotIdDetailed,
  validateOverlayMessage
} from "../dist/index.js";

test("Riot ID parser는 gameName#tagLine 형식을 파싱하고 tagLine 누락을 설명한다", () => {
  const valid = parseRiotIdDetailed("Hide On Bush#KR1");
  assert.equal(valid.ok, true);
  assert.equal(valid.ok ? valid.gameName : "", "Hide On Bush");
  assert.equal(valid.ok ? valid.tagLine : "", "KR1");

  const missingTag = parseRiotIdDetailed("HideOnBush");
  assert.equal(missingTag.ok, false);
  assert.equal(missingTag.ok ? "" : missingTag.code, "missing_tag");
  assert.match(missingTag.ok ? "" : missingTag.message, /gameName#tagLine/);
  assert.match(missingTag.ok ? "" : missingTag.message, /JP｜/);
  assert.match(missingTag.ok ? "" : missingTag.message, /KR｜/);

  const unsafe = parseRiotIdDetailed("<script>#KR1");
  assert.equal(unsafe.ok, false);
});

test("overlay message schema는 유효한 banner를 허용한다", () => {
  const result = validateOverlayMessage({
    type: "overlay.banner",
    title: "通知テスト",
    subtitle: "배너 테스트",
    message: "테스트 배너입니다.",
    variant: "success",
    durationMs: 4000,
    source: "dashboard.test",
    eventKind: "follow",
    mediaUrl: "/alerts/follow.gif",
    mediaAlt: "follow alert",
    soundUrl: "https://example.com/follow.mp3",
    soundVolume: 0.6,
    speechEnabled: true,
    speechText: "フォローありがとうございます。",
    speechAudioUrl: "/tts/follow.wav",
    speechLanguage: "ja-JP",
    speechRate: 1,
    speechPitch: 1,
    speechVolume: 0.9
  });
  assert.equal(result.ok, true);
});

test("overlay banner speech 설정은 언어와 수치 범위를 검증한다", () => {
  const language = validateOverlayMessage({
    type: "overlay.banner",
    message: "通知",
    speechEnabled: true,
    speechLanguage: "en-US"
  });
  assert.equal(language.ok, false);

  const rate = validateOverlayMessage({
    type: "overlay.banner",
    message: "通知",
    speechEnabled: true,
    speechLanguage: "ja-JP",
    speechRate: 3
  });
  assert.equal(rate.ok, false);
});

test("overlay banner media와 sound URL은 안전한 경로만 허용한다", () => {
  const media = validateOverlayMessage({
    type: "overlay.banner",
    message: "알림",
    mediaUrl: "javascript:alert(1)"
  });
  assert.equal(media.ok, false);

  const sound = validateOverlayMessage({
    type: "overlay.banner",
    message: "알림",
    soundUrl: "/../secret.mp3"
  });
  assert.equal(sound.ok, false);
});

test("overlay message schema는 raw payload 필드를 거부한다", () => {
  const result = validateOverlayMessage({
    type: "overlay.banner",
    message: "raw 포함",
    raw: { token: "secret" }
  });
  assert.equal(result.ok, false);
});

test("overlay channel filtering은 message type 기준으로 동작한다", () => {
  const message = {
    type: "subtitle.update",
    sourceLanguage: "ko",
    targetLanguage: "ja",
    translated: "こんにちは",
    isFinal: true
  };
  assert.equal(overlayChannelForMessage(message), "subtitles");
  assert.equal(overlayMessageMatchesChannel(message, "subtitles"), true);
  assert.equal(overlayMessageMatchesChannel(message, "events"), false);
  assert.equal(overlayMessageMatchesChannel(message, "all"), true);
});

test("chat overlay schema는 안전한 채팅 메시지만 허용하고 chat channel로 라우팅한다", () => {
  const message = {
    type: "chat.message.add",
    id: "chat-1",
    userName: "Viewer",
    profileImageUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer-profile_image.png",
    message: "안녕하세요",
    fragments: [
      { type: "text", text: "안녕하세요" },
      { type: "emote", id: "25", text: "Kappa", imageUrl: "https://static-cdn.jtvnw.net/emoticons/v2/25/static/light/3.0" }
    ],
    translatedMessage: "こんにちは",
    translationSourceLanguage: "ko",
    translationTargetLanguage: "ja",
    createdAt: "2026-06-17T00:00:00.000Z",
    isBroadcaster: false,
    source: "twitch.chat"
  };
  assert.equal(validateOverlayMessage(message).ok, true);
  assert.equal(overlayChannelForMessage(message), "chat");
  assert.equal(overlayMessageMatchesChannel(message, "chat"), true);
  assert.equal(overlayMessageMatchesChannel(message, "events"), false);
});

test("chat overlay schema는 profileImageUrl을 https URL로 제한한다", () => {
  const result = validateOverlayMessage({
    type: "chat.message.add",
    userName: "Viewer",
    profileImageUrl: "javascript:alert(1)",
    message: "안녕하세요"
  });
  assert.equal(result.ok, false);
});

test("chat overlay schema는 안전하지 않은 emote imageUrl을 거부한다", () => {
  const result = validateOverlayMessage({
    type: "chat.message.add",
    userName: "Viewer",
    message: "Kappa",
    fragments: [
      { type: "emote", id: "25", text: "Kappa", imageUrl: "http://static-cdn.jtvnw.net/emoticons/v2/25/static/light/3.0" }
    ]
  });
  assert.equal(result.ok, false);
});

test("chat overlay schema는 번역문에 언어 정보를 요구한다", () => {
  const result = validateOverlayMessage({
    type: "chat.message.add",
    userName: "Viewer",
    message: "안녕하세요",
    translatedMessage: "こんにちは"
  });
  assert.equal(result.ok, false);
});

test("chat overlay schema는 raw payload 필드를 거부한다", () => {
  const result = validateOverlayMessage({
    type: "chat.message.add",
    userName: "Viewer",
    message: "안녕하세요",
    raw: { token: "secret" }
  });
  assert.equal(result.ok, false);
});

test("participation status overlay schema는 게임 phase와 다음 후보를 허용한다", () => {
  const result = validateOverlayMessage({
    type: "participation.status.update",
    isOpen: true,
    mode: "normal5",
    phase: "game_ended",
    nextCandidate: {
      position: 1,
      twitchUserName: "NextViewer",
      preferredRole: "mid",
      status: "selected",
      mainRole: "MIDDLE",
      mainRoleConfidence: 65
    }
  });
  assert.equal(result.ok, true);
});

test("participation status overlay schema는 방송자 프로필 표시 정보를 허용하고 Riot ID는 거부한다", () => {
  const valid = validateOverlayMessage({
    type: "participation.status.update",
    isOpen: true,
    mode: "normal5",
    streamerProfile: {
      displayName: "Streamer",
      profileStatus: "ready",
      mainRole: "MIDDLE",
      mainRoleConfidence: 66,
      topChampions: [
        {
          championId: 103,
          championKey: "Ahri",
          nameKo: "아리",
          nameJa: "アーリ",
          splashUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg",
          masteryLevel: 7,
          masteryPoints: 315000
        }
      ],
      performanceStats: { sampleSize: 20, averageKills: 5.7, averageDeaths: 4.1, averageAssists: 6.1, kda: 2.85 }
    }
  });
  assert.equal(valid.ok, true);

  const invalid = validateOverlayMessage({
    type: "participation.status.update",
    isOpen: true,
    streamerProfile: {
      displayName: "Streamer",
      riotId: "Streamer#KR1"
    }
  });
  assert.equal(invalid.ok, false);
});

test("solo rank overlay schema는 방송자 전적 프로필을 허용하고 solo-rank channel로 라우팅한다", () => {
  const message = {
    type: "solo-rank.profile.update",
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
        },
        {
          championId: 103,
          championKey: "Ahri",
          nameKo: "아리",
          nameJa: "アーリ",
          iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.12.1/img/champion/Ahri.png",
          won: false
        }
      ]
    }
  };

  assert.equal(validateOverlayMessage(message).ok, true);
  assert.equal(overlayChannelForMessage(message), "solo-rank");
  assert.equal(overlayMessageMatchesChannel(message, "solo-rank"), true);
  assert.equal(overlayMessageMatchesChannel(message, "events"), false);

  const invalid = validateOverlayMessage({
    ...message,
    profile: {
      ...message.profile,
      performanceStats: { ...message.profile.performanceStats, puuid: "secret" }
    }
  });
  assert.equal(invalid.ok, false);
});

test("participation overlay schema는 Riot ID 노출 필드를 거부한다", () => {
  const result = validateOverlayMessage({
    type: "participation.queue.update",
    queue: [
      {
        position: 1,
        twitchUserName: "viewer",
        riotId: "HideOnBush#KR1",
        status: "waitlisted"
      }
    ]
  });
  assert.equal(result.ok, false);
});

test("participation overlay schema는 안전한 랭크 전적 필드를 허용한다", () => {
  const result = validateOverlayMessage({
    type: "participation.queue.update",
    queue: [
      {
        position: 1,
        twitchUserName: "viewer",
        preferredRole: "mid",
        status: "verified",
        rankedStats: {
          queueType: "RANKED_SOLO_5x5",
          tier: "DIAMOND",
          rank: "II",
          leaguePoints: 64,
          wins: 92,
          losses: 74,
          winRate: 55,
          summonerLevel: 421,
          profileIconId: 29,
          fetchedAt: "2026-06-16T00:00:00.000Z"
        }
      }
    ]
  });
  assert.equal(result.ok, true);
});

test("participation overlay schema는 rankedStats 내부의 미허용 필드를 거부한다", () => {
  const result = validateOverlayMessage({
    type: "participation.queue.update",
    queue: [
      {
        position: 1,
        twitchUserName: "viewer",
        status: "verified",
        rankedStats: {
          queueType: "RANKED_SOLO_5x5",
          tier: "DIAMOND",
          rank: "II",
          leaguePoints: 64,
          wins: 92,
          losses: 74,
          winRate: 55,
          fetchedAt: "2026-06-16T00:00:00.000Z",
          puuid: "secret"
        }
      }
    ]
  });
  assert.equal(result.ok, false);
});

test("participation overlay schema는 주라인과 모스트 챔피언을 허용하되 PUUID를 거부한다", () => {
  const valid = validateOverlayMessage({
    type: "participation.queue.update",
    queue: [
      {
        position: 1,
        twitchUserName: "viewer",
        status: "verified",
        profileStatus: "ready",
        mainRole: "MIDDLE",
        mainRoleConfidence: 70,
        topChampions: [
          {
            championId: 157,
            championKey: "Yasuo",
            nameKo: "야스오",
            nameJa: "ヤスオ",
            splashUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yasuo_0.jpg",
            loadingUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Yasuo_0.jpg",
            imageVersion: "16.12.1",
            imageLocale: "neutral",
            skinNum: 0,
            masteryLevel: 24,
            masteryPoints: 100000
          }
        ]
      }
    ]
  });
  assert.equal(valid.ok, true);

  const invalid = validateOverlayMessage({
    type: "participation.queue.update",
    queue: [
      {
        position: 1,
        twitchUserName: "viewer",
        status: "verified",
        profileStatus: "ready",
        mainRole: "MIDDLE",
        topChampions: [{ championId: 157, nameKo: "야스오", puuid: "secret" }]
      }
    ]
  });
  assert.equal(invalid.ok, false);

  const invalidLocale = validateOverlayMessage({
    type: "participation.queue.update",
    queue: [
      {
        position: 1,
        twitchUserName: "viewer",
        status: "verified",
        topChampions: [{ championId: 157, nameKo: "야스오", imageLocale: "ja_JP" }]
      }
    ]
  });
  assert.equal(invalidLocale.ok, false);
});

test("React text 렌더링용 문자열은 HTML이어도 schema에서 구조로 확장되지 않는다", () => {
  const result = validateOverlayMessage({
    type: "question.show",
    userName: "<img src=x onerror=alert(1)>",
    question: "<script>alert(1)</script>",
    translatedQuestion: "安全な文字列として扱う"
  });
  assert.equal(result.ok, true);
});
