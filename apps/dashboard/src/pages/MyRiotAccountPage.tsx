import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { DashboardStreamerInfo } from "../api/client";
import {
  addYoroRiotAccount,
  deleteYoroRiotAccount,
  getYoroRiotAccounts,
  setYoroMainRiotAccount,
  type StreamerRiotAccount,
} from "../features/yoro-dashboard/api";
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
import { FormControl, FormError, FormField, FormHint, FormLabel, Input } from "../shared/ui/Form";
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
    description: "방송에 사용할 Riot 계정을 등록하고 대표 계정을 지정합니다.",
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
    riotIdChange: "대표 계정 이름 변경",
    riotIdDescription: "대표 계정의 게임명이나 태그를 실제로 변경(개명)했다면 새 Riot ID를 게임명#태그 형식으로 입력하세요. 다른 계정을 추가하려면 위의 서브 계정 추가를 사용합니다.",
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
    riotAccountsTitle: "Riot 계정 목록",
    riotAccountsDescription: "대표 계정은 스트리머 카드와 게임 모니터에 사용되고, 서브 계정으로 검색해도 같은 스트리머로 연결됩니다.",
    mainAccount: "대표 계정",
    subAccount: "서브 계정",
    mainHint: "스트리머 카드와 게임 모니터가 이 계정을 씁니다.",
    subHint: "이 계정으로 검색해도 같은 스트리머로 연결됩니다.",
    pendingReview: "승인 대기",
    pendingHint: "승인 후 공개 전적에 연결됩니다.",
    rejectedBadge: "승인 거절",
    rejectedHint: "삭제 후 다시 추가할 수 있습니다.",
    setMain: "대표로 지정",
    remove: "삭제",
    removeConfirmText: "삭제할까요? 이 계정으로는 더 이상 스트리머가 연결되지 않습니다.",
    removeConfirm: "삭제",
    removeCancel: "취소",
    addTitle: "서브 계정 추가",
    addLabel: "추가할 Riot ID",
    addAction: "계정 추가",
    accountsLoading: "계정 목록을 불러오는 중입니다.",
    accountsLoadFailed: "계정 목록을 불러오지 못했습니다.",
    accountsRetry: "다시 시도",
    emptySubTitle: "등록한 서브 계정이 없습니다.",
    emptySubDescription: "부계정 전적도 연결되게 하려면 계정을 추가하세요.",
    accountAdded: "서브 계정 등록을 신청했습니다. 승인 후 반영됩니다.",
    accountAddFailed: "서브 계정 추가에 실패했습니다.",
    accountRemoved: "계정을 삭제했습니다.",
    accountRemoveFailed: "계정 삭제에 실패했습니다.",
    mainChanged: "대표 계정을 변경했습니다.",
    mainChangedMonitor: "게임 모니터가 이제 이 계정을 추적합니다.",
    mainChangeFailed: "대표 계정 변경에 실패했습니다.",
    metricAccounts: "등록 Riot 계정",
    metricAccountsUnit: (count: number) => `${count}개`,
    remaining: (count: number) => `서브 계정 ${count}개 더 추가할 수 있습니다.`,
    limitReached: (limit: number) => `서브 계정은 최대 ${limit}개입니다.`,
    setMainAria: (riotId: string) => `${riotId}을(를) 대표 계정으로 지정`,
    removeAria: (riotId: string) => `${riotId} 삭제`,
  },
  ja: {
    title: "自分の Riot ID",
    description: "配信で使用する Riot アカウントを登録し、メインを設定します。",
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
    riotIdChange: "メインアカウントの名前を変更",
    riotIdDescription: "メインアカウントのゲーム名やタグを実際に変更した場合は、新しい Riot ID をゲーム名#タグ形式で入力してください。別のアカウントを追加する場合は上のサブアカウント追加を使用します。",
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
    riotAccountsTitle: "Riot アカウント一覧",
    riotAccountsDescription: "メインアカウントは配信者カードとゲームモニターに使用され、サブアカウントで検索しても同じ配信者に紐づきます。",
    mainAccount: "メインアカウント",
    subAccount: "サブアカウント",
    mainHint: "配信者カードとゲームモニターがこのアカウントを使用します。",
    subHint: "このアカウントで検索しても同じ配信者に紐づきます。",
    pendingReview: "承認待ち",
    pendingHint: "承認後に公開戦績へ反映されます。",
    rejectedBadge: "承認却下",
    rejectedHint: "削除してから再度追加できます。",
    setMain: "メインに設定",
    remove: "削除",
    removeConfirmText: "削除しますか？このアカウントでは配信者が紐づかなくなります。",
    removeConfirm: "削除",
    removeCancel: "キャンセル",
    addTitle: "サブアカウントを追加",
    addLabel: "追加する Riot ID",
    addAction: "アカウント追加",
    accountsLoading: "アカウント一覧を読み込んでいます。",
    accountsLoadFailed: "アカウント一覧を読み込めませんでした。",
    accountsRetry: "再試行",
    emptySubTitle: "登録済みのサブアカウントはありません。",
    emptySubDescription: "サブアカウントの戦績も紐づけるにはアカウントを追加してください。",
    accountAdded: "サブアカウントの登録を申請しました。承認後に反映されます。",
    accountAddFailed: "サブアカウントの追加に失敗しました。",
    accountRemoved: "アカウントを削除しました。",
    accountRemoveFailed: "アカウントの削除に失敗しました。",
    mainChanged: "メインアカウントを変更しました。",
    mainChangedMonitor: "ゲームモニターはこのアカウントを追跡します。",
    mainChangeFailed: "メインアカウントの変更に失敗しました。",
    metricAccounts: "登録 Riot アカウント",
    metricAccountsUnit: (count: number) => `${count}件`,
    remaining: (count: number) => `サブアカウントをあと ${count} 件追加できます。`,
    limitReached: (limit: number) => `サブアカウントは最大 ${limit} 件です。`,
    setMainAria: (riotId: string) => `${riotId} をメインアカウントに設定`,
    removeAria: (riotId: string) => `${riotId} を削除`,
  },
} as const;

