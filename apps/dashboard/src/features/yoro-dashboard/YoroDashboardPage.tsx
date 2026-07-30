import { useEffect, useMemo, useState } from "react";
import { DiscordSymbolIcon } from "../../shared/DiscordSymbolIcon";
import { TwitchGlitchIcon } from "../../shared/TwitchGlitchIcon";
import { setDashboardLocale } from "../../i18n";
import { BotManagementPage } from "../bot-management/BotManagementPage";
import { DiscordSetupPage } from "../discord-onboarding/DiscordSetupPage";
import {
  getManagementSession,
  type BotManagementSession
} from "../bot-management/api";
import { YoroAccountPage } from "../yoro-account/YoroAccountPage";
import {
  logoutAccount,
  updateAccountPreferences,
  type YoroDashboardPage,
  type YoroUserPreferences
} from "../yoro-account/api";
import {
  authenticatedYoroIdentity,
  useYoroAccountSession
} from "../yoro-account/useYoroAccountSession";

const copy = {
  ko: {
    brand: "YORO.gg Dashboard",
    overview: "홈",
    account: "연결 계정",
    organizations: "Organization·Bot",
    settings: "개인 설정",
    publicHome: "YORO.gg",
    logout: "로그아웃",
    loginTitle: "YORO.gg 로그인이 필요합니다.",
    loginDescription: "Discord 또는 Twitch 계정으로 로그인하면 공통 Dashboard를 이용할 수 있습니다.",
    login: "로그인",
    loading: "Dashboard를 불러오는 중입니다.",
    failed: "Dashboard 정보를 불러오지 못했습니다.",
    greeting: "다시 오신 것을 환영합니다.",
    overviewDescription: "연결 계정, Organization과 Discord Bot 설정을 한곳에서 관리합니다.",
    identityTitle: "로그인 계정",
    organizationTitle: "Organization",
    organizationEmpty: "연결된 Organization이 없습니다.",
    organizationEmptyDescription: "Discord 계정을 연결하고 YORO Bot이 설치된 서버를 선택해 시작하세요.",
    organizationManage: "Organization 관리",
    roleOwner: "소유자",
    roleManager: "관리자",
    roleViewer: "조회자",
    nextTitle: "다음 작업",
    nextConnectDiscord: "Discord 계정 연결",
    nextConnectOrganization: "Discord 서버와 Organization 연결",
    nextManage: "게임 서버와 Agent 설정 관리",
    settingsTitle: "개인 설정",
    settingsDescription: "이 설정은 YORO 계정에 저장되어 다른 기기에서도 적용됩니다.",
    language: "표시 언어",
    languageKo: "한국어",
    languageJa: "日本語",
    startPage: "기본 Dashboard 화면",
    reduceMotion: "화면 전환 효과 줄이기",
    save: "설정 저장",
    saving: "저장 중",
    saved: "개인 설정을 저장했습니다.",
    saveFailed: "개인 설정을 저장하지 못했습니다."
  },
  ja: {
    brand: "YORO.gg Dashboard",
    overview: "ホーム",
    account: "連携アカウント",
    organizations: "Organization・Bot",
    settings: "個人設定",
    publicHome: "YORO.gg",
    logout: "ログアウト",
    loginTitle: "YORO.gg へのログインが必要です。",
    loginDescription: "Discord または Twitch アカウントでログインすると共通Dashboardを利用できます。",
    login: "ログイン",
    loading: "Dashboardを読み込んでいます。",
    failed: "Dashboard情報を読み込めませんでした。",
    greeting: "おかえりなさい。",
    overviewDescription: "連携アカウント、Organization、Discord Bot設定を一か所で管理します。",
    identityTitle: "ログインアカウント",
    organizationTitle: "Organization",
    organizationEmpty: "連携済みのOrganizationがありません。",
    organizationEmptyDescription: "Discordアカウントを連携し、YORO Botを導入したサーバーを選択して開始してください。",
    organizationManage: "Organizationを管理",
    roleOwner: "所有者",
    roleManager: "管理者",
    roleViewer: "閲覧者",
    nextTitle: "次の操作",
    nextConnectDiscord: "Discordアカウントを連携",
    nextConnectOrganization: "DiscordサーバーとOrganizationを連携",
    nextManage: "ゲームサーバーとAgent設定を管理",
    settingsTitle: "個人設定",
    settingsDescription: "この設定はYOROアカウントに保存され、別の端末にも適用されます。",
    language: "表示言語",
    languageKo: "한국어",
    languageJa: "日本語",
    startPage: "既定のDashboard画面",
    reduceMotion: "画面切り替え効果を減らす",
    save: "設定を保存",
    saving: "保存中",
    saved: "個人設定を保存しました。",
    saveFailed: "個人設定を保存できませんでした。"
  }
} as const;

const paths: Record<YoroDashboardPage, string> = {
  overview: "/dashboard",
  account: "/dashboard/account",
  organizations: "/dashboard/organizations",
  settings: "/dashboard/settings"
};

