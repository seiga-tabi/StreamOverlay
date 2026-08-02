import { useEffect, useState, type FormEvent } from "react";
import type { DashboardStreamerInfo } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";
import { AppShell, AppShellHeader, AppShellMain } from "../shared/ui/AppShell";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../shared/ui/Card";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../shared/ui/EmptyState";
import { FormControl, FormField, FormHint, FormLabel, Input } from "../shared/ui/Form";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle,
} from "../shared/ui/PageHeader";
import { Badge, Metric, StatusPill } from "../shared/ui/Status";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastTone,
} from "../shared/ui/Toast";

type AccountToast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

const i18n = {
  ko: {
    title: "내 Riot ID",
    description: "방송에 사용할 Riot ID를 확인하고 안전하게 변경합니다.",
    studio: "Riot 계정",
    status: "등록 상태",
    approved: "승인 완료",
    current: "현재",
    twitchAccount: "Twitch 계정",
    riotAccount: "Riot 계정",
    connected: "연결됨",
    verified: "확인됨",
    accountOverview: "계정 상태",
    connectedServices: "연결 서비스",
    connectedServicesValue: "2개",
    connectedServicesDescription: "Twitch · Riot",
    approvalState: "방송인 승인",
    profileVisibility: "공개 전적",
    publicAvailable: "공개 가능",
    connectedAccountsTitle: "연결된 계정",
    connectedAccountsDescription: "방송과 전적 검색에 사용되는 계정을 확인합니다.",
    previewTitle: "검색 결과 미리보기",
    previewDescription: "저장한 Riot ID는 공개 전적 검색과 스트리머 프로필에 표시됩니다.",
    previewEyebrow: "Riot 플레이어",
    pendingPreview: "저장 전 미리보기",
    savedPreview: "현재 공개 정보",
    currentRiotId: "현재 Riot ID",
    riotIdChange: "Riot ID 변경",
    riotIdDescription: "게임명과 태그를 변경했다면 새로운 Riot ID를 게임명#태그 형식으로 입력하세요.",
    riotIdInput: "새 Riot ID",
    riotIdPlaceholder: "게임명#태그",
    saveRiotId: "Riot ID 저장",
    riotIdSaved: "Riot ID를 저장했습니다.",
    riotIdSaveFailed: "Riot ID 저장에 실패했습니다.",
    openRecord: "공개 전적 보기",
    openTwitch: "Twitch 채널 열기",
    registrationRequired: "방송인 등록이 필요합니다.",
    registrationRequiredBody: "Riot ID를 등록하려면 먼저 YORO.gg 방송인 등록과 승인을 완료해주세요.",
    registrationAction: "방송인 등록 화면으로 이동",
    formatHint: "게임명#태그 형식으로 입력합니다.",
    close: "닫기",
  },
  ja: {
    title: "自分の Riot ID",
    description: "配信で使用する Riot ID を確認し、安全に変更します。",
    studio: "Riot アカウント",
    status: "登録状態",
    approved: "承認済み",
    current: "現在",
    twitchAccount: "Twitch アカウント",
    riotAccount: "Riot アカウント",
    connected: "連携済み",
    verified: "確認済み",
    accountOverview: "アカウント状態",
    connectedServices: "連携サービス",
    connectedServicesValue: "2件",
    connectedServicesDescription: "Twitch・Riot",
    approvalState: "配信者承認",
    profileVisibility: "公開戦績",
    publicAvailable: "公開可能",
    connectedAccountsTitle: "連携アカウント",
    connectedAccountsDescription: "配信と戦績検索に使用するアカウントを確認します。",
    previewTitle: "検索結果プレビュー",
    previewDescription: "保存した Riot ID は公開戦績検索と配信者プロフィールに表示されます。",
    previewEyebrow: "Riot プレイヤー",
    pendingPreview: "保存前プレビュー",
    savedPreview: "現在の公開情報",
    currentRiotId: "現在の Riot ID",
    riotIdChange: "Riot ID 変更",
    riotIdDescription: "ゲーム名またはタグを変更した場合は、新しい Riot ID をゲーム名#タグ形式で入力してください。",
    riotIdInput: "新しい Riot ID",
    riotIdPlaceholder: "ゲーム名#タグ",
    saveRiotId: "Riot IDを保存",
    riotIdSaved: "Riot IDを保存しました。",
    riotIdSaveFailed: "Riot IDの保存に失敗しました。",
    openRecord: "公開戦績を見る",
    openTwitch: "Twitch チャンネルを開く",
    registrationRequired: "配信者登録が必要です。",
    registrationRequiredBody: "Riot IDを登録するには、先にYORO.ggの配信者登録と承認を完了してください。",
    registrationAction: "配信者登録画面へ",
    formatHint: "ゲーム名#タグ形式で入力します。",
    close: "閉じる",
  },
} as const;