const t = createDashboardLocaleProxy(i18n);

function currentRiotId(streamer: DashboardStreamerInfo | undefined): string {
  return streamer ? `${streamer.riotGameName}#${streamer.riotTagLine}` : "";
}

function publicSummonerPath(gameName: string, tagLine: string): string {
  return `/lol/summoners/jp/${encodeURIComponent(`${gameName}-${tagLine}`)}`;
}

function twitchChannelUrl(streamer: DashboardStreamerInfo): string {
  return `https://www.twitch.tv/${encodeURIComponent(streamer.twitchLogin)}`;
}

function apiErrorDetail(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message.replace(/^\/api\/[^ ]+ failed: \d+(?: - )?/, "") || fallback;
}

function AccountRow({
  account,
  busy,
  confirming,
  onAskRemove,
  onCancelRemove,
  onRemove,
  onSetMain,
}: {
  account: StreamerRiotAccount;
  busy: boolean;
  confirming: boolean;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
  onSetMain: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const isPending = account.status === "pending";
  const isRejected = account.status === "rejected";
  const roleLabel = account.isMain ? t.mainAccount : t.subAccount;
  const hint = account.isMain
    ? t.mainHint
    : isPending
      ? t.pendingHint
      : isRejected
        ? t.rejectedHint
        : t.subHint;

  return (
    <li
      className={`my-riot-connected-row my-riot-account-row${account.isMain ? " is-main" : ""}${isPending ? " is-pending" : ""}`}
    >
      <span aria-hidden="true" className="my-riot-provider-mark">R</span>
      <div>
        <small>
          {roleLabel}
          {account.isMain ? (
            <StatusPill tone="info" size="sm">{t.mainAccount}</StatusPill>
          ) : isPending ? (
            <StatusPill tone="warning" size="sm">{t.pendingReview}</StatusPill>
          ) : isRejected ? (
            <StatusPill tone="danger" size="sm">{t.rejectedBadge}</StatusPill>
          ) : (
            <StatusPill tone="success" size="sm">{t.connected}</StatusPill>
          )}
        </small>
        <strong>{account.riotId}</strong>
        <span>{hint}</span>
      </div>
      <span className="my-riot-account-actions">
        {!account.isMain && account.status === "approved" ? (
          <Button
            aria-label={t.setMainAria(account.riotId)}
            disabled={busy}
            onClick={onSetMain}
            size="sm"
            variant="secondary"
          >
            {t.setMain}
          </Button>
        ) : null}
        {!account.isMain ? (
          <Button
            aria-label={t.removeAria(account.riotId)}
            disabled={busy || confirming}
            onClick={onAskRemove}
            size="sm"
            variant="ghost"
          >
            {t.remove}
          </Button>
        ) : null}
      </span>
      {confirming ? (
        <span className="my-riot-account-confirm" role="alert">
          <span>{t.removeConfirmText}</span>
          <span className="my-riot-account-confirm-actions">
            <Button disabled={busy} onClick={onCancelRemove} size="sm" variant="secondary">
              {t.removeCancel}
            </Button>
            <Button disabled={busy} loading={busy} onClick={onRemove} ref={confirmRef} size="sm" variant="danger">
              {t.removeConfirm}
            </Button>
          </span>
        </span>
      ) : null}
    </li>
  );
}

export function MyRiotAccountPage({
  streamer,
  csrfToken,
  onStreamerChange,
  onUpdateRiotId,
  registrationHref = "/dashboard/streaming",
}: {
  streamer?: DashboardStreamerInfo;
  csrfToken?: string;
  onStreamerChange?: (streamer: DashboardStreamerInfo) => void;
  onUpdateRiotId?: (riotId: string) => Promise<DashboardStreamerInfo>;
  registrationHref?: string;
}) {
  const [riotIdDraft, setRiotIdDraft] = useState(() => currentRiotId(streamer));
  const [riotIdBusy, setRiotIdBusy] = useState(false);
  const [riotIdMessage, setRiotIdMessage] = useState("");
  const [toast, setToast] = useState<AccountToast | null>(null);
  const [accounts, setAccounts] = useState<StreamerRiotAccount[] | null>(null);
  const [subLimit, setSubLimit] = useState(4);
  const [accountsError, setAccountsError] = useState("");
  const [addDraft, setAddDraft] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState("");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    setRiotIdDraft(currentRiotId(streamer));
  }, [streamer?.riotGameName, streamer?.riotTagLine]);

  const loadAccounts = useCallback(() => {
    if (!streamer) return;
    setAccountsError("");
    getYoroRiotAccounts()
      .then((response) => {
        setAccounts(response.accounts);
        setSubLimit(response.limit.sub);
      })
      .catch((error) => {
        setAccountsError(apiErrorDetail(error, t.accountsLoadFailed));
      });
  }, [streamer?.twitchUserId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  function showToast(tone: ToastTone, title: string, description?: string): void {
    setToast({ id: Date.now(), tone, title, description });
  }

  /* 대표 계정이 바뀌면 부모의 streamer 정보(개명 폼·미리보기 기준)도 함께 갱신합니다. */
  function syncStreamerWithMain(nextAccounts: StreamerRiotAccount[]): void {
    const main = nextAccounts.find((account) => account.isMain);
    if (!streamer || !main) return;
    if (main.riotGameName === streamer.riotGameName && main.riotTagLine === streamer.riotTagLine) return;
    onStreamerChange?.({ ...streamer, riotGameName: main.riotGameName, riotTagLine: main.riotTagLine });
  }

  async function submitAddAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!csrfToken || addBusy) return;
    const riotId = addDraft.normalize("NFKC").trim();
    if (!riotId) return;
    if (!/^[^#]+#[^#]+$/u.test(riotId)) {
      setAddError(t.formatHint);
      return;
    }
    setAddBusy(true);
    setAddError("");
    try {
      const response = await addYoroRiotAccount(riotId, csrfToken);
      setAccounts(response.accounts);
      setSubLimit(response.limit.sub);
      setAddDraft("");
      showToast("success", t.accountAdded);
    } catch (error) {
      setAddError(apiErrorDetail(error, t.accountAddFailed));
    } finally {
      setAddBusy(false);
    }
  }

  async function setMainAccount(account: StreamerRiotAccount): Promise<void> {
    if (!csrfToken || rowBusyId) return;
    setRowBusyId(account.id);
    try {
      const response = await setYoroMainRiotAccount(account.id, csrfToken);
      setAccounts(response.accounts);
      setSubLimit(response.limit.sub);
      syncStreamerWithMain(response.accounts);
      showToast("success", t.mainChanged, t.mainChangedMonitor);
    } catch (error) {
      showToast("danger", t.mainChangeFailed, apiErrorDetail(error, t.mainChangeFailed));
    } finally {
      setRowBusyId(null);
    }
  }

  async function removeAccount(account: StreamerRiotAccount): Promise<void> {
    if (!csrfToken || rowBusyId) return;
    setRowBusyId(account.id);
    try {
      const response = await deleteYoroRiotAccount(account.id, csrfToken);
      setAccounts(response.accounts);
      setSubLimit(response.limit.sub);
      setConfirmRemoveId(null);
      showToast("success", t.accountRemoved);
    } catch (error) {
      showToast("danger", t.accountRemoveFailed, apiErrorDetail(error, t.accountRemoveFailed));
    } finally {
      setRowBusyId(null);
    }
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
      loadAccounts();
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

  const mainAccount = accounts?.find((account) => account.isMain);
  const savedRiotId = mainAccount?.riotId ?? currentRiotId(streamer);
  const normalizedDraft = riotIdDraft.normalize("NFKC").trim();
  const draftChanged = Boolean(normalizedDraft && normalizedDraft !== savedRiotId);
  const previewRiotId = normalizedDraft || savedRiotId;
  const saveDisabled = riotIdBusy || !normalizedDraft || normalizedDraft === savedRiotId;
  const subAccounts = accounts?.filter((account) => !account.isMain) ?? [];
  const activeSubCount = subAccounts.filter((account) => account.status !== "rejected").length;
  const remainingSubSlots = Math.max(0, subLimit - activeSubCount);
  const canAddSub = Boolean(csrfToken) && remainingSubSlots > 0;
  const accountCount = accounts?.length ?? 1;
  const mainPublicPath = mainAccount
    ? publicSummonerPath(mainAccount.riotGameName, mainAccount.riotTagLine)
    : publicSummonerPath(streamer.riotGameName, streamer.riotTagLine);

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
              label={t.metricAccounts}
              size="lg"
              status={<StatusPill tone="success" size="sm">{t.connected}</StatusPill>}
              tone="info"
              value={t.metricAccountsUnit(accountCount)}
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

            <Card as="section" className="settings-shared-card my-riot-account-card featured wide my-riot-accounts-card" id="my-riot-account-list" padding="lg" variant="glass">
              <CardHeader className="settings-shared-card-header">
                <div>
                  <CardTitle as="h2" data-ko={i18n.ko.riotAccountsTitle} data-ja={i18n.ja.riotAccountsTitle}>{t.riotAccountsTitle}</CardTitle>
                  <CardDescription data-ko={i18n.ko.riotAccountsDescription} data-ja={i18n.ja.riotAccountsDescription}>{t.riotAccountsDescription}</CardDescription>
                </div>
                <StatusPill tone={remainingSubSlots > 0 ? "info" : "warning"} size="sm">
                  {remainingSubSlots > 0 ? t.remaining(remainingSubSlots) : t.limitReached(subLimit)}
                </StatusPill>
              </CardHeader>
              <CardContent className="my-riot-accounts-content">
                {accountsError ? (
                  <div className="my-riot-accounts-error" role="alert">
                    <span>{accountsError}</span>
                    <Button onClick={loadAccounts} size="sm" variant="secondary">{t.accountsRetry}</Button>
                  </div>
                ) : accounts === null ? (
                  <ul aria-busy="true" aria-label={t.accountsLoading} className="my-riot-accounts-list">
                    {[0, 1].map((index) => (
                      <li aria-hidden="true" className="my-riot-connected-row my-riot-account-row is-skeleton" key={index}>
                        <span className="my-riot-provider-mark" />
                        <div>
                          <small>&nbsp;</small>
                          <strong>&nbsp;</strong>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul aria-live="polite" className="my-riot-accounts-list">
                    {accounts.map((account) => (
                      <AccountRow
                        account={account}
                        busy={rowBusyId === account.id}
                        confirming={confirmRemoveId === account.id}
                        key={account.id}
                        onAskRemove={() => setConfirmRemoveId(account.id)}
                        onCancelRemove={() => setConfirmRemoveId(null)}
                        onRemove={() => void removeAccount(account)}
                        onSetMain={() => void setMainAccount(account)}
                      />
                    ))}
                    {subAccounts.length === 0 ? (
                      <li className="my-riot-accounts-empty">
                        <strong data-ko={i18n.ko.emptySubTitle} data-ja={i18n.ja.emptySubTitle}>{t.emptySubTitle}</strong>
                        <span>{t.emptySubDescription}</span>
                      </li>
                    ) : null}
                  </ul>
                )}

                <form className="my-riot-add-form" onSubmit={(event) => void submitAddAccount(event)}>
                  <FormField controlId="my-riot-add-input" disabled={addBusy || !canAddSub}>
                    <FormLabel data-ko={i18n.ko.addLabel} data-ja={i18n.ja.addLabel}>{t.addLabel}</FormLabel>
                    <FormControl>
                      <Input
                        aria-describedby="my-riot-add-hint"
                        aria-invalid={addError ? true : undefined}
                        autoComplete="off"
                        disabled={addBusy || !canAddSub}
                        id="my-riot-add-input"
                        maxLength={80}
                        onChange={(event) => setAddDraft(event.target.value)}
                        placeholder={t.riotIdPlaceholder}
                        value={addDraft}
                      />
                    </FormControl>
                    {addError ? (
                      <FormError id="my-riot-add-hint">{addError}</FormError>
                    ) : (
                      <FormHint id="my-riot-add-hint" data-ko={i18n.ko.formatHint} data-ja={i18n.ja.formatHint}>{t.formatHint}</FormHint>
                    )}
                  </FormField>
                  <Button
                    data-ko={i18n.ko.addAction}
                    data-ja={i18n.ja.addAction}
                    disabled={addBusy || !canAddSub || !addDraft.trim()}
                    loading={addBusy}
                    type="submit"
                  >
                    {t.addAction}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card as="section" className="settings-shared-card my-riot-account-card featured wide my-riot-settings-card" id="my-riot-account-riot" padding="lg" variant="glass">
              <CardHeader className="settings-shared-card-header">
                <div>
                  <CardTitle as="h2" data-ko={i18n.ko.riotIdChange} data-ja={i18n.ja.riotIdChange}>{t.riotIdChange}</CardTitle>
                  <CardDescription data-ko={i18n.ko.riotIdDescription} data-ja={i18n.ja.riotIdDescription}>{t.riotIdDescription}</CardDescription>
                </div>
                <StatusPill tone="info">{mainAccount?.riotTagLine ?? streamer.riotTagLine}</StatusPill>
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
                    <Button as="a" href={mainPublicPath} target="_blank" rel="noreferrer" variant="secondary" data-ko={i18n.ko.openRecord} data-ja={i18n.ja.openRecord}>
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
