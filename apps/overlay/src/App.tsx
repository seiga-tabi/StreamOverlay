import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessageAddMessage,
  EmergencyShowMessage,
  MissionUpdateMessage,
  OverlayBannerMessage,
  OverlayChannel,
  OverlayMessage,
  ParticipationStreamerProfile,
  ParticipationQueueUpdateMessage,
  ParticipationStatusUpdateMessage,
  ParticipationTeamsUpdateMessage,
  QuestionShowMessage,
  SoloRankProfileUpdateMessage,
  SubtitleBoostMessage,
  SubtitleUpdateMessage
} from "@streamops/shared";
import { validateOverlayMessage } from "@streamops/shared";
import { connectOverlaySocket } from "./socket";
import { overlayDuration, overlayMockMode, overlayMode, overlayPreviewMode, shouldShowOverlay } from "./overlay-runtime";

const EventOverlay = lazy(async () => ({ default: (await import("./overlays/EventOverlay")).EventOverlay }));
const SubtitleOverlay = lazy(async () => ({ default: (await import("./overlays/SubtitleOverlay")).SubtitleOverlay }));
const QuestionOverlay = lazy(async () => ({ default: (await import("./overlays/QuestionOverlay")).QuestionOverlay }));
const MissionOverlay = lazy(async () => ({ default: (await import("./overlays/MissionOverlay")).MissionOverlay }));
const ParticipationOverlay = lazy(async () => ({ default: (await import("./overlays/ParticipationOverlay")).ParticipationOverlay }));
const SoloRankOverlay = lazy(async () => ({ default: (await import("./overlays/SoloRankOverlay")).SoloRankOverlay }));
const ChatOverlay = lazy(async () => ({ default: (await import("./overlays/ChatOverlay")).ChatOverlay }));

type OverlayState = {
  banner?: OverlayBannerMessage;
  subtitle?: SubtitleUpdateMessage;
  subtitleBoost?: SubtitleBoostMessage;
  question?: QuestionShowMessage;
  chatMessages: ChatMessageAddMessage[];
  mission?: MissionUpdateMessage;
  participationQueue?: ParticipationQueueUpdateMessage;
  participationStatus?: ParticipationStatusUpdateMessage;
  teams?: ParticipationTeamsUpdateMessage;
  soloRankProfile?: SoloRankProfileUpdateMessage;
  emergency?: EmergencyShowMessage;
};

const PARTICIPATION_CACHE_KEY = "streamops.overlay.participationState";
const PARTICIPATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SOLO_RANK_CACHE_KEY = "streamops.overlay.soloRankState";
const SOLO_RANK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CachedParticipationState = {
  savedAt: number;
  participationQueue?: ParticipationQueueUpdateMessage;
  participationStatus?: ParticipationStatusUpdateMessage;
  teams?: ParticipationTeamsUpdateMessage;
};

type CachedSoloRankState = {
  savedAt: number;
  soloRankProfile?: SoloRankProfileUpdateMessage;
};

function currentMode(): OverlayChannel {
  return overlayMode(window.location.search);
}

function isMockMode(): boolean {
  return overlayMockMode(window.location.search, import.meta.env.VITE_OVERLAY_MOCK === "true");
}

function isPreviewMode(): boolean {
  return overlayPreviewMode(window.location.search);
}

function validateCachedMessage<T extends OverlayMessage["type"]>(
  value: unknown,
  type: T
): Extract<OverlayMessage, { type: T }> | undefined {
  const validation = validateOverlayMessage(value);
  if (!validation.ok) return undefined;
  const message = value as OverlayMessage;
  return message.type === type ? message as Extract<OverlayMessage, { type: T }> : undefined;
}

function loadCachedParticipationState(): Partial<OverlayState> {
  try {
    const raw = window.localStorage.getItem(PARTICIPATION_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<CachedParticipationState>;
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > PARTICIPATION_CACHE_TTL_MS) {
      window.localStorage.removeItem(PARTICIPATION_CACHE_KEY);
      return {};
    }
    return {
      participationQueue: validateCachedMessage(parsed.participationQueue, "participation.queue.update"),
      participationStatus: validateCachedMessage(parsed.participationStatus, "participation.status.update"),
      teams: validateCachedMessage(parsed.teams, "participation.teams.update")
    };
  } catch {
    return {};
  }
}

