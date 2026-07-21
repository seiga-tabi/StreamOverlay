import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { LolAutomationSettings, LolOperationsState, ParticipationState } from "@streamops/shared";
import {
  getLolOperationsState,
  updateLolAutomationSettings,
  type DashboardStreamerInfo,
} from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";
import type { LolOperationsPage as LolOperationsPageId, Page } from "../routing/dashboard-routes";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
  FormControl,
  FormField,
  FormHint,
  FormLabel,
  Input,
  Metric,
  PageHeader,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle,
  SkeletonCard,
  SkeletonText,
  StatusPill,
  type StatusTone,
} from "../shared/ui";
import { MyRiotAccountPage } from "./MyRiotAccountPage";
import { ParticipationPage, type DashboardSnapshot } from "./ParticipationPage";

type LolOperationsPageProps = {
  activePage: LolOperationsPageId;
  onPageChange: (page: Page) => void;
  snapshot: DashboardSnapshot;
  socketConnected: boolean;
  streamer?: DashboardStreamerInfo;
  onStreamerChange: (streamer: DashboardStreamerInfo) => void;
};

const i18n = {
  ko: {
    eyebrow: "Streamer Studio",
    title: "LoL 방송 운영",
    description: "Riot 계정, 게임 감시 자동화, 시청자 참여 운영을 한 흐름에서 관리합니다.",
    loading: "LoL 방송 운영 상태를 불러오는 중입니다.",
    loadFailed: "LoL 방송 운영 상태를 불러오지 못했습니다.",
    retry: "다시 시도",
    accountTab: "계정 연결",
    automationTab: "자동화 설정",
    participationTab: "시참 운영",
    riotApproval: "Riot ID 승인",
    gameMonitor: "게임 감시",
    currentGame: "현재 게임",
    participation: "시참 모집",
    waitingCount: "대기 인원",
    approved: "승인 완료",
    pending: "승인 대기",
    rejected: "승인 거절",
    missing: "연결 필요",
    profileReady: "프로필 확인 완료",
    profilePending: "프로필 확인 필요",
    monitoring: "감시 중",
    waitingForApproval: "승인 대기",
    disabled: "사용 안 함",
    inGame: "게임 진행 중",
    idle: "대기 중",
    unknown: "확인 중",
    recruiting: "모집 중",
    completed: "완료",
    closed: "모집 종료",
    people: "명",
    automationTitle: "게임 감시 자동화",
    automationDescription: "승인된 Riot ID의 게임 상태를 감시하고 시참 대기열 후속 동작을 설정합니다.",
    linkedRiotId: "승인된 Riot ID",
    noLinkedRiotId: "승인된 Riot ID가 없습니다.",
    editInAccount: "계정 연결에서 해결",
    monitorEnabled: "게임 감시 활성화",
    monitorEnabledHelp: "승인된 Riot ID의 게임 시작과 종료를 감시합니다.",
    autoSelectNext: "게임 종료 후 다음 참가자 자동 선택",
    autoSelectNextHelp: "현재 게임이 끝나면 해당 스트리머 대기열의 다음 참가자만 선택합니다.",
    saveAutomation: "자동화 설정 저장",
    automationSaved: "자동화 설정을 저장했습니다.",
    automationSaveFailed: "자동화 설정을 저장하지 못했습니다.",
    approvalRequired: "게임 감시를 켜려면 먼저 Riot ID 승인이 필요합니다.",
  },
  ja: {
    eyebrow: "Streamer Studio",
    title: "LoL 配信運営",
    description: "Riot アカウント、ゲーム監視の自動化、視聴者参加の運営を一つの流れで管理します。",
    loading: "LoL 配信運営の状態を読み込んでいます。",
    loadFailed: "LoL 配信運営の状態を読み込めませんでした。",
    retry: "再試行",
    accountTab: "アカウント連携",
    automationTab: "自動化設定",
    participationTab: "参加運営",
    riotApproval: "Riot ID 承認",
    gameMonitor: "ゲーム監視",
    currentGame: "現在のゲーム",
    participation: "参加募集",
    waitingCount: "待機人数",
    approved: "承認済み",
    pending: "承認待ち",
    rejected: "承認拒否",
    missing: "連携が必要",
    profileReady: "プロフィール確認済み",
    profilePending: "プロフィール確認が必要",
    monitoring: "監視中",
    waitingForApproval: "承認待ち",
    disabled: "無効",
    inGame: "ゲーム中",
    idle: "待機中",
    unknown: "確認中",
    recruiting: "募集中",
    completed: "完了",
    closed: "募集終了",
    people: "人",
    automationTitle: "ゲーム監視の自動化",
    automationDescription: "承認済み Riot ID のゲーム状態を監視し、参加待機列の後続動作を設定します。",
    linkedRiotId: "承認済み Riot ID",
    noLinkedRiotId: "承認済み Riot ID がありません。",
    editInAccount: "アカウント連携で解決",
    monitorEnabled: "ゲーム監視を有効化",
    monitorEnabledHelp: "承認済み Riot ID のゲーム開始と終了を監視します。",
    autoSelectNext: "ゲーム終了後に次の参加者を自動選択",
    autoSelectNextHelp: "現在のゲーム終了後、この配信者の待機列から次の参加者だけを選択します。",
    saveAutomation: "自動化設定を保存",
    automationSaved: "自動化設定を保存しました。",
    automationSaveFailed: "自動化設定を保存できませんでした。",
    approvalRequired: "ゲーム監視を有効にするには、先に Riot ID の承認が必要です。",
  },
} as const;

