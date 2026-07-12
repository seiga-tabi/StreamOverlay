import { useState } from "react";
import { apiPost } from "../api/client";
import { createDashboardLocaleProxy, uiText } from "../i18n";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../shared/ui/Card";
import { FormControl, FormField, FormLabel } from "../shared/ui/Form";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../shared/ui/Modal";
import { StatusPill } from "../shared/ui/Status";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastTone,
} from "../shared/ui/Toast";

const actionTesterUi = createDashboardLocaleProxy({
  ko: {
    actionGroup: "안전한 테스트 액션",
    close: "닫기",
    failureTitle: "전송 실패",
    resultTitle: "테스트 결과",
    successTitle: "전송 완료"
  },
  ja: {
    actionGroup: "安全なテストアクション",
    close: "閉じる",
    failureTitle: "送信失敗",
    resultTitle: "テスト結果",
    successTitle: "送信完了"
  }
});

type ActionFeedback = {
  id: number;
  description: string;
  title: string;
  tone: ToastTone;
};

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
      label: t.actions.replay,
      action: { type: "obs.saveReplayBuffer" }
    },
    {
      label: t.actions.scene,
      action: { type: "obs.setScene", sceneName: "메인" }
    }
  ];
}

export function ActionTester({ id }: { id?: string }) {
  const t = uiText.actionTester;
  const ui = actionTesterUi;
  const actions = safeActions();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [result, setResult] = useState<ActionFeedback | null>(null);

  async function run(label: string, action: unknown) {
    setBusyAction(label);
    try {
      await apiPost("/api/actions/test", { action });
      const nextFeedback = {
        description: `${label} · ${t.sent}`,
        id: Date.now(),
        title: ui.successTitle,
        tone: "success" as const
      };
      setFeedback(nextFeedback);
      setResult(nextFeedback);
    } catch (error) {
      const nextFeedback = {
        description: `${label} · ${t.failPrefix}: ${String(error)}`,
        id: Date.now(),
        title: ui.failureTitle,
        tone: "danger" as const
      };
      setFeedback(nextFeedback);
      setResult(nextFeedback);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <Card as="section" className="dashboard-shared-action-tester" id={id} padding="lg" variant="glass">
        <CardHeader>
          <CardTitle as="h2">{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => event.preventDefault()}>
            <FormField controlId="dashboard-action-buttons">
              <FormLabel className="dashboard-shared-visually-hidden">{ui.actionGroup}</FormLabel>
              <FormControl>
                <div
                  className="button-row dashboard-shared-action-buttons"
                  id="dashboard-action-buttons"
                  role="group"
                  aria-label={ui.actionGroup}
                >
                  {actions.map((item) => (
                    <Button
                      disabled={busyAction === item.label}
                      key={item.label}
                      loading={busyAction === item.label}
                      onClick={() => void run(item.label, item.action)}
                      variant="primary"
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </FormControl>
            </FormField>
          </form>
        </CardContent>
      </Card>

      <ToastProvider position="bottom-right">
        <ToastViewport className="dashboard-shared-toast-viewport">
          {feedback ? (
            <Toast
              autoDismiss
              key={feedback.id}
              onOpenChange={(open) => {
                if (!open) {
                  setFeedback(null);
                }
              }}
              tone={feedback.tone}
            >
              <ToastTitle>{feedback.title}</ToastTitle>
              <ToastDescription>{feedback.description}</ToastDescription>
              <ToastCloseButton aria-label={ui.close}>×</ToastCloseButton>
            </Toast>
          ) : null}
        </ToastViewport>
      </ToastProvider>

      <Modal
        closeOnBackdrop
        onOpenChange={(open) => {
          if (!open) {
            setResult(null);
          }
        }}
        open={Boolean(result)}
        size="md"
      >
        <ModalHeader>
          <ModalTitle>{ui.resultTitle}</ModalTitle>
          <ModalDescription>{t.description}</ModalDescription>
        </ModalHeader>
        {result ? (
          <ModalContent>
            <div className="dashboard-shared-result-status">
              <StatusPill tone={result.tone}>{result.title}</StatusPill>
              <p>{result.description}</p>
            </div>
          </ModalContent>
        ) : null}
        <ModalFooter>
          <ModalCloseButton aria-label={ui.close}>{ui.close}</ModalCloseButton>
        </ModalFooter>
      </Modal>
    </>
  );
}