function saveCachedParticipationState(state: OverlayState): void {
  try {
    const cache: CachedParticipationState = {
      savedAt: Date.now(),
      participationQueue: state.participationQueue,
      participationStatus: state.participationStatus,
      teams: state.teams
    };
    window.localStorage.setItem(PARTICIPATION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // OBS Browser Source에서 storage가 막힌 경우에도 실시간 overlay 동작은 유지합니다.
  }
}

function loadCachedSoloRankState(): Partial<OverlayState> {
  try {
    const raw = window.localStorage.getItem(SOLO_RANK_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<CachedSoloRankState>;
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > SOLO_RANK_CACHE_TTL_MS) {
      window.localStorage.removeItem(SOLO_RANK_CACHE_KEY);
      return {};
    }
    return {
      soloRankProfile: validateCachedMessage(parsed.soloRankProfile, "solo-rank.profile.update")
    };
  } catch {
    return {};
  }
}

function saveCachedSoloRankState(state: OverlayState): void {
  try {
    const cache: CachedSoloRankState = {
      savedAt: Date.now(),
      soloRankProfile: state.soloRankProfile
    };
    window.localStorage.setItem(SOLO_RANK_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // OBS Browser Source에서 storage가 막힌 경우에도 실시간 overlay 동작은 유지합니다.
  }
}

function championArt(championKey: string) {
  return {
    iconUrl: `https://ddragon.leagueoflegends.com/cdn/16.12.1/img/champion/${championKey}.png`,
    splashUrl: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_0.jpg`,
    loadingUrl: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${championKey}_0.jpg`
  };
}

const mockSoloRankProfile: ParticipationStreamerProfile = {
  displayName: "ゼド",
  profileStatus: "ready",
  mainRole: "MIDDLE",
  mainRoleConfidence: 66,
  ladderRank: 124,
  topChampions: [{ championId: 238, championKey: "Zed", nameKo: "제드", nameJa: "ゼド", ...championArt("Zed"), masteryLevel: 28, masteryPoints: 273918 }],
  rankedStats: { queueType: "RANKED_SOLO_5x5", tier: "DIAMOND", rank: "I", leaguePoints: 75, wins: 123, losses: 97, winRate: 55, summonerLevel: 512, profileIconId: 29, tierIconUrl: "/riot/ranked-emblems/diamond.png?v=ranked-emblems-1", fetchedAt: "2026-06-16T00:00:00.000Z" },
  performanceStats: { sampleSize: 20, averageKills: 5.7, averageDeaths: 4.1, averageAssists: 6.1, kda: 2.85 },
  recentMatches: [
    { championId: 238, championKey: "Zed", nameKo: "제드", nameJa: "ゼド", ...championArt("Zed"), won: true },
    { championId: 103, championKey: "Ahri", nameKo: "아리", nameJa: "アーリ", ...championArt("Ahri"), won: false },
    { championId: 157, championKey: "Yasuo", nameKo: "야스오", nameJa: "ヤスオ", ...championArt("Yasuo"), won: true },
    { championId: 777, championKey: "Yone", nameKo: "요네", nameJa: "ヨネ", ...championArt("Yone"), won: false },
    { championId: 84, championKey: "Akali", nameKo: "아칼리", nameJa: "アカリ", ...championArt("Akali"), won: true },
    { championId: 7, championKey: "Leblanc", nameKo: "르블랑", nameJa: "ルブラン", ...championArt("Leblanc"), won: true },
    { championId: 112, championKey: "Viktor", nameKo: "빅토르", nameJa: "ビクター", ...championArt("Viktor"), won: false },
    { championId: 55, championKey: "Katarina", nameKo: "카타리나", nameJa: "カタリナ", ...championArt("Katarina"), won: true },
    { championId: 91, championKey: "Talon", nameKo: "탈론", nameJa: "タロン", ...championArt("Talon"), won: false },
    { championId: 246, championKey: "Qiyana", nameKo: "키아나", nameJa: "キヤナ", ...championArt("Qiyana"), won: true }
  ],
  rankHistory: [
    { date: "2026-05-18T00:00:00.000Z", tier: "DIAMOND", rank: "II", leaguePoints: 28, wins: 111, losses: 91, rankScore: 2628 },
    { date: "2026-05-24T00:00:00.000Z", tier: "DIAMOND", rank: "II", leaguePoints: 44, wins: 115, losses: 92, rankScore: 2644 },
    { date: "2026-05-31T00:00:00.000Z", tier: "DIAMOND", rank: "II", leaguePoints: 61, wins: 118, losses: 94, rankScore: 2661 },
    { date: "2026-06-08T00:00:00.000Z", tier: "DIAMOND", rank: "I", leaguePoints: 12, wins: 120, losses: 96, rankScore: 2712 },
    { date: "2026-06-16T00:00:00.000Z", tier: "DIAMOND", rank: "I", leaguePoints: 75, wins: 123, losses: 97, rankScore: 2775 }
  ]
};

const mockMessages: OverlayMessage[] = [
  {
    type: "overlay.banner",
    title: "フォローありがとう",
    subtitle: "팔로우 감사합니다",
    message: "ViewerTestさんがフォローしました。",
    variant: "info",
    durationMs: 5000,
    source: "mock",
    eventKind: "follow",
    mediaUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdDAzdXF4M3Mxd2h0cGRpOTVwOHUzYWkwdjlqZHdmZ2YxdDN2dzRtaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oriO0OEd9QIDdllqo/giphy.gif",
    mediaAlt: "follow alert",
    speechEnabled: true,
    speechLanguage: "ja-JP"
  },
  {
    type: "overlay.banner",
    title: "1000 Bits",
    subtitle: "ビッツありがとう / 비트 감사합니다",
    message: "CheerViewerさん、1000 Bitsありがとうございます。",
    variant: "danger",
    durationMs: 6500,
    source: "mock",
    eventKind: "cheer",
    speechEnabled: true,
    speechLanguage: "ja-JP"
  },
  { type: "subtitle.update", sourceLanguage: "ko", targetLanguage: "ja", original: "오늘은 롤 시참을 해볼게요.", translated: "今日はLoL参加型配信をやってみます。", isFinal: true, durationMs: 8000, source: "mock" },
  { type: "question.show", userName: "ViewerTest", question: "다음 판은 어떤 챔피언을 할 예정인가요?", translatedQuestion: "次の試合ではどのチャンピオンを使う予定ですか？", durationMs: 10_000, source: "mock" },
  {
    type: "chat.message.add",
    id: "mock-chat-1",
    userName: "Mina",
    message: "오늘 방송 분위기 너무 좋다! Kappa",
    fragments: [
      { type: "text", text: "오늘 방송 분위기 너무 좋다!" },
      { type: "emote", id: "25", text: "Kappa", imageUrl: "https://static-cdn.jtvnw.net/emoticons/v2/25/static/light/3.0" }
    ],
    translatedMessage: "今日の配信の雰囲気すごくいい！ Kappa",
    translationSourceLanguage: "ko",
    translationTargetLanguage: "ja",
    createdAt: new Date().toISOString(),
    source: "mock"
  },
  { type: "chat.message.add", id: "mock-chat-2", userName: "Streamer", message: "다들 어서와요. 곧 시참 시작합니다.", createdAt: new Date().toISOString(), isBroadcaster: true, source: "mock" },
  { type: "chat.message.add", id: "mock-chat-3", userName: "Yuto", message: "LINE 느낌 채팅창 귀엽네요", createdAt: new Date().toISOString(), source: "mock" },
  { type: "mission.update", title: "오늘의 미션", missions: [{ id: "m1", text: "첫 승 달성", done: false }, { id: "m2", text: "시청자 5인 팀 완성", done: true }], source: "mock" },
  {
    type: "participation.status.update",
    isOpen: true,
    mode: "normal5",
    message: "롤 시참 모집 중",
    streamerProfile: mockSoloRankProfile,
    source: "mock"
  },
  {
    type: "solo-rank.profile.update",
    profile: mockSoloRankProfile,
    region: "KR",
    queueLabel: "Solo/Duo",
    ladderRank: 124,
    source: "mock"
  },
  {
    type: "participation.queue.update",
    isOpen: true,
    queue: [
      { position: 1, twitchUserName: "TopViewer", preferredRole: "top", status: "waitlisted", profileStatus: "ready", mainRole: "TOP", mainRoleConfidence: 62, topChampions: [{ championId: 266, championKey: "Aatrox", nameKo: "아트록스", ...championArt("Aatrox"), masteryLevel: 7, masteryPoints: 230000 }, { championId: 24, championKey: "Jax", nameKo: "잭스", masteryLevel: 7, masteryPoints: 180000 }, { championId: 58, championKey: "Renekton", nameKo: "레넥톤", masteryLevel: 6, masteryPoints: 120000 }], rankedStats: { queueType: "RANKED_SOLO_5x5", tier: "DIAMOND", rank: "II", leaguePoints: 64, wins: 92, losses: 74, winRate: 55, summonerLevel: 421, profileIconId: 29, fetchedAt: "2026-06-16T00:00:00.000Z" } },
      { position: 2, twitchUserName: "JungleViewer", preferredRole: "jungle", status: "verified", profileStatus: "ready", mainRole: "JUNGLE", mainRoleConfidence: 70, topChampions: [{ championId: 64, championKey: "LeeSin", nameKo: "리 신", ...championArt("LeeSin") }, { championId: 121, championKey: "Khazix", nameKo: "카직스" }, { championId: 76, championKey: "Nidalee", nameKo: "니달리" }], rankedStats: { queueType: "RANKED_SOLO_5x5", tier: "PLATINUM", rank: "I", leaguePoints: 22, wins: 68, losses: 61, winRate: 53, summonerLevel: 233, profileIconId: 30, fetchedAt: "2026-06-16T00:00:00.000Z" } },
      { position: 3, twitchUserName: "MidViewer", preferredRole: "mid", status: "pending", profileStatus: "analyzing", mainRole: "MIDDLE", mainRoleConfidence: 48, topChampions: [{ championId: 157, championKey: "Yasuo", nameKo: "야스오", ...championArt("Yasuo") }, { championId: 84, championKey: "Akali", nameKo: "아칼리" }], rankedStats: { queueType: "RANKED_FLEX_SR", tier: "EMERALD", rank: "IV", leaguePoints: 11, wins: 44, losses: 39, winRate: 53, summonerLevel: 198, profileIconId: 31, fetchedAt: "2026-06-16T00:00:00.000Z" } },
      { position: 4, twitchUserName: "AdcViewer", preferredRole: "adc", status: "waitlisted", profileStatus: "ready", mainRole: "BOTTOM", mainRoleConfidence: 56, topChampions: [{ championId: 202, championKey: "Jhin", nameKo: "진", ...championArt("Jhin") }, { championId: 145, championKey: "Kaisa", nameKo: "카이사" }], rankedStats: { queueType: "RANKED_SOLO_5x5", tier: "GOLD", rank: "III", leaguePoints: 78, wins: 51, losses: 50, winRate: 50, summonerLevel: 176, profileIconId: 32, fetchedAt: "2026-06-16T00:00:00.000Z" } },
      { position: 5, twitchUserName: "SupportViewer", preferredRole: "support", status: "waitlisted", profileStatus: "ready", mainRole: "UTILITY", mainRoleConfidence: 64, topChampions: [{ championId: 412, championKey: "Thresh", nameKo: "쓰레쉬", ...championArt("Thresh") }, { championId: 89, championKey: "Leona", nameKo: "레오나" }], rankedStats: { queueType: "UNRANKED", tier: "UNRANKED", leaguePoints: 0, wins: 0, losses: 0, winRate: 0, summonerLevel: 89, profileIconId: 33, fetchedAt: "2026-06-16T00:00:00.000Z" } }
    ],
    source: "mock"
  }
];

function withPreviewDuration(message: OverlayMessage): OverlayMessage {
  if (message.type === "overlay.banner") {
    return {
      ...message,
      durationMs: 60_000,
      soundUrl: undefined,
      speechEnabled: false,
      speechAudioUrl: undefined,
      speechText: undefined
    };
  }
  if ("durationMs" in message) return { ...message, durationMs: 60_000 } as OverlayMessage;
  return message;
}

export default function App() {
  const mode = useMemo(() => currentMode(), []);
  const mockMode = useMemo(() => isMockMode(), []);
  const previewMode = useMemo(() => isPreviewMode(), []);
  const timersRef = useRef<number[]>([]);
  const [connected, setConnected] = useState(mockMode);
  const [state, setState] = useState<OverlayState>(() => ({
    chatMessages: [],
    ...(mockMode ? {} : loadCachedParticipationState()),
    ...(mockMode ? {} : loadCachedSoloRankState())
  }));

  const scheduleTimeout = useCallback((callback: () => void, timeoutMs: number) => {
    const timerId = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((id) => id !== timerId);
      callback();
    }, timeoutMs);
    timersRef.current.push(timerId);
  }, []);

  const clearCompletedBanner = useCallback((banner: OverlayBannerMessage) => {
    setState((previous) => previous.banner === banner ? { ...previous, banner: undefined } : previous);
  }, []);

  const applyMessage = useCallback((message: OverlayMessage) => {
    if (message.type === "overlay.banner") {
      setState((previous) => ({ ...previous, banner: message }));
      return;
    }
    if (message.type === "subtitle.update") {
      setState((previous) => ({ ...previous, subtitle: message }));
      if (message.isFinal) {
        scheduleTimeout(() => setState((previous) => previous.subtitle === message ? { ...previous, subtitle: undefined } : previous), overlayDuration(message, 8000));
      }
      return;
    }
    if (message.type === "subtitle.boost") {
      setState((previous) => ({ ...previous, subtitleBoost: message }));
      scheduleTimeout(() => setState((previous) => previous.subtitleBoost === message ? { ...previous, subtitleBoost: undefined } : previous), overlayDuration(message, 7000));
      return;
    }
    if (message.type === "question.show") {
      setState((previous) => ({ ...previous, question: message }));
      scheduleTimeout(() => setState((previous) => previous.question === message ? { ...previous, question: undefined } : previous), overlayDuration(message, 12_000));
      return;
    }
    if (message.type === "question.clear") {
      setState((previous) => ({ ...previous, question: undefined }));
      return;
    }
    if (message.type === "chat.message.add") {
      setState((previous) => ({ ...previous, chatMessages: [...previous.chatMessages, message].slice(-40) }));
      return;
    }
    if (message.type === "chat.clear") {
      setState((previous) => ({ ...previous, chatMessages: [] }));
      return;
    }
    if (message.type === "mission.update") {
      setState((previous) => ({ ...previous, mission: message }));
      return;
    }
    if (message.type === "participation.queue.update") {
      setState((previous) => ({ ...previous, participationQueue: message }));
      return;
    }
    if (message.type === "participation.status.update") {
      const shouldClearTeams = !message.isOpen || message.phase === "in_game" || message.phase === "game_ended" || message.phase === "closed";
      setState((previous) => ({
        ...previous,
        participationStatus: message,
        teams: shouldClearTeams ? undefined : previous.teams
      }));
      return;
    }
    if (message.type === "solo-rank.profile.update") {
      setState((previous) => ({ ...previous, soloRankProfile: message }));
      return;
    }
    if (message.type === "participation.selected.show") {
      return;
    }
    if (message.type === "participation.selected.clear") {
      return;
    }
    if (message.type === "participation.teams.update") {
      setState((previous) => ({ ...previous, teams: message }));
      return;
    }
    if (message.type === "emergency.show") {
      setState((previous) => ({ ...previous, emergency: message }));
      if (message.durationMs) {
        scheduleTimeout(() => setState((previous) => previous.emergency === message ? { ...previous, emergency: undefined } : previous), message.durationMs);
      }
      return;
    }
    if (message.type === "emergency.clear") {
      setState((previous) => ({ ...previous, emergency: undefined }));
    }
  }, [scheduleTimeout]);

  useEffect(() => {
    if (mockMode) {
      const messages = previewMode ? mockMessages.map(withPreviewDuration) : mockMessages;
      const delayMs = previewMode ? 180 : 650;
      messages.forEach((message, index) => {
        scheduleTimeout(() => applyMessage(message), index * delayMs);
      });
      return undefined;
    }
    return connectOverlaySocket(mode, applyMessage, setConnected);
  }, [applyMessage, mockMode, mode, previewMode, scheduleTimeout]);

  useEffect(() => {
    if (mockMode) return;
    if (mode !== "all" && mode !== "participation") return;
    saveCachedParticipationState(state);
  }, [mockMode, mode, state.participationQueue, state.participationStatus, state.teams]);

  useEffect(() => {
    if (mockMode) return;
    if (mode !== "all" && mode !== "solo-rank") return;
    saveCachedSoloRankState(state);
  }, [mockMode, mode, state.soloRankProfile]);

  useEffect(() => () => {
    for (const timerId of timersRef.current) window.clearTimeout(timerId);
    timersRef.current = [];
  }, []);

  return (
    <div className={`overlay-root mode-${mode}`}>
      <Suspense fallback={null}>
        {shouldShowOverlay(mode, "events") ? <EventOverlay banner={state.banner} emergency={state.emergency} onBannerComplete={clearCompletedBanner} /> : null}
        {shouldShowOverlay(mode, "subtitles") ? <SubtitleOverlay subtitle={state.subtitle} boost={state.subtitleBoost} /> : null}
        {shouldShowOverlay(mode, "questions") ? <QuestionOverlay question={state.question} /> : null}
        {shouldShowOverlay(mode, "chat") ? <ChatOverlay messages={state.chatMessages} /> : null}
        {shouldShowOverlay(mode, "mission") ? <MissionOverlay mission={state.mission} /> : null}
        {shouldShowOverlay(mode, "solo-rank") ? <SoloRankOverlay profile={state.soloRankProfile} /> : null}
        {shouldShowOverlay(mode, "participation") ? (
          <ParticipationOverlay
            queue={state.participationQueue?.queue ?? []}
            queueIsOpen={state.participationQueue?.isOpen}
            status={state.participationStatus}
            teams={state.teams}
          />
        ) : null}
      </Suspense>
      {!connected && !mockMode ? <div className="connection-chip">overlay reconnecting</div> : null}
    </div>
  );
}