export function yoroDashboardPageFromPath(pathname: string): YoroDashboardPage {
  const normalized = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  if (normalized === paths.account) return "account";
  if (normalized === paths.organizations) return "organizations";
  if (normalized === paths.settings) return "settings";
  return "overview";
}

function navigate(page: YoroDashboardPage, replace = false): void {
  const path = paths[page];
  if (window.location.pathname === path) return;
  if (replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  window.dispatchEvent(new CustomEvent("publicroutechange"));
  window.scrollTo({
    top: 0,
    behavior: document.documentElement.dataset.reducedMotion === "true"
      ? "auto"
      : "smooth"
  });
}

function roleLabel(
  role: "owner" | "manager" | "viewer",
  text: typeof copy.ko | typeof copy.ja
): string {
  if (role === "owner") return text.roleOwner;
  if (role === "manager") return text.roleManager;
  return text.roleViewer;
}

export function YoroDashboardPage() {
  const account = useYoroAccountSession();
  const [management, setManagement] = useState<BotManagementSession>();
  const [managementFailed, setManagementFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [draft, setDraft] = useState<YoroUserPreferences>();
  const page = yoroDashboardPageFromPath(window.location.pathname);
  const search = new URLSearchParams(window.location.search);
  const setupToken = search.get("setup") ?? "";
  const discordStatus = search.get("discord");
  const discordSetupActive = page === "organizations" && (
    /^[A-Za-z0-9_-]{32,128}$/u.test(setupToken)
    || discordStatus === "connected"
    || discordStatus === "error"
  );
  const authenticated = account.session?.authenticated === true
    ? account.session
    : undefined;
  const preferences = authenticated?.preferences;
  const locale = draft?.locale ?? preferences?.locale ?? "ko";
  const text = copy[locale];
  const identity = authenticatedYoroIdentity(account.session);

  useEffect(() => {
    if (!preferences) return;
    setDraft(preferences);
    setDashboardLocale(preferences.locale);
    document.documentElement.lang = preferences.locale;
    document.documentElement.dataset.reducedMotion =
      preferences.reducedMotion ? "true" : "false";
  }, [preferences]);

  useEffect(() => {
    if (!authenticated) return undefined;
    const controller = new AbortController();
    void getManagementSession(controller.signal)
      .then((session) => {
        setManagement(session);
        setManagementFailed(false);
      })
      .catch(() => setManagementFailed(true));
    return () => controller.abort();
  }, [authenticated]);

  useEffect(() => {
    if (
      !authenticated
      || window.location.pathname !== "/dashboard"
      || authenticated.preferences.defaultDashboardPage === "overview"
    ) return;
    navigate(authenticated.preferences.defaultDashboardPage, true);
  }, [authenticated]);

  const connectedProviders = useMemo(
    () => new Set(authenticated?.identities.map((item) => item.provider) ?? []),
    [authenticated]
  );
  const discordIdentity = authenticated?.identities.find(
    (item) => item.provider === "discord"
  );
  const twitchIdentity = authenticated?.identities.find(
    (item) => item.provider === "twitch"
  );

  async function savePreferences(): Promise<void> {
    if (!authenticated || !draft || saving) return;
    setSaving(true);
    setAnnouncement("");
    try {
      const saved = await updateAccountPreferences(draft, authenticated.csrfToken);
      setDashboardLocale(saved.locale);
      document.documentElement.lang = saved.locale;
      document.documentElement.dataset.reducedMotion =
        saved.reducedMotion ? "true" : "false";
      await account.refresh();
      setAnnouncement(copy[saved.locale].saved);
    } catch {
      setAnnouncement(text.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (account.loading) {
    return <main className="yoro-dashboard-entry" role="status">{text.loading}</main>;
  }

  if (!authenticated && discordSetupActive) {
    return (
      <main className="yoro-dashboard-entry yoro-dashboard-discord-setup">
        <DiscordSetupPage
          embedded
          onCompleted={() => window.location.replace("/dashboard/organizations")}
        />
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="yoro-dashboard-entry">
        <section>
          <span>YORO DASHBOARD</span>
          <h1>{text.loginTitle}</h1>
          <p>{text.loginDescription}</p>
          <a href="/login?return_to=/dashboard">{text.login}</a>
        </section>
      </main>
    );
  }

  return (
    <div className="yoro-dashboard-shell" data-page={page}>
      <aside className="yoro-dashboard-sidebar">
        <a className="yoro-dashboard-brand" href="/dashboard">{text.brand}</a>
        <div className="yoro-dashboard-profile">
          {identity?.avatarUrl ? <img alt="" src={identity.avatarUrl} /> : null}
          <span aria-hidden="true" hidden={Boolean(identity?.avatarUrl)}>
            {identity?.provider === "discord"
              ? <DiscordSymbolIcon />
              : <TwitchGlitchIcon />}
          </span>
          <div>
            <strong>{identity?.displayName}</strong>
            <small>{identity?.provider === "discord" ? "Discord" : "Twitch"}</small>
          </div>
        </div>
        <nav aria-label={text.brand}>
          {(Object.keys(paths) as YoroDashboardPage[]).map((item) => (
            <button
              aria-current={page === item ? "page" : undefined}
              className={page === item ? "active" : ""}
              key={item}
              onClick={() => navigate(item)}
              type="button"
            >
              {text[item]}
            </button>
          ))}
        </nav>
        <div className="yoro-dashboard-sidebar-actions">
          <a href="/">{text.publicHome}</a>
          <button
            type="button"
            onClick={() => void logoutAccount(authenticated.csrfToken).then(() => {
              window.location.assign("/login");
            })}
          >
            {text.logout}
          </button>
        </div>
      </aside>
      <main className="yoro-dashboard-main">
        {page === "overview" ? (
          <div className="yoro-dashboard-overview">
            <header>
              <span>YORO DASHBOARD</span>
              <h1>{identity?.displayName}, {text.greeting}</h1>
              <p>{text.overviewDescription}</p>
            </header>
            <section className="yoro-dashboard-summary-grid">
              <article>
                <h2>{text.identityTitle}</h2>
                <ul>
                  <li>
                    <DiscordSymbolIcon />
                    <span className="yoro-dashboard-identity-label">
                      <strong>Discord</strong>
                      {discordIdentity ? <small>{discordIdentity.displayName}</small> : null}
                    </span>
                    <span className="yoro-dashboard-identity-status">
                      {connectedProviders.has("discord") ? "✓" : "—"}
                    </span>
                  </li>
                  <li>
                    <TwitchGlitchIcon />
                    <span className="yoro-dashboard-identity-label">
                      <strong>Twitch</strong>
                      {twitchIdentity ? <small>{twitchIdentity.displayName}</small> : null}
                    </span>
                    <span className="yoro-dashboard-identity-status">
                      {connectedProviders.has("twitch") ? "✓" : "—"}
                    </span>
                  </li>
                </ul>
                <button type="button" onClick={() => navigate("account")}>{text.account}</button>
              </article>
              <article>
                <h2>{text.organizationTitle}</h2>
                {management?.authenticated && management.organizations.length > 0 ? (
                  <ul>
                    {management.organizations.map((organization) => (
                      <li key={organization.id}>
                        <span>{organization.displayName}</span>
                        <strong>{roleLabel(organization.role, text)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <strong>{text.organizationEmpty}</strong>
                    <p>{text.organizationEmptyDescription}</p>
                  </>
                )}
                {managementFailed ? <p role="alert">{text.failed}</p> : null}
                <button type="button" onClick={() => navigate("organizations")}>
                  {text.organizationManage}
                </button>
              </article>
            </section>
            <section className="yoro-dashboard-next">
              <h2>{text.nextTitle}</h2>
              <ol>
                <li className={connectedProviders.has("discord") ? "complete" : ""}>
                  {text.nextConnectDiscord}
                </li>
                <li className={
                  management?.authenticated && management.organizations.length > 0
                    ? "complete"
                    : ""
                }>
                  {text.nextConnectOrganization}
                </li>
                <li>{text.nextManage}</li>
              </ol>
            </section>
          </div>
        ) : null}
        {page === "account" ? <YoroAccountPage embedded /> : null}
        {page === "organizations" ? (
          discordSetupActive
            ? (
                <DiscordSetupPage
                  embedded
                  onCompleted={() => window.location.replace("/dashboard/organizations")}
                />
              )
            : <BotManagementPage embedded />
        ) : null}
        {page === "settings" && draft ? (
          <section className="yoro-dashboard-settings">
            <header>
              <h1>{text.settingsTitle}</h1>
              <p>{text.settingsDescription}</p>
            </header>
            <label>
              <span>{text.language}</span>
              <select
                value={draft.locale}
                onChange={(event) => setDraft({
                  ...draft,
                  locale: event.target.value as "ko" | "ja"
                })}
              >
                <option value="ko">{text.languageKo}</option>
                <option value="ja">{text.languageJa}</option>
              </select>
            </label>
            <label>
              <span>{text.startPage}</span>
              <select
                value={draft.defaultDashboardPage}
                onChange={(event) => setDraft({
                  ...draft,
                  defaultDashboardPage: event.target.value as YoroDashboardPage
                })}
              >
                {(Object.keys(paths) as YoroDashboardPage[]).map((item) => (
                  <option key={item} value={item}>{text[item]}</option>
                ))}
              </select>
            </label>
            <label className="yoro-dashboard-checkbox">
              <input
                checked={draft.reducedMotion}
                onChange={(event) => setDraft({
                  ...draft,
                  reducedMotion: event.target.checked
                })}
                type="checkbox"
              />
              <span>{text.reduceMotion}</span>
            </label>
            <button disabled={saving} onClick={() => void savePreferences()} type="button">
              {saving ? text.saving : text.save}
            </button>
            {announcement ? <p aria-live="polite">{announcement}</p> : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
