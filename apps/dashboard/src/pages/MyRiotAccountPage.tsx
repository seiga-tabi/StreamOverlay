import { useEffect, useState, type FormEvent } from "react";
import { updateStreamerProfileLink, updateStreamerRiotId, type DashboardStreamerInfo, type DashboardStreamerProfileLink } from "../api/client";
import { ProfileLinkIcon, profileLinkPlatformFromUrl } from "../components/ProfileLinkIcon";
import { createDashboardLocaleProxy } from "../i18n";
import { AppShell, AppShellHeader, AppShellMain } from "../shared/ui/AppShell";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../shared/ui/EmptyState";
import { FormControl, FormField, FormHint, FormLabel, Input } from "../shared/ui/Form";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "../shared/ui/Modal";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderEyebrow, PageHeaderStatus, PageHeaderTitle } from "../shared/ui/PageHeader";
import { Badge, Metric, StatusPill } from "../shared/ui/Status";
import { Toast, ToastCloseButton, ToastDescription, ToastProvider, ToastTitle, ToastViewport, type ToastTone } from "../shared/ui/Toast";

const PROFILE_LINK_LIMIT = 5;

type ProfileLinkDraft = {
  id: string;
  url: string;
  label: string;
};

type AccountToast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

const i18n = {
  ko: {
    title: "내 Riot ID 등록 현황",
    description: "Twitch 계정에 승인되어 연결된 Riot ID와 스트리머 전용 overlay 접근 정보를 확인합니다.",
    studio: "Account Studio",
    status: "등록 상태",
    approved: "승인 완료",
    current: "현재",
    twitchAccount: "Twitch 계정",
    riotAccount: "등록된 Riot ID",
    riotAccountDescription: "Riot 닉네임이나 태그가 변경되면 새 Riot ID를 적용합니다.",
    riotIdInput: "새 Riot ID",
    riotIdPlaceholder: "게임명#태그",
    applyRiotId: "Riot ID 적용",
    riotIdSaved: "Riot ID를 적용했습니다.",
    riotIdSaveFailed: "Riot ID 적용에 실패했습니다.",
    publicProfile: "공개 전적",
    overlayAccess: "스트리머 Overlay 접근",
    overlaySlug: "URL 닉네임",
    overlayKey: "스트리머 Key",
    profileLink: "프로필 링크",
    profileLinkDescription: "공개 전적 프로필에 보여줄 개인 링크를 등록합니다.",
    profileLinkUrl: "링크 URL",
    profileLinkLabel: "링크 이름",
    profileLinkUrlPlaceholder: "https://example.com",
    profileLinkLabelPlaceholder: "YouTube, Discord, X 등",
    addProfileLink: "링크 추가",
    removeProfileLink: "삭제",
    profileLinksLimit: "프로필 링크는 최대 5개까지 등록할 수 있습니다.",
    saveProfileLink: "링크 저장",
    clearProfileLink: "링크 삭제",
    profileLinkSaved: "프로필 링크를 저장했습니다.",
    profileLinkCleared: "프로필 링크를 삭제했습니다.",
    profileLinkSaveFailed: "프로필 링크 저장에 실패했습니다.",
    openRecord: "전적 보기",
    openTwitch: "Twitch 열기",
    noRegistration: "등록된 Riot ID가 없습니다.",
    noRegistrationBody: "공개 전적 화면에서 Twitch 로그인 후 스트리머 등록 요청을 보내고, 관리자가 승인하면 이 화면에 표시됩니다.",
    accountNav: "계정",
    riotNav: "Riot ID",
    linkNav: "링크",
    overlayNav: "Overlay",
    confirmClearTitle: "프로필 링크 삭제",
    confirmClearDescription: "공개 전적 프로필에 표시되는 모든 프로필 링크를 삭제합니다.",
    confirm: "확인",
    cancel: "취소",
    close: "닫기",
    none: "없음"
  },
  ja: {
    title: "自分の Riot ID 登録状況",
    description: "Twitchアカウントに承認連携された Riot ID と配信者専用 overlay 接続情報を確認します。",
    studio: "Account Studio",
    status: "登録状態",
    approved: "承認済み",
    current: "現在",
    twitchAccount: "Twitch アカウント",
    riotAccount: "登録済み Riot ID",
    riotAccountDescription: "Riot のニックネームやタグが変わった場合、新しい Riot ID を適用します。",
    riotIdInput: "新しい Riot ID",
    riotIdPlaceholder: "ゲーム名#タグ",
    applyRiotId: "Riot ID を適用",
    riotIdSaved: "Riot ID を適用しました。",
    riotIdSaveFailed: "Riot ID の適用に失敗しました。",
    publicProfile: "公開戦績",
    overlayAccess: "配信者 Overlay 接続",
    overlaySlug: "URL ニックネーム",
    overlayKey: "配信者 Key",
    profileLink: "プロフィールリンク",
    profileLinkDescription: "公開戦績プロフィールに表示する個人リンクを登録します。",
    profileLinkUrl: "リンク URL",
    profileLinkLabel: "リンク名",
    profileLinkUrlPlaceholder: "https://example.com",
    profileLinkLabelPlaceholder: "YouTube、Discord、X など",
    addProfileLink: "リンク追加",
    removeProfileLink: "削除",
    profileLinksLimit: "プロフィールリンクは最大5件まで登録できます。",
    saveProfileLink: "リンクを保存",
    clearProfileLink: "リンクを削除",
    profileLinkSaved: "プロフィールリンクを保存しました。",
    profileLinkCleared: "プロフィールリンクを削除しました。",
    profileLinkSaveFailed: "プロフィールリンクの保存に失敗しました。",
    openRecord: "戦績を見る",
    openTwitch: "Twitch を開く",
    noRegistration: "登録済み Riot ID がありません。",
    noRegistrationBody: "公開戦績画面で Twitch ログイン後に配信者登録申請を送り、管理者が承認するとこの画面に表示されます。",
    accountNav: "アカウント",
    riotNav: "Riot ID",
    linkNav: "リンク",
    overlayNav: "Overlay",
    confirmClearTitle: "プロフィールリンク削除",
    confirmClearDescription: "公開戦績プロフィールに表示されるすべてのプロフィールリンクを削除します。",
    confirm: "確認",
    cancel: "キャンセル",
    close: "閉じる",
    none: "なし"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

function newProfileLinkDraft(): ProfileLinkDraft {
  return { id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`, url: "", label: "" };
}

function profileLinkDraftFromLink(link: DashboardStreamerProfileLink): ProfileLinkDraft {
  return {
    id: link.id,
    url: link.url,
    label: link.label
  };
}

function profileLinkDraftsFromStreamer(streamer: DashboardStreamerInfo | undefined): ProfileLinkDraft[] {
  if (streamer?.profileLinks?.length) return streamer.profileLinks.map(profileLinkDraftFromLink);
  if (streamer?.profileLinkUrl) {
    return [{
      id: "legacy-profile-link",
      url: streamer.profileLinkUrl,
      label: streamer.profileLinkLabel ?? ""
    }];
  }
  return [newProfileLinkDraft()];
}

function publicSummonerPath(streamer: DashboardStreamerInfo): string {
  return `/lol/summoners/jp/${encodeURIComponent(`${streamer.riotGameName}-${streamer.riotTagLine}`)}`;
}

function twitchChannelUrl(streamer: DashboardStreamerInfo): string {
  return `https://www.twitch.tv/${encodeURIComponent(streamer.twitchLogin)}`;
}

function overlayPath(streamer: DashboardStreamerInfo): string {
  return streamer.overlaySlug ? `/overlay/${streamer.overlaySlug}` : t.none;
}

function apiErrorDetail(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message.replace(/^\/api\/[^ ]+ failed: \d+(?: - )?/, "") || fallback;
}

export function MyRiotAccountPage({
  streamer,
  onStreamerChange,
  onIdentityChange,
  embedded = false,
}: {
  streamer?: DashboardStreamerInfo;
  onStreamerChange?: (streamer: DashboardStreamerInfo) => void;
  onIdentityChange?: () => void;
  embedded?: boolean;
}) {
  const [riotIdDraft, setRiotIdDraft] = useState(streamer ? `${streamer.riotGameName}#${streamer.riotTagLine}` : "");
  const [riotIdBusy, setRiotIdBusy] = useState(false);
  const [riotIdMessage, setRiotIdMessage] = useState("");
  const [profileLinks, setProfileLinks] = useState<ProfileLinkDraft[]>(() => profileLinkDraftsFromStreamer(streamer));
  const [profileLinkBusy, setProfileLinkBusy] = useState(false);
  const [profileLinkMessage, setProfileLinkMessage] = useState("");
  const [profileLinkClearOpen, setProfileLinkClearOpen] = useState(false);
  const [toast, setToast] = useState<AccountToast | null>(null);

  useEffect(() => {
    setRiotIdDraft(streamer ? `${streamer.riotGameName}#${streamer.riotTagLine}` : "");
  }, [streamer?.riotGameName, streamer?.riotTagLine]);

  useEffect(() => {
    setProfileLinks(profileLinkDraftsFromStreamer(streamer));
  }, [streamer?.profileLinkUrl, streamer?.profileLinkLabel, streamer?.profileLinks]);

  function showToast(tone: ToastTone, title: string, description?: string): void {
    setToast({ id: Date.now(), tone, title, description });
  }

  async function saveRiotId(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!streamer || riotIdBusy) return;
    const riotId = riotIdDraft.trim();
    if (!riotId) return;
    setRiotIdBusy(true);
    setRiotIdMessage("");
    try {
      const updated = await updateStreamerRiotId(riotId);
      onStreamerChange?.(updated);
      onIdentityChange?.();
      setRiotIdDraft(`${updated.riotGameName}#${updated.riotTagLine}`);
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

  async function saveProfileLink(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!streamer || profileLinkBusy) return;
    setProfileLinkBusy(true);
    setProfileLinkMessage("");
    try {
      const updated = await updateStreamerProfileLink({
        profileLinks: profileLinks
          .filter((link) => link.url.trim())
          .map((link) => ({
            id: link.id,
            url: link.url.trim(),
            label: link.label.trim()
          }))
      });
      onStreamerChange?.(updated);
      setProfileLinks(profileLinkDraftsFromStreamer(updated));
      const message = updated.profileLinks?.length ? t.profileLinkSaved : t.profileLinkCleared;
      setProfileLinkMessage(message);
      showToast("success", message);
    } catch (error) {
      const detail = apiErrorDetail(error, t.profileLinkSaveFailed);
      setProfileLinkMessage(detail);
      showToast("danger", t.profileLinkSaveFailed, detail);
    } finally {
      setProfileLinkBusy(false);
    }
  }

  async function clearProfileLink(): Promise<void> {
    if (!streamer || profileLinkBusy) return;
    setProfileLinks([newProfileLinkDraft()]);
    setProfileLinkBusy(true);
    setProfileLinkMessage("");
    try {
      const updated = await updateStreamerProfileLink({ profileLinks: [] });
      onStreamerChange?.(updated);
      setProfileLinkMessage(t.profileLinkCleared);
      setProfileLinkClearOpen(false);
      showToast("success", t.profileLinkCleared);
    } catch (error) {
      const detail = apiErrorDetail(error, t.profileLinkSaveFailed);
      setProfileLinkMessage(detail);
      showToast("danger", t.profileLinkSaveFailed, detail);
    } finally {
      setProfileLinkBusy(false);
    }
  }

  function updateProfileLinkDraft(index: number, field: "url" | "label", value: string): void {
    setProfileLinks((current) => current.map((link, itemIndex) => itemIndex === index ? { ...link, [field]: value } : link));
  }

  function addProfileLinkDraft(): void {
    setProfileLinks((current) => current.length >= PROFILE_LINK_LIMIT ? current : [...current, newProfileLinkDraft()]);
  }

  function removeProfileLinkDraft(index: number): void {
    setProfileLinks((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [newProfileLinkDraft()];
    });
  }

  if (!streamer) {
    return (
      <AppShell as="section" className={`settings-shared-shell my-riot-account-shell${embedded ? " lol-operations-embedded" : ""}`} mainId="my-riot-account-main" skipLinkLabel={t.title} variant="streamer">
        {!embedded ? (
          <AppShellHeader className="settings-shared-header">
            <PageHeader className="settings-shared-page-header" layout="split">
              <PageHeaderEyebrow>{t.studio}</PageHeaderEyebrow>
              <PageHeaderTitle data-ko={i18n.ko.title} data-ja={i18n.ja.title}>{t.title}</PageHeaderTitle>
              <PageHeaderDescription data-ko={i18n.ko.description} data-ja={i18n.ja.description}>{t.description}</PageHeaderDescription>
              <PageHeaderStatus>
                <StatusPill tone="warning" data-ko={i18n.ko.none} data-ja={i18n.ja.none}>{t.none}</StatusPill>
              </PageHeaderStatus>
            </PageHeader>
          </AppShellHeader>
        ) : null}
        <AppShellMain className="settings-shared-main" id="my-riot-account-main">
          <EmptyState className="settings-shared-empty" variant="streamer">
            <EmptyStateIcon>R</EmptyStateIcon>
            <EmptyStateTitle as="h2" data-ko={i18n.ko.noRegistration} data-ja={i18n.ja.noRegistration}>{t.noRegistration}</EmptyStateTitle>
            <EmptyStateDescription data-ko={i18n.ko.noRegistrationBody} data-ja={i18n.ja.noRegistrationBody}>{t.noRegistrationBody}</EmptyStateDescription>
          </EmptyState>
        </AppShellMain>
      </AppShell>
    );
  }

  return (
    <ToastProvider position="top-right">
      <AppShell
        as="section"
        className={`settings-shared-shell my-riot-account-shell${embedded ? " lol-operations-embedded" : ""}`}
        mainId="my-riot-account-main"
        skipLinkLabel={t.title}
        variant="streamer"
      >
        {!embedded ? (
          <AppShellHeader className="settings-shared-header">
            <PageHeader className="settings-shared-page-header" layout="split">
              <PageHeaderEyebrow>{t.studio}</PageHeaderEyebrow>
              <PageHeaderTitle data-ko={i18n.ko.title} data-ja={i18n.ja.title}>{t.title}</PageHeaderTitle>
              <PageHeaderDescription data-ko={i18n.ko.description} data-ja={i18n.ja.description}>{t.description}</PageHeaderDescription>
              <PageHeaderStatus>
                <StatusPill tone="success" data-ko={i18n.ko.approved} data-ja={i18n.ja.approved}>{t.approved}</StatusPill>
              </PageHeaderStatus>
              <PageHeaderActions>
                <Badge tone="streamer">{t.current}</Badge>
              </PageHeaderActions>
            </PageHeader>
          </AppShellHeader>
        ) : null}

        <AppShellMain className="settings-shared-main" id="my-riot-account-main">
          <div className="settings-shared-grid my-riot-account-grid">
            <Card as="section" className="settings-shared-card my-riot-account-profile" id="my-riot-account-profile" padding="lg" variant="glass">
              <span className="my-riot-avatar">
                {streamer.twitchProfileImageUrl ? <img src={streamer.twitchProfileImageUrl} alt="" /> : streamer.twitchDisplayName.slice(0, 1).toUpperCase()}
              </span>
              <div className="my-riot-account-profile-copy">
                <StatusPill tone="success" size="sm" data-ko={i18n.ko.twitchAccount} data-ja={i18n.ja.twitchAccount}>{t.twitchAccount}</StatusPill>
                <strong>{streamer.twitchDisplayName}</strong>
                <small>@{streamer.twitchLogin}</small>
              </div>
              <Button as="a" href={twitchChannelUrl(streamer)} target="_blank" rel="noreferrer" variant="secondary" size="sm" data-ko={i18n.ko.openTwitch} data-ja={i18n.ja.openTwitch}>
                {t.openTwitch}
              </Button>
            </Card>

            <Card as="section" className="settings-shared-card my-riot-account-card my-riot-account-status-card" padding="lg" variant="elevated">
              <Metric label={t.status} value={t.approved} tone="success" status={<StatusPill tone="success" size="sm">{t.approved}</StatusPill>} />
            </Card>

            <Card as="section" className="settings-shared-card my-riot-account-card featured" id="my-riot-account-riot" padding="lg" variant="glass">
              <CardHeader className="settings-shared-card-header">
                <div>
                  <CardTitle as="h2" data-ko={i18n.ko.riotAccount} data-ja={i18n.ja.riotAccount}>{t.riotAccount}</CardTitle>
                  <CardDescription data-ko={i18n.ko.riotAccountDescription} data-ja={i18n.ja.riotAccountDescription}>{t.riotAccountDescription}</CardDescription>
                </div>
                <StatusPill tone="info">{streamer.riotTagLine}</StatusPill>
              </CardHeader>
              <CardContent className="settings-shared-card-content">
                <Metric label={t.riotAccount} value={`${streamer.riotGameName}#${streamer.riotTagLine}`} tone="streamer" />
                <form className="settings-shared-form my-riot-id-form" onSubmit={(event) => void saveRiotId(event)}>
                  <FormField controlId="my-riot-id-input" disabled={riotIdBusy} required>
                    <FormLabel data-ko={i18n.ko.riotIdInput} data-ja={i18n.ja.riotIdInput}>{t.riotIdInput}</FormLabel>
                    <FormControl>
                      <Input
                        id="my-riot-id-input"
                        value={riotIdDraft}
                        placeholder={t.riotIdPlaceholder}
                        onChange={(event) => setRiotIdDraft(event.target.value)}
                        disabled={riotIdBusy}
                      />
                    </FormControl>
                    <FormHint>{t.riotAccountDescription}</FormHint>
                  </FormField>
                  <CardFooter className="settings-shared-actions settings-shared-actions--flush">
                    <Button type="submit" loading={riotIdBusy} disabled={riotIdBusy}>{t.applyRiotId}</Button>
                    <Button as="a" href={publicSummonerPath(streamer)} target="_blank" rel="noreferrer" variant="secondary" data-ko={i18n.ko.openRecord} data-ja={i18n.ja.openRecord}>
                      {t.openRecord}
                    </Button>
                  </CardFooter>
                </form>
                {riotIdMessage ? <StatusPill tone={riotIdMessage === t.riotIdSaved ? "success" : "danger"}>{riotIdMessage}</StatusPill> : null}
              </CardContent>
            </Card>

            <Card as="section" className="settings-shared-card my-riot-account-card wide" id="my-riot-account-links" padding="lg" variant="glass">
              <CardHeader className="settings-shared-card-header">
                <div>
                  <CardTitle as="h2" data-ko={i18n.ko.profileLink} data-ja={i18n.ja.profileLink}>{t.profileLink}</CardTitle>
                  <CardDescription data-ko={i18n.ko.profileLinkDescription} data-ja={i18n.ja.profileLinkDescription}>{t.profileLinkDescription}</CardDescription>
                </div>
                <Badge tone="info">{profileLinks.length}/{PROFILE_LINK_LIMIT}</Badge>
              </CardHeader>
              <CardContent className="settings-shared-card-content">
                <form className="settings-shared-form my-riot-profile-link-form" onSubmit={(event) => void saveProfileLink(event)}>
                  <div className="my-riot-profile-link-list">
                    {profileLinks.map((link, index) => (
                      <Card as="div" className="my-riot-profile-link-row" key={link.id} padding="sm" variant="elevated">
                        <ProfileLinkIcon
                          url={link.url}
                          platform={profileLinkPlatformFromUrl(link.url)}
                          label={link.label || t.profileLink}
                          className="my-riot-profile-link-preview"
                        />
                        <FormField controlId={`my-riot-profile-link-url-${link.id}`} disabled={profileLinkBusy}>
                          <FormLabel data-ko={i18n.ko.profileLinkUrl} data-ja={i18n.ja.profileLinkUrl}>{t.profileLinkUrl}</FormLabel>
                          <FormControl>
                            <Input
                              id={`my-riot-profile-link-url-${link.id}`}
                              value={link.url}
                              placeholder={t.profileLinkUrlPlaceholder}
                              onChange={(event) => updateProfileLinkDraft(index, "url", event.target.value)}
                              disabled={profileLinkBusy}
                            />
                          </FormControl>
                        </FormField>
                        <FormField controlId={`my-riot-profile-link-label-${link.id}`} disabled={profileLinkBusy}>
                          <FormLabel data-ko={i18n.ko.profileLinkLabel} data-ja={i18n.ja.profileLinkLabel}>{t.profileLinkLabel}</FormLabel>
                          <FormControl>
                            <Input
                              id={`my-riot-profile-link-label-${link.id}`}
                              value={link.label}
                              placeholder={t.profileLinkLabelPlaceholder}
                              maxLength={40}
                              onChange={(event) => updateProfileLinkDraft(index, "label", event.target.value)}
                              disabled={profileLinkBusy}
                            />
                          </FormControl>
                        </FormField>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => removeProfileLinkDraft(index)}
                          disabled={profileLinkBusy}
                          data-ko={i18n.ko.removeProfileLink}
                          data-ja={i18n.ja.removeProfileLink}
                        >
                          {t.removeProfileLink}
                        </Button>
                      </Card>
                    ))}
                    <Button
                      className="my-riot-profile-link-add"
                      type="button"
                      variant="tertiary"
                      onClick={addProfileLinkDraft}
                      disabled={profileLinkBusy || profileLinks.length >= PROFILE_LINK_LIMIT}
                      data-ko={i18n.ko.addProfileLink}
                      data-ja={i18n.ja.addProfileLink}
                    >
                      + {t.addProfileLink}
                    </Button>
                    <small className="settings-shared-muted" data-ko={i18n.ko.profileLinksLimit} data-ja={i18n.ja.profileLinksLimit}>{t.profileLinksLimit}</small>
                  </div>
                  <CardFooter className="settings-shared-actions settings-shared-actions--flush">
                    <Button type="submit" loading={profileLinkBusy} disabled={profileLinkBusy}>{t.saveProfileLink}</Button>
                    <Button type="button" variant="danger" onClick={() => setProfileLinkClearOpen(true)} disabled={profileLinkBusy || (!profileLinks.some((link) => link.url.trim()) && !streamer.profileLinkUrl)}>
                      {t.clearProfileLink}
                    </Button>
                  </CardFooter>
                </form>
                {profileLinkMessage ? <StatusPill tone={profileLinkMessage === t.profileLinkSaved || profileLinkMessage === t.profileLinkCleared ? "success" : "danger"}>{profileLinkMessage}</StatusPill> : null}
              </CardContent>
            </Card>

            <Card as="section" className="settings-shared-card my-riot-account-card wide" id="my-riot-account-overlay" padding="lg" variant="glass">
              <CardHeader className="settings-shared-card-header">
                <CardTitle as="h2" data-ko={i18n.ko.overlayAccess} data-ja={i18n.ja.overlayAccess}>{t.overlayAccess}</CardTitle>
                <Badge tone={streamer.overlayKey ? "streamer" : "warning"}>{t.overlayNav}</Badge>
              </CardHeader>
              <CardContent className="my-riot-overlay-detail">
                <Metric label={t.overlaySlug} value={overlayPath(streamer)} tone={streamer.overlaySlug ? "info" : "warning"} />
                <Metric label={t.overlayKey} value={streamer.overlayKey ?? t.none} tone={streamer.overlayKey ? "streamer" : "warning"} />
              </CardContent>
            </Card>
          </div>
        </AppShellMain>
      </AppShell>

      <Modal open={profileLinkClearOpen} onOpenChange={setProfileLinkClearOpen} size="sm" loading={profileLinkBusy}>
        <ModalHeader>
          <ModalTitle>{t.confirmClearTitle}</ModalTitle>
          <ModalDescription>{t.confirmClearDescription}</ModalDescription>
        </ModalHeader>
        <ModalContent>
          <StatusPill tone="danger">{t.clearProfileLink}</StatusPill>
        </ModalContent>
        <ModalFooter>
          <Button variant="danger" loading={profileLinkBusy} onClick={() => void clearProfileLink()}>{t.clearProfileLink}</Button>
          <Button variant="secondary" disabled={profileLinkBusy} onClick={() => setProfileLinkClearOpen(false)}>{t.cancel}</Button>
        </ModalFooter>
      </Modal>

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