const t = createDashboardLocaleProxy(i18n);

function apiErrorDetail(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message.replace(/^\/api\/[^ ]+ failed: \d+(?: - )?/, "") || fallback;
}

function approvalStatus(state: LolOperationsState): { label: string; tone: StatusTone } {
  if (state.summary.riotApprovalStatus === "approved") return { label: t.approved, tone: "success" };
  if (state.summary.riotApprovalStatus === "pending") return { label: t.pending, tone: "warning" };
  if (state.summary.riotApprovalStatus === "rejected") return { label: t.rejected, tone: "danger" };
  return { label: t.missing, tone: "neutral" };
}

function monitorStatus(state: LolOperationsState): { label: string; tone: StatusTone } {
  if (state.summary.gameMonitorStatus === "monitoring") return { label: t.monitoring, tone: "success" };
  if (state.summary.gameMonitorStatus === "waiting_for_approval") return { label: t.waitingForApproval, tone: "warning" };
  return { label: t.disabled, tone: "neutral" };
}

function gameStatus(state: LolOperationsState): { label: string; tone: StatusTone } {
  if (state.summary.currentGameStatus === "in_game") return { label: t.inGame, tone: "live" };
  if (state.summary.currentGameStatus === "idle") return { label: t.idle, tone: "neutral" };
  return { label: t.unknown, tone: "warning" };
}

function participationStatus(state: LolOperationsState): { label: string; tone: StatusTone } {
  if (state.summary.participationStatus === "recruiting") return { label: t.recruiting, tone: "success" };
  if (state.summary.participationStatus === "in_game") return { label: t.inGame, tone: "live" };
  if (state.summary.participationStatus === "completed") return { label: t.completed, tone: "info" };
  return { label: t.closed, tone: "neutral" };
}

function participationSummary(state: ParticipationState): Pick<LolOperationsState["summary"], "currentGameStatus" | "participationStatus" | "waitingCount"> {
  const currentGameStatus = state.session?.status === "in_game" || state.activeQueue.some((entry) => entry.status === "in_game")
    ? "in_game"
    : state.session
      ? "idle"
      : "unknown";
  return {
    currentGameStatus,
    participationStatus: state.session?.status ?? (state.isOpen ? "recruiting" : "closed"),
    waitingCount: state.summary.waiting,
  };
}

