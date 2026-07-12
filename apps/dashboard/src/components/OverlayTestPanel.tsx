import { useState } from "react";
import { apiPost } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../shared/ui/Card";
import { Badge, StatusPill } from "../shared/ui/Status";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastTone,
} from "../shared/ui/Toast";

const i18n = {
  ko: {
    title: "Overlay 테스트",
    description: "고정된 안전 payload만 전송합니다. 솔로랭크 전적은 방송자 Riot ID 기준 실제 데이터를 갱신합니다.",
    sent: "Overlay 테스트 메시지를 전송했습니다.",
    failed: "Overlay 테스트 전송에 실패했습니다.",
    close: "닫기",
    ready: "대기 중",
    sending: "전송 중",
    actionTypeApi: "API 갱신",
    actionTypeOverlay: "Overlay 이벤트",
    banner: "배너",
    follow: "팔로우 알림",
    cheer: "비트 알림",
    subscription: "구독 알림",
    participation: "시참 대기열",
    soloRank: "솔로랭크 전적"
  },
  ja: {
    title: "Overlay テスト",
    description: "固定された安全な payload のみ送信します。ソロランク戦績は配信者 Riot ID 基準の実データを更新します。",
    sent: "Overlay テストメッセージを送信しました。",
    failed: "Overlay テスト送信に失敗しました。",
    close: "閉じる",
    ready: "待機中",
    sending: "送信中",
    actionTypeApi: "API 更新",
    actionTypeOverlay: "Overlay イベント",
    banner: "バナー",
    follow: "フォロー通知",
    cheer: "ビッツ通知",
    subscription: "サブスク通知",
    participation: "参加待機列",
    soloRank: "ソロランク戦績"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

type OverlayTestItem =
  | { label: string; action: unknown; endpoint?: never }
  | { label: string; endpoint: string; action?: never };

function championArt(championKey: string) {
  return {
    splashUrl: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_0.jpg`,
    loadingUrl: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${championKey}_0.jpg`
  };
}

const testActions: OverlayTestItem[] = [
  {
    label: t.banner,
    action: {
      type: "overlay.banner",
      title: "オーバーレイテスト",
      subtitle: "오버레이 테스트",
      message: "ダッシュボードから送信したテスト通知です。",
      variant: "info",
      durationMs: 3000,
      source: "dashboard.overlay_ops",
      eventKind: "test",
      speechEnabled: true,
      speechLanguage: "ja-JP"
    }
  },
  {
    label: t.follow,
    action: {
      type: "overlay.banner",
      title: "フォローありがとう",
      subtitle: "팔로우 감사합니다",
      message: "ViewerTestさんがフォローしました。",
      variant: "info",
      durationMs: 5000,
      source: "dashboard.overlay_ops",
      eventKind: "follow",
      mediaUrl: "",
      mediaAlt: "follow alert",
      soundUrl: "",
      soundVolume: 0.65,
      speechEnabled: true,
      speechLanguage: "ja-JP"
    }
  },
  {
    label: t.cheer,
    action: {
      type: "overlay.banner",
      title: "300 Bits",
      subtitle: "ビッツありがとう / 비트 감사합니다",
      message: "CheerViewerさん、300 Bitsありがとうございます。",
      variant: "warning",
      durationMs: 5500,
      source: "dashboard.overlay_ops",
      eventKind: "cheer",
      mediaUrl: "",
      mediaAlt: "bits alert",
      soundUrl: "",
      soundVolume: 0.7,
      speechEnabled: true,
      speechLanguage: "ja-JP"
    }
  },
  {
    label: t.subscription,
    action: {
      type: "overlay.banner",
      title: "サブスクありがとう",
      subtitle: "구독 감사합니다",
      message: "SubViewerさん、サブスクありがとうございます。",
      variant: "success",
      durationMs: 5500,
      source: "dashboard.overlay_ops",
      eventKind: "subscription",
      mediaUrl: "",
      mediaAlt: "subscription alert",
      soundUrl: "",
      soundVolume: 0.75,
      speechEnabled: true,
      speechLanguage: "ja-JP"
    }
  },
  {
    label: t.participation,
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
      source: "dashboard.overlay_ops"
    }
  },
  {
    label: t.soloRank,
    endpoint: "/api/participation/streamer-profile/refresh"
  }
];

type OverlayTestFeedback = {
  id: number;
  message: string;
  tone: ToastTone;
};

export function OverlayTestPanel() {
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<OverlayTestFeedback | null>(null);

  async function run(item: (typeof testActions)[number]) {
    setBusyLabel(item.label);
    try {
      if (item.endpoint !== undefined) {
        await apiPost(item.endpoint, {});
      } else {
        await apiPost("/api/actions/test", { action: item.action });
      }
      setFeedback({ id: Date.now(), message: `${item.label} · ${t.sent}`, tone: "success" });
    } catch {
      setFeedback({ id: Date.now(), message: `${item.label} · ${t.failed}`, tone: "danger" });
    } finally {
      setBusyLabel(null);
    }
  }

  return (
    <>
      <Card as="section" className="overlay-studio-card overlay-studio-test-panel" padding="lg" variant="glass">
        <CardHeader className="overlay-studio-card-header">
          <div>
            <CardTitle as="h2">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <StatusPill tone={busyLabel ? "warning" : "success"}>
            {busyLabel ? t.sending : t.ready}
          </StatusPill>
        </CardHeader>
        <CardContent>
          <div className="overlay-studio-test-grid" role="group" aria-label={t.title}>
            {testActions.map((item) => (
              <Card as="article" className="overlay-studio-test-item" key={item.label} padding="md" variant="elevated">
                <strong>{item.label}</strong>
                <Badge tone={item.endpoint ? "info" : "streamer"}>
                  {item.endpoint ? t.actionTypeApi : t.actionTypeOverlay}
                </Badge>
                <Button
                  loading={busyLabel === item.label}
                  onClick={() => void run(item)}
                  variant={item.endpoint ? "secondary" : "primary"}
                >
                  {item.label}
                </Button>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <ToastProvider position="bottom-right">
        <ToastViewport className="overlay-studio-toast-viewport">
          {feedback ? (
            <Toast
              autoDismiss
              key={feedback.id}
              onOpenChange={(open) => {
                if (!open) setFeedback(null);
              }}
              tone={feedback.tone}
            >
              <ToastTitle>{feedback.tone === "success" ? t.sent : t.failed}</ToastTitle>
              <ToastDescription>{feedback.message}</ToastDescription>
              <ToastCloseButton aria-label={t.close}>×</ToastCloseButton>
            </Toast>
          ) : null}
        </ToastViewport>
      </ToastProvider>
    </>
  );
}
