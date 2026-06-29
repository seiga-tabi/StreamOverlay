import { apiPost } from "../api/client";
import { uiText } from "../i18n";

function championArt(championKey: string) {
  return {
    splashUrl: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_0.jpg`,
    loadingUrl: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${championKey}_0.jpg`
  };
}

function safeActions() {
  const t = uiText.actionTester;
  return [
    {
      label: t.actions.banner,
      action: {
        type: "overlay.banner",
        title: "ダッシュボードテスト",
        subtitle: "Dashboard 테스트",
        message: "ダッシュボードから送信したテスト通知です。",
        variant: "info",
        durationMs: 3000,
        source: "dashboard.test",
        eventKind: "test",
        speechEnabled: true,
        speechLanguage: "ja-JP"
      }
    },
    {
      label: t.actions.subtitle,
      action: {
        type: "overlay.subtitle",
        sourceLanguage: "ko",
        targetLanguage: "ja",
        original: "오늘은 롤 시참을 해볼게요.",
        translated: "今日はLoL参加型配信をやってみます。",
        isFinal: true,
        durationMs: 6000,
        source: "dashboard.test"
      }
    },
    {
      label: t.actions.question,
      action: {
        type: "overlay.question",
        userName: "ViewerTest",
        question: "오늘 첫 게임 목표는 무엇인가요?",
        translatedQuestion: "今日の最初の試合の目標は何ですか？",
        durationMs: 9000,
        source: "dashboard.test"
      }
    },
    {
      label: t.actions.participation,
      action: {
        type: "overlay.participationQueue",
        isOpen: true,
        queue: [
          { position: 1, twitchUserName: "TopViewer", preferredRole: "top", status: "waitlisted", profileStatus: "ready", mainRole: "TOP", mainRoleConfidence: 62, topChampions: [{ championId: 266, championKey: "Aatrox", nameKo: "아트록스", ...championArt("Aatrox") }, { championId: 24, championKey: "Jax", nameKo: "잭스" }], rankedStats: { queueType: "RANKED_SOLO_5x5", tier: "DIAMOND", rank: "II", leaguePoints: 64, wins: 92, losses: 74, winRate: 55, summonerLevel: 421, profileIconId: 29, fetchedAt: "2026-06-16T00:00:00.000Z" } },
          { position: 2, twitchUserName: "JungleViewer", preferredRole: "jungle", status: "verified", profileStatus: "ready", mainRole: "JUNGLE", mainRoleConfidence: 70, topChampions: [{ championId: 64, championKey: "LeeSin", nameKo: "리 신", ...championArt("LeeSin") }, { championId: 121, championKey: "Khazix", nameKo: "카직스" }], rankedStats: { queueType: "RANKED_SOLO_5x5", tier: "PLATINUM", rank: "I", leaguePoints: 22, wins: 68, losses: 61, winRate: 53, summonerLevel: 233, profileIconId: 30, fetchedAt: "2026-06-16T00:00:00.000Z" } },
          { position: 3, twitchUserName: "MidViewer", preferredRole: "mid", status: "pending" },
          { position: 4, twitchUserName: "AdcViewer", preferredRole: "adc", status: "waitlisted" },
          { position: 5, twitchUserName: "SupportViewer", preferredRole: "support", status: "waitlisted" }
        ],
        source: "dashboard.test"
      }
    },
    {
      label: t.actions.mission,
      action: {
        type: "overlay.mission",
        title: "오늘의 미션",
        missions: [
          { id: "win", text: "첫 승 달성", done: false },
          { id: "team", text: "시청자 5인 팀 완성", done: true },
          { id: "highlight", text: "하이라이트 3개 만들기", done: false }
        ],
        source: "dashboard.test"
      }
    },
    {
      label: t.actions.replay,
      action: { type: "obs.saveReplayBuffer" }
    },
    {
      label: t.actions.scene,
      action: { type: "obs.setScene", sceneName: "메인" }
    }
  ];
}

export function ActionTester() {
  const t = uiText.actionTester;
  const actions = safeActions();

  async function run(action: unknown) {
    try {
      await apiPost("/api/actions/test", { action });
      alert(t.sent);
    } catch (error) {
      alert(`${t.failPrefix}: ${String(error)}`);
    }
  }

  return (
    <div className="card">
      <h2>{t.title}</h2>
      <p className="muted">{t.description}</p>
      <div className="button-row">
        {actions.map((item) => (
          <button key={item.label} onClick={() => void run(item.action)}>{item.label}</button>
        ))}
      </div>
    </div>
  );
}