export function LolOperationsPage({
  activePage,
  onPageChange,
  snapshot,
  socketConnected,
  streamer,
  onStreamerChange,
}: LolOperationsPageProps) {
  const [state, setState] = useState<LolOperationsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [automation, setAutomation] = useState<Pick<LolAutomationSettings, "enabled" | "autoSelectNextAfterGame">>({
    enabled: false,
    autoSelectNextAfterGame: true,
  });
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationMessage, setAutomationMessage] = useState("");

  const refreshState = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const nextState = await getLolOperationsState();
      setState(nextState);
      setAutomation({
        enabled: nextState.automation.enabled,
        autoSelectNextAfterGame: nextState.automation.autoSelectNextAfterGame,
      });
    } catch (error) {
      setLoadError(apiErrorDetail(error, t.loadFailed));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const handleParticipationStateChange = useCallback((participation: ParticipationState) => {
    setState((current) => current ? {
      ...current,
      participation,
      summary: {
        ...current.summary,
        ...participationSummary(participation),
      },
    } : current);
  }, []);

  const participationSnapshot = useMemo<DashboardSnapshot>(() => {
    if (socketConnected) return snapshot;
    if (!state) return snapshot;
    return {
      participationState: state.participation,
      participationQueue: state.participation.queue,
      status: { participation: state.participation.isOpen ? "open" : "closed" },
    };
  }, [snapshot, socketConnected, state]);

  async function saveAutomation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!state || automationSaving) return;
    setAutomationSaving(true);
    setAutomationMessage("");
    try {
      const result = await updateLolAutomationSettings({ ...automation, announceInChat: false });
      setState(result.state);
      setAutomation({
        enabled: result.settings.enabled,
        autoSelectNextAfterGame: result.settings.autoSelectNextAfterGame,
      });
      setAutomationMessage(t.automationSaved);
    } catch (error) {
      setAutomationMessage(apiErrorDetail(error, t.automationSaveFailed));
    } finally {
      setAutomationSaving(false);
    }
  }

  if (loading && !state) {
    return (
      <section className="lol-operations-page" aria-label={t.loading}>
        <SkeletonCard className="lol-operations-loading" loadingLabel={t.loading} size="lg">
          <SkeletonText lines={5} size="lg" />
        </SkeletonCard>
      </section>
    );
  }

  if (!state) {
    return (
      <section className="lol-operations-page">
        <EmptyState className="lol-operations-empty" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle data-ko={i18n.ko.loadFailed} data-ja={i18n.ja.loadFailed}>{t.loadFailed}</EmptyStateTitle>
          <EmptyStateDescription>{loadError || t.loadFailed}</EmptyStateDescription>
          <EmptyStateActions>
            <Button onClick={() => void refreshState()} data-ko={i18n.ko.retry} data-ja={i18n.ja.retry}>{t.retry}</Button>
          </EmptyStateActions>
        </EmptyState>
      </section>
    );
  }

  const approval = approvalStatus(state);
  const monitor = monitorStatus(state);
  const game = gameStatus(state);
  const participation = participationStatus(state);
  const identityApproved = state.summary.riotApprovalStatus === "approved";
  const automationBlocked = !identityApproved && automation.enabled;

  return (
    <section className="lol-operations-page">
      <PageHeader className="lol-operations-header" layout="split">
        <PageHeaderEyebrow data-ko={i18n.ko.eyebrow} data-ja={i18n.ja.eyebrow}>{t.eyebrow}</PageHeaderEyebrow>
        <PageHeaderTitle data-ko={i18n.ko.title} data-ja={i18n.ja.title}>{t.title}</PageHeaderTitle>
        <PageHeaderDescription data-ko={i18n.ko.description} data-ja={i18n.ja.description}>{t.description}</PageHeaderDescription>
        <PageHeaderStatus>
          <StatusPill tone={approval.tone}>{approval.label}</StatusPill>
        </PageHeaderStatus>
      </PageHeader>

      <div className="lol-operations-summary" aria-label={t.title}>
        <Metric label={t.riotApproval} value={approval.label} tone={approval.tone} status={state.identity?.profileStatus ? <Badge tone="info" size="sm">{t.profileReady}</Badge> : undefined} />
        <Metric label={t.gameMonitor} value={monitor.label} tone={monitor.tone} />
        <Metric label={t.currentGame} value={game.label} tone={game.tone} />
        <Metric label={t.participation} value={participation.label} tone={participation.tone} />
        <Metric label={t.waitingCount} value={`${state.summary.waitingCount}${t.people}`} tone={state.summary.waitingCount > 0 ? "info" : "neutral"} />
      </div>

      <div className="lol-operations-tabs" role="tablist" aria-label={t.title}>
        <Button role="tab" aria-selected={activePage === "lolAccount"} variant={activePage === "lolAccount" ? "primary" : "ghost"} onClick={() => onPageChange("lolAccount")}>
          <span data-ko={i18n.ko.accountTab} data-ja={i18n.ja.accountTab}>{t.accountTab}</span>
        </Button>
        <Button role="tab" aria-selected={activePage === "lolAutomation"} variant={activePage === "lolAutomation" ? "primary" : "ghost"} onClick={() => onPageChange("lolAutomation")}>
          <span data-ko={i18n.ko.automationTab} data-ja={i18n.ja.automationTab}>{t.automationTab}</span>
        </Button>
        <Button role="tab" aria-selected={activePage === "lolParticipation"} variant={activePage === "lolParticipation" ? "primary" : "ghost"} onClick={() => onPageChange("lolParticipation")}>
          <span data-ko={i18n.ko.participationTab} data-ja={i18n.ja.participationTab}>{t.participationTab}</span>
        </Button>
      </div>

      <div className="lol-operations-panel" role="tabpanel">
        {activePage === "lolAccount" ? (
          <MyRiotAccountPage
            embedded
            streamer={streamer}
            onStreamerChange={onStreamerChange}
            onIdentityChange={() => void refreshState()}
          />
        ) : null}

        {activePage === "lolAutomation" ? (
          <div className="lol-operations-automation">
            <Card as="section" className="lol-operations-automation-card" padding="lg" variant="glass">
              <CardHeader>
                <div>
                  <CardTitle data-ko={i18n.ko.automationTitle} data-ja={i18n.ja.automationTitle}>{t.automationTitle}</CardTitle>
                  <CardDescription data-ko={i18n.ko.automationDescription} data-ja={i18n.ja.automationDescription}>{t.automationDescription}</CardDescription>
                </div>
                <StatusPill tone={monitor.tone}>{monitor.label}</StatusPill>
              </CardHeader>
              <CardContent>
                <form className="lol-operations-automation-form" onSubmit={(event) => void saveAutomation(event)}>
                  <FormField controlId="lol-operations-riot-id" readOnly>
                    <FormLabel data-ko={i18n.ko.linkedRiotId} data-ja={i18n.ja.linkedRiotId}>{t.linkedRiotId}</FormLabel>
                    <FormControl>
                      <Input id="lol-operations-riot-id" value={state.identity?.normalizedRiotId ?? t.noLinkedRiotId} readOnly />
                    </FormControl>
                    <FormHint>{identityApproved ? t.profileReady : t.approvalRequired}</FormHint>
                  </FormField>

                  {!identityApproved ? (
                    <div className="lol-operations-approval-required" role="status">
                      <StatusPill tone="warning">{t.approvalRequired}</StatusPill>
                      <Button variant="secondary" onClick={() => onPageChange("lolAccount")}>{t.editInAccount}</Button>
                    </div>
                  ) : null}

                  <div className="lol-operations-toggle-list">
                    <label className="lol-operations-toggle-row">
                      <Input
                        className="lol-operations-toggle-input"
                        type="checkbox"
                        checked={automation.enabled}
                        disabled={!identityApproved && !automation.enabled}
                        onChange={(event) => setAutomation((current) => ({ ...current, enabled: event.target.checked }))}
                      />
                      <span>
                        <strong data-ko={i18n.ko.monitorEnabled} data-ja={i18n.ja.monitorEnabled}>{t.monitorEnabled}</strong>
                        <small data-ko={i18n.ko.monitorEnabledHelp} data-ja={i18n.ja.monitorEnabledHelp}>{t.monitorEnabledHelp}</small>
                      </span>
                    </label>
                    <label className="lol-operations-toggle-row">
                      <Input
                        className="lol-operations-toggle-input"
                        type="checkbox"
                        checked={automation.autoSelectNextAfterGame}
                        onChange={(event) => setAutomation((current) => ({ ...current, autoSelectNextAfterGame: event.target.checked }))}
                      />
                      <span>
                        <strong data-ko={i18n.ko.autoSelectNext} data-ja={i18n.ja.autoSelectNext}>{t.autoSelectNext}</strong>
                        <small data-ko={i18n.ko.autoSelectNextHelp} data-ja={i18n.ja.autoSelectNextHelp}>{t.autoSelectNextHelp}</small>
                      </span>
                    </label>
                  </div>

                  <div className="lol-operations-automation-actions">
                    <Button type="submit" loading={automationSaving} disabled={automationBlocked}>{t.saveAutomation}</Button>
                    {automationMessage ? <StatusPill tone={automationMessage === t.automationSaved ? "success" : "danger"}>{automationMessage}</StatusPill> : null}
                  </div>
                </form>
              </CardContent>
            </Card>

          </div>
        ) : null}

        {activePage === "lolParticipation" ? (
          <ParticipationPage
            embedded
            snapshot={participationSnapshot}
            onStateChange={handleParticipationStateChange}
          />
        ) : null}
      </div>
    </section>
  );
}
