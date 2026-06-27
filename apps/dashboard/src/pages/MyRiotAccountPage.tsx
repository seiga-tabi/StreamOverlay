import { useEffect, useState, type FormEvent } from "react";
import { updateStreamerProfileLink, updateStreamerRiotId, type DashboardStreamerInfo, type DashboardStreamerProfileLink } from "../api/client";

const PROFILE_LINK_LIMIT = 5;

type ProfileLinkDraft = {
  id: string;
  url: string;
  label: string;
};

const i18n = {
  ko: {
    title: "내 Riot ID 등록 현황",
    description: "Twitch 계정에 승인되어 연결된 Riot ID와 스트리머 전용 overlay 접근 정보를 확인합니다.",
    status: "등록 상태",
    approved: "승인 완료",
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
    none: "없음"
  },
  ja: {
    title: "自分の Riot ID 登録状況",
    description: "Twitchアカウントに承認連携された Riot ID と配信者専用 overlay 接続情報を確認します。",
    status: "登録状態",
    approved: "承認済み",
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
    none: "なし"
  }
} as const;

const t = i18n.ko;

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
  onStreamerChange
}: {
  streamer?: DashboardStreamerInfo;
  onStreamerChange?: (streamer: DashboardStreamerInfo) => void;
}) {
  const [riotIdDraft, setRiotIdDraft] = useState(streamer ? `${streamer.riotGameName}#${streamer.riotTagLine}` : "");
  const [riotIdBusy, setRiotIdBusy] = useState(false);
  const [riotIdMessage, setRiotIdMessage] = useState("");
  const [profileLinks, setProfileLinks] = useState<ProfileLinkDraft[]>(() => profileLinkDraftsFromStreamer(streamer));
  const [profileLinkBusy, setProfileLinkBusy] = useState(false);
  const [profileLinkMessage, setProfileLinkMessage] = useState("");

  useEffect(() => {
    setRiotIdDraft(streamer ? `${streamer.riotGameName}#${streamer.riotTagLine}` : "");
  }, [streamer?.riotGameName, streamer?.riotTagLine]);

  useEffect(() => {
    setProfileLinks(profileLinkDraftsFromStreamer(streamer));
  }, [streamer?.profileLinkUrl, streamer?.profileLinkLabel, streamer?.profileLinks]);

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
      setRiotIdDraft(`${updated.riotGameName}#${updated.riotTagLine}`);
      setRiotIdMessage(t.riotIdSaved);
    } catch (error) {
      setRiotIdMessage(apiErrorDetail(error, t.riotIdSaveFailed));
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
      setProfileLinkMessage(updated.profileLinks?.length ? t.profileLinkSaved : t.profileLinkCleared);
    } catch (error) {
      setProfileLinkMessage(apiErrorDetail(error, t.profileLinkSaveFailed));
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
    } catch (error) {
      setProfileLinkMessage(apiErrorDetail(error, t.profileLinkSaveFailed));
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
      <>
        <div className="page-title-row page-header compact">
          <div>
            <h1 data-ko={i18n.ko.title} data-ja={i18n.ja.title}>{t.title}</h1>
            <p className="muted" data-ko={i18n.ko.description} data-ja={i18n.ja.description}>{t.description}</p>
          </div>
          <span className="queue-status neutral" data-ko={i18n.ko.none} data-ja={i18n.ja.none}>{t.none}</span>
        </div>
        <div className="card my-riot-account-empty">
          <strong data-ko={i18n.ko.noRegistration} data-ja={i18n.ja.noRegistration}>{t.noRegistration}</strong>
          <p className="muted" data-ko={i18n.ko.noRegistrationBody} data-ja={i18n.ja.noRegistrationBody}>{t.noRegistrationBody}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-row page-header compact">
        <div>
          <h1 data-ko={i18n.ko.title} data-ja={i18n.ja.title}>{t.title}</h1>
          <p className="muted" data-ko={i18n.ko.description} data-ja={i18n.ja.description}>{t.description}</p>
        </div>
        <span className="queue-status good" data-ko={i18n.ko.approved} data-ja={i18n.ja.approved}>{t.approved}</span>
      </div>

      <div className="my-riot-account-grid">
        <section className="card my-riot-account-profile">
          <span className="my-riot-avatar">
            {streamer.twitchProfileImageUrl ? <img src={streamer.twitchProfileImageUrl} alt="" /> : streamer.twitchDisplayName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <span data-ko={i18n.ko.twitchAccount} data-ja={i18n.ja.twitchAccount}>{t.twitchAccount}</span>
            <strong>{streamer.twitchDisplayName}</strong>
            <small>@{streamer.twitchLogin}</small>
          </div>
          <a className="secondary compact-button" href={twitchChannelUrl(streamer)} target="_blank" rel="noreferrer" data-ko={i18n.ko.openTwitch} data-ja={i18n.ja.openTwitch}>
            {t.openTwitch}
          </a>
        </section>

        <section className="card my-riot-account-card">
          <span data-ko={i18n.ko.status} data-ja={i18n.ja.status}>{t.status}</span>
          <strong data-ko={i18n.ko.approved} data-ja={i18n.ja.approved}>{t.approved}</strong>
        </section>

        <section className="card my-riot-account-card featured">
          <span data-ko={i18n.ko.riotAccount} data-ja={i18n.ja.riotAccount}>{t.riotAccount}</span>
          <strong>{streamer.riotGameName}<small>#{streamer.riotTagLine}</small></strong>
          <p className="muted" data-ko={i18n.ko.riotAccountDescription} data-ja={i18n.ja.riotAccountDescription}>{t.riotAccountDescription}</p>
          <form className="my-riot-id-form" onSubmit={(event) => void saveRiotId(event)}>
            <label>
              <span data-ko={i18n.ko.riotIdInput} data-ja={i18n.ja.riotIdInput}>{t.riotIdInput}</span>
              <input
                value={riotIdDraft}
                placeholder={t.riotIdPlaceholder}
                onChange={(event) => setRiotIdDraft(event.target.value)}
                disabled={riotIdBusy}
              />
            </label>
            <div className="my-riot-profile-link-actions">
              <button className="primary compact-button" type="submit" disabled={riotIdBusy}>{t.applyRiotId}</button>
              <a className="secondary compact-button" href={publicSummonerPath(streamer)} target="_blank" rel="noreferrer" data-ko={i18n.ko.openRecord} data-ja={i18n.ja.openRecord}>
                {t.openRecord}
              </a>
            </div>
          </form>
          {riotIdMessage ? <p className="form-message">{riotIdMessage}</p> : null}
        </section>

        <section className="card my-riot-account-card wide">
          <span data-ko={i18n.ko.profileLink} data-ja={i18n.ja.profileLink}>{t.profileLink}</span>
          <p className="muted" data-ko={i18n.ko.profileLinkDescription} data-ja={i18n.ja.profileLinkDescription}>{t.profileLinkDescription}</p>
          <form className="my-riot-profile-link-form" onSubmit={(event) => void saveProfileLink(event)}>
            <div className="my-riot-profile-link-list">
              {profileLinks.map((link, index) => (
                <div className="my-riot-profile-link-row" key={link.id}>
                  <label>
                    <span data-ko={i18n.ko.profileLinkUrl} data-ja={i18n.ja.profileLinkUrl}>{t.profileLinkUrl}</span>
                    <input
                      value={link.url}
                      placeholder={t.profileLinkUrlPlaceholder}
                      onChange={(event) => updateProfileLinkDraft(index, "url", event.target.value)}
                      disabled={profileLinkBusy}
                    />
                  </label>
                  <label>
                    <span data-ko={i18n.ko.profileLinkLabel} data-ja={i18n.ja.profileLinkLabel}>{t.profileLinkLabel}</span>
                    <input
                      value={link.label}
                      placeholder={t.profileLinkLabelPlaceholder}
                      maxLength={40}
                      onChange={(event) => updateProfileLinkDraft(index, "label", event.target.value)}
                      disabled={profileLinkBusy}
                    />
                  </label>
                  <button
                    className="secondary compact-button"
                    type="button"
                    onClick={() => removeProfileLinkDraft(index)}
                    disabled={profileLinkBusy}
                    data-ko={i18n.ko.removeProfileLink}
                    data-ja={i18n.ja.removeProfileLink}
                  >
                    {t.removeProfileLink}
                  </button>
                </div>
              ))}
              <button
                className="my-riot-profile-link-add"
                type="button"
                onClick={addProfileLinkDraft}
                disabled={profileLinkBusy || profileLinks.length >= PROFILE_LINK_LIMIT}
                data-ko={i18n.ko.addProfileLink}
                data-ja={i18n.ja.addProfileLink}
              >
                + {t.addProfileLink}
              </button>
              <small className="muted" data-ko={i18n.ko.profileLinksLimit} data-ja={i18n.ja.profileLinksLimit}>{t.profileLinksLimit}</small>
            </div>
            <div className="my-riot-profile-link-actions">
              <button className="primary compact-button" type="submit" disabled={profileLinkBusy}>{t.saveProfileLink}</button>
              <button className="secondary compact-button" type="button" onClick={() => void clearProfileLink()} disabled={profileLinkBusy || (!profileLinks.some((link) => link.url.trim()) && !streamer.profileLinkUrl)}>
                {t.clearProfileLink}
              </button>
            </div>
          </form>
          {profileLinkMessage ? <p className="form-message">{profileLinkMessage}</p> : null}
        </section>

        <section className="card my-riot-account-card wide">
          <span data-ko={i18n.ko.overlayAccess} data-ja={i18n.ja.overlayAccess}>{t.overlayAccess}</span>
          <div className="my-riot-overlay-detail">
            <div>
              <small data-ko={i18n.ko.overlaySlug} data-ja={i18n.ja.overlaySlug}>{t.overlaySlug}</small>
              <code>{overlayPath(streamer)}</code>
            </div>
            <div>
              <small data-ko={i18n.ko.overlayKey} data-ja={i18n.ja.overlayKey}>{t.overlayKey}</small>
              <code>{streamer.overlayKey ?? t.none}</code>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