const t = createDashboardLocaleProxy(i18n);

function currentRiotId(streamer: DashboardStreamerInfo | undefined): string {
  return streamer ? `${streamer.riotGameName}#${streamer.riotTagLine}` : "";
}

function publicSummonerPath(streamer: DashboardStreamerInfo): string {
  return `/lol/summoners/jp/${encodeURIComponent(`${streamer.riotGameName}-${streamer.riotTagLine}`)}`;
}

function twitchChannelUrl(streamer: DashboardStreamerInfo): string {
  return `https://www.twitch.tv/${encodeURIComponent(streamer.twitchLogin)}`;
}

function apiErrorDetail(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message.replace(/^\/api\/[^ ]+ failed: \d+(?: - )?/, "") || fallback;
}

export function MyRiotAccountPage({
  streamer,
  onStreamerChange,
  onUpdateRiotId,
  registrationHref = "/dashboard/streaming",
}: {
  streamer?: DashboardStreamerInfo;
  onStreamerChange?: (streamer: DashboardStreamerInfo) => void;
  onUpdateRiotId?: (riotId: string) => Promise<DashboardStreamerInfo>;
  registrationHref?: string;
}) {
  const [riotIdDraft, setRiotIdDraft] = useState(() => currentRiotId(streamer));
  const [riotIdBusy, setRiotIdBusy] = useState(false);
  const [riotIdMessage, setRiotIdMessage] = useState("");
  const [toast, setToast] = useState<AccountToast | null>(null);

  useEffect(() => {
    setRiotIdDraft(currentRiotId(streamer));
  }, [streamer?.riotGameName, streamer?.riotTagLine]);

  function showToast(tone: ToastTone, title: string, description?: string): void {
    setToast({ id: Date.now(), tone, title, description });
  }

  async function saveRiotId(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!streamer || riotIdBusy) return;
    const riotId = riotIdDraft.normalize("NFKC").trim();
    if (!riotId || riotId === currentRiotId(streamer)) return;

    setRiotIdBusy(true);
    setRiotIdMessage("");
    try {
      if (!onUpdateRiotId) throw new Error("riot_id_update_unavailable");
      const updated = await onUpdateRiotId(riotId);
      onStreamerChange?.(updated);
      setRiotIdDraft(currentRiotId(updated));
      setRiotIdMessage(t.riotIdSaved);
      showToast("success", t.riotIdSaved);
    } catch (error) {
      const detail = apiErrorDetail(error, t.riotIdSaveFailed);
      setRiotIdMessage(detail);
      showToast("danger", t.riotIdSaveFailed, detail);
    } finally {
      setRiotIdBusy(false);
    }
  }

  if (!streamer) {
    return (
      <AppShell as="section" className="settings-shared-shell my-riot-account-shell" mainId="my-riot-account-main" skipLinkLabel={t.title} variant="streamer">
        <AppShellHeader className="settings-shared-header">
          <PageHeader className="settings-shared-page-header" layout="split">
            <PageHeaderEyebrow>{t.studio}</PageHeaderEyebrow>
            <PageHeaderTitle data-ko={i18n.ko.title} data-ja={i18n.ja.title}>{t.title}</PageHeaderTitle>
            <PageHeaderDescription data-ko={i18n.ko.description} data-ja={i18n.ja.description}>{t.description}</PageHeaderDescription>
            <PageHeaderStatus>
              <StatusPill tone="warning">{t.registrationRequired}</StatusPill>
            </PageHeaderStatus>
          </PageHeader>
        </AppShellHeader>
        <AppShellMain className="settings-shared-main" id="my-riot-account-main">
          <EmptyState className="settings-shared-empty" variant="streamer">
            <EmptyStateIcon>R</EmptyStateIcon>
            <EmptyStateTitle as="h2" data-ko={i18n.ko.registrationRequired} data-ja={i18n.ja.registrationRequired}>{t.registrationRequired}</EmptyStateTitle>
            <EmptyStateDescription data-ko={i18n.ko.registrationRequiredBody} data-ja={i18n.ja.registrationRequiredBody}>{t.registrationRequiredBody}</EmptyStateDescription>
            <EmptyStateActions>
              <Button as="a" href={registrationHref} data-ko={i18n.ko.registrationAction} data-ja={i18n.ja.registrationAction}>{t.registrationAction}</Button>
            </EmptyStateActions>
          </EmptyState>
        </AppShellMain>
      </AppShell>
    );
  }

  const savedRiotId = currentRiotId(streamer);
  const normalizedDraft = riotIdDraft.normalize("NFKC").trim();
  const draftChanged = Boolean(normalizedDraft && normalizedDraft !== savedRiotId);
  const previewRiotId = normalizedDraft || savedRiotId;
  const saveDisabled = riotIdBusy || !normalizedDraft || normalizedDraft === savedRiotId;

  return (
    <ToastProvider position="top-right">
      <AppShell
        as="section"
        className="settings-shared-shell my-riot-account-shell"
        mainId="my-riot-account-main"
        skipLinkLabel={t.title}
        variant="streamer"
      >
        <AppShellHeader className="settings-shared-header my-riot-account-hero">
          <PageHeader className="settings-shared-page-header" layout="split">
            <PageHeaderEyebrow>{t.studio}</PageHeaderEyebrow>
            <PageHeaderTitle data-ko={i18n.ko.title} data-ja={i18n.ja.title}>{t.title}</PageHeaderTitle>
            <PageHeaderDescription data-ko={i18n.ko.description} data-ja={i18n.ja.description}>{t.description}</PageHeaderDescription>
            <PageHeaderStatus>
              <StatusPill tone="success" data-ko={i18n.ko.approved} data-ja={i18n.ja.approved}>{t.approved}</StatusPill>
            </PageHeaderStatus>
            <PageHeaderActions>
              <Badge tone="streamer" data-ko={i18n.ko.current} data-ja={i18n.ja.current}>{t.current}</Badge>
            </PageHeaderActions>
          </PageHeader>
        </AppShellHeader>

        <AppShellMain className="settings-shared-main" id="my-riot-account-main">
          <section aria-label={t.accountOverview} className="my-riot-account-metrics">
            <Metric
              description={t.connectedServicesDescription}
              label={t.connectedServices}
              size="lg"
              status={<StatusPill tone="success" size="sm">{t.connected}</StatusPill>}
              tone="info"
              value={t.connectedServicesValue}
            />
            <Metric
              description={t.status}
              label={t.approvalState}
              size="lg"
              status={<StatusPill tone="success" size="sm">{t.verified}</StatusPill>}
              tone="success"
              value={t.approved}
            />
            <Metric
              description={savedRiotId}
              label={t.profileVisibility}
              size="lg"
              status={<StatusPill tone="info" size="sm">{t.current}</StatusPill>}
              tone="streamer"
              value={t.publicAvailable}
            />
          </section>

          <div className="settings-shared-grid my-riot-account-grid">
            <Card as="section" className="settings-shared-card my-riot-connected-card" id="my-riot-account-profile" padding="lg" variant="glass">
              <CardHeader className="settings-shared-card-header">
                <div>
                  <CardTitle as="h2">{t.connectedAccountsTitle}</CardTitle>
                  <CardDescription>{t.connectedAccountsDescription}</CardDescription>
                </div>
                <StatusPill tone="success" size="sm">{t.connectedServicesValue}</StatusPill>
              </CardHeader>
              <CardContent className="my-riot-connected-list">
                <article className="my-riot-connected-row">
                  <span className="my-riot-avatar">
                    {streamer.twitchProfileImageUrl ? (
                      <img src={streamer.twitchProfileImageUrl} alt={streamer.twitchDisplayName} />
                    ) : streamer.twitchDisplayName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <small>{t.twitchAccount}</small>
                    <strong>{streamer.twitchDisplayName}</strong>
                    <span>@{streamer.twitchLogin}</span>
                  </div>
                  <StatusPill tone="success" size="sm">{t.connected}</StatusPill>
                  <Button as="a" href={twitchChannelUrl(streamer)} target="_blank" rel="noreferrer" variant="secondary" size="sm" data-ko={i18n.ko.openTwitch} data-ja={i18n.ja.openTwitch}>
                    {t.openTwitch}
                  </Button>
                </article>
                <article className="my-riot-connected-row">
                  <span aria-hidden="true" className="my-riot-provider-mark">R</span>
                  <div>
                    <small>{t.riotAccount}</small>
                    <strong>{savedRiotId}</strong>
                    <span>{t.publicAvailable}</span>
                  </div>
                  <StatusPill tone="info" size="sm">{t.verified}</StatusPill>
                </article>
              </CardContent>
            </Card>

            <Card as="section" className="settings-shared-card my-riot-preview-card" padding="lg" variant="elevated">
              <CardHeader className="settings-shared-card-header">
                <div>
                  <CardTitle as="h2">{t.previewTitle}</CardTitle>
                  <CardDescription>{t.previewDescription}</CardDescription>
                </div>
                <StatusPill tone={draftChanged ? "warning" : "success"} size="sm">
                  {draftChanged ? t.pendingPreview : t.savedPreview}
                </StatusPill>
              </CardHeader>
              <CardContent className="my-riot-preview-content">
                <span aria-hidden="true" className="my-riot-preview-mark">R</span>
                <div>
                  <small>{t.previewEyebrow}</small>
                  <strong>{previewRiotId}</strong>
                  <StatusPill tone={draftChanged ? "warning" : "success"} size="sm">
                    {draftChanged ? t.pendingPreview : t.verified}
                  </StatusPill>
                </div>
              </CardContent>
            </Card>

            <Card as="section" className="settings-shared-card my-riot-account-card featured wide my-riot-settings-card" id="my-riot-account-riot" padding="lg" variant="glass">
              <CardHeader className="settings-shared-card-header">
                <div>
                  <CardTitle as="h2" data-ko={i18n.ko.riotIdChange} data-ja={i18n.ja.riotIdChange}>{t.riotIdChange}</CardTitle>
                  <CardDescription data-ko={i18n.ko.riotIdDescription} data-ja={i18n.ja.riotIdDescription}>{t.riotIdDescription}</CardDescription>
                </div>
                <StatusPill tone="info">{streamer.riotTagLine}</StatusPill>
              </CardHeader>
              <CardContent className="settings-shared-card-content">
                <Metric label={t.currentRiotId} value={savedRiotId} tone="streamer" />
                <form className="settings-shared-form my-riot-id-form" onSubmit={(event) => void saveRiotId(event)}>
                  <FormField controlId="my-riot-id-input" disabled={riotIdBusy} required>
                    <FormLabel data-ko={i18n.ko.riotIdInput} data-ja={i18n.ja.riotIdInput}>{t.riotIdInput}</FormLabel>
                    <FormControl>
                      <Input
                        id="my-riot-id-input"
                        value={riotIdDraft}
                        placeholder={t.riotIdPlaceholder}
                        maxLength={80}
                        autoComplete="off"
                        aria-describedby="my-riot-id-hint"
                        onChange={(event) => setRiotIdDraft(event.target.value)}
                        disabled={riotIdBusy}
                      />
                    </FormControl>
                    <FormHint id="my-riot-id-hint" data-ko={i18n.ko.formatHint} data-ja={i18n.ja.formatHint}>{t.formatHint}</FormHint>
                  </FormField>
                  <CardFooter className="settings-shared-actions settings-shared-actions--flush">
                    <Button type="submit" loading={riotIdBusy} disabled={saveDisabled} data-ko={i18n.ko.saveRiotId} data-ja={i18n.ja.saveRiotId}>{t.saveRiotId}</Button>
                    <Button as="a" href={publicSummonerPath(streamer)} target="_blank" rel="noreferrer" variant="secondary" data-ko={i18n.ko.openRecord} data-ja={i18n.ja.openRecord}>
                      {t.openRecord}
                    </Button>
                  </CardFooter>
                </form>
                {riotIdMessage ? (
                  <StatusPill role={riotIdMessage === t.riotIdSaved ? "status" : "alert"} tone={riotIdMessage === t.riotIdSaved ? "success" : "danger"}>
                    {riotIdMessage}
                  </StatusPill>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </AppShellMain>
      </AppShell>

      <ToastViewport className="settings-shared-toast-viewport">
        {toast ? (
          <Toast key={toast.id} autoDismiss tone={toast.tone} onDismiss={() => setToast(null)}>
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description ? <ToastDescription>{toast.description}</ToastDescription> : null}
            <ToastCloseButton aria-label={t.close}>×</ToastCloseButton>
          </Toast>
        ) : null}
      </ToastViewport>
    </ToastProvider>
  );
}
