import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessageAddMessage,
  EmergencyShowMessage,
  MissionUpdateMessage,
  OverlayBannerMessage,
  OverlayChannel,
  OverlayMessage,
  ParticipationQueueUpdateMessage,
  ParticipationStatusUpdateMessage,
  ParticipationTeamsUpdateMessage,
  QuestionShowMessage,
  SubtitleBoostMessage,
  SubtitleUpdateMessage
} from "@streamops/shared";
import { normalizeOverlayChannel } from "@streamops/shared";
import { connectOverlaySocket } from "./socket";

const EventOverlay = lazy(async () => ({ default: (await import("./overlays/EventOverlay")).EventOverlay }));
const SubtitleOverlay = lazy(async () => ({ default: (await import("./overlays/SubtitleOverlay")).SubtitleOverlay }));
const QuestionOverlay = lazy(async () => ({ default: (await import("./overlays/QuestionOverlay")).QuestionOverlay }));
const MissionOverlay = lazy(async () => ({ default: (await import("./overlays/MissionOverlay")).MissionOverlay }));
const ParticipationOverlay = lazy(async () => ({ default: (await import("./overlays/ParticipationOverlay")).ParticipationOverlay }));
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
  emergency?: EmergencyShowMessage;
};

function currentMode(): OverlayChannel {
  const params = new URLSearchParams(window.location.search);
  return normalizeOverlayChannel(params.get("mode"));
}

function isMockMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("mock") === "1" || params.get("mock") === "true" || import.meta.env.VITE_OVERLAY_MOCK === "true";
}

function isPreviewMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("preview") === "1" || params.get("preview") === "true";
}

function shouldShow(mode: OverlayChannel, target: OverlayChannel): boolean {
  return mode === "all" || mode === target;
}

function duration(message: { durationMs?: number } | undefined, fallback: number): number {
  return message?.durationMs ?? fallback;
}

function championArt(championKey: string) {
  return {
    splashUrl: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_0.jpg`,
    loadingUrl: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${championKey}_0.jpg`
  };
}

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
  { type: "participation.status.update", isOpen: true, mode: "normal5", message: "롤 시참 모집 중", source: "mock" },
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
  if ("durationMs" in message) return { ...message, durationMs: 60_000 } as OverlayMessage;
  return message;
}

export default function App() {
  const mode = useMemo(() => currentMode(), []);
  const mockMode = useMemo(() => isMockMode(), []);
  const previewMode = useMemo(() => isPreviewMode(), []);
  const timersRef = useRef<number[]>([]);
  const [connected, setConnected] = useState(mockMode);
  const [state, setState] = useState<OverlayState>({ chatMessages: [] });

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
        scheduleTimeout(() => setState((previous) => previous.subtitle === message ? { ...previous, subtitle: undefined } : previous), duration(message, 8000));
      }
      return;
    }
    if (message.type === "subtitle.boost") {
      setState((previous) => ({ ...previous, subtitleBoost: message }));
      scheduleTimeout(() => setState((previous) => previous.subtitleBoost === message ? { ...previous, subtitleBoost: undefined } : previous), duration(message, 7000));
      return;
    }
    if (message.type === "question.show") {
      setState((previous) => ({ ...previous, question: message }));
      scheduleTimeout(() => setState((previous) => previous.question === message ? { ...previous, question: undefined } : previous), duration(message, 12_000));
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
      setState((previous) => ({ ...previous, participationStatus: message }));
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

  useEffect(() => () => {
    for (const timerId of timersRef.current) window.clearTimeout(timerId);
    timersRef.current = [];
  }, []);

  return (
    <div className={`overlay-root mode-${mode}`}>
      <Suspense fallback={null}>
        {shouldShow(mode, "events") ? <EventOverlay banner={state.banner} emergency={state.emergency} onBannerComplete={clearCompletedBanner} /> : null}
        {shouldShow(mode, "subtitles") ? <SubtitleOverlay subtitle={state.subtitle} boost={state.subtitleBoost} /> : null}
        {shouldShow(mode, "questions") ? <QuestionOverlay question={state.question} /> : null}
        {shouldShow(mode, "chat") ? <ChatOverlay messages={state.chatMessages} /> : null}
        {shouldShow(mode, "mission") ? <MissionOverlay mission={state.mission} /> : null}
        {shouldShow(mode, "participation") ? (
          <ParticipationOverlay
            queue={state.participationQueue?.queue ?? []}
            status={state.participationStatus}
            teams={state.teams}
          />
        ) : null}
      </Suspense>
      {!connected && !mockMode ? <div className="connection-chip">overlay reconnecting</div> : null}
    </div>
  );
}
