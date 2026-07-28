import React, { useEffect, useRef, useState } from "react";
import { detectDashboardLocale, type DashboardLocale } from "../../i18n";
import { Button } from "../../shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "../../shared/ui/EmptyState";
import { SkeletonCard } from "../../shared/ui/Skeleton";
import {
  connectDiscordGuild,
  discordOAuthStartUrl,
  DiscordSetupApiError,
  getDiscordSetupSession,
  type DiscordSetupOrganization,
  type DiscordSetupSession
} from "./api";

const text = {
  ko: {
    eyebrow: "YORO Bot 설정",
    title: "Discord 연결 설정",
    description: "관리 권한이 있는 Discord 서버를 Organization에 안전하게 연결합니다.",
    loginTitle: "1. Discord 로그인",
    loginDescription: "설정 링크 확인 후 Discord의 최소 권한으로 로그인합니다.",
    login: "Discord로 로그인",
    selectTitle: "2. Discord 서버 선택",
    selectDescription: "관리 가능한 Discord 서버를 선택하세요.",
    noGuilds: "연결할 수 있는 Discord 서버가 없습니다.",
    permission: "서버 소유자 또는 서버 관리 권한이 필요합니다.",
    organization: "Organization",
    createOrganization: "선택한 서버로 새 Organization 생성",
    connect: "Discord 서버 연결",
    connecting: "연결 중",
    completedTitle: "Discord 서버 연결이 완료되었습니다.",
    completedDescription: "다음 단계에서 게임 서버와 상태 알림을 설정할 수 있습니다.",
    expiredTitle: "이 설정 링크는 만료되었습니다.",
    expiredDescription: "새로운 설정 링크를 발급해 주세요.",
    alreadyConnected: "이미 다른 Organization에 연결된 서버입니다.",
    unavailable: "Discord 연결 기능이 준비되지 않았습니다.",
    retry: "다시 시도",
    loading: "Discord 연결 상태를 확인하는 중입니다.",
    network: "잠시 후 다시 시도해 주세요."
  },
  ja: {
    eyebrow: "YORO Bot 設定",
    title: "Discord 連携設定",
    description: "管理権限のある Discord サーバーを Organization に安全に連携します。",
    loginTitle: "1. Discord ログイン",
    loginDescription: "設定リンクを確認後、Discord の最小権限でログインします。",
    login: "Discord でログイン",
    selectTitle: "2. Discord サーバーを選択",
    selectDescription: "管理可能な Discord サーバーを選択してください。",
    noGuilds: "連携できる Discord サーバーがありません。",
    permission: "サーバー所有者またはサーバー管理権限が必要です。",
    organization: "Organization",
    createOrganization: "選択したサーバーで新しい Organization を作成",
    connect: "Discord サーバーを連携",
    connecting: "連携中",
    completedTitle: "Discord サーバーの連携が完了しました。",
    completedDescription: "次の段階でゲームサーバーと状態通知を設定できます。",
    expiredTitle: "この設定リンクは期限切れです。",
    expiredDescription: "新しい設定リンクを発行してください。",
    alreadyConnected: "すでに別の Organization に連携されているサーバーです。",
    unavailable: "Discord 連携機能の準備ができていません。",
    retry: "再試行",
    loading: "Discord 連携状態を確認しています。",
    network: "しばらくしてからもう一度お試しください。"
  }
} as const;

type ViewState = "loading" | "login" | "select" | "completed" | "expired" | "error";

function setupTokenFromLocation(): string {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get("setup") ?? "";
  return /^[A-Za-z0-9_-]{32,128}$/u.test(value) ? value : "";
}

function errorMessage(
  error: unknown,
  locale: DashboardLocale
): string {
  const current = text[locale];
  if (!(error instanceof DiscordSetupApiError)) return current.network;
  if (error.code === "guild_already_connected") return current.alreadyConnected;
  if (error.code === "setup_session_expired" || error.code === "setup_session_consumed") {
    return current.expiredDescription;
  }
  if (error.code === "database_unavailable" || error.status === 404 || error.status === 503) {
    return current.unavailable;
  }
  if (error.code === "guild_permission_required") return current.permission;
  return current.network;
}

export function DiscordSetupPage() {
  const [locale] = useState<DashboardLocale>(() => detectDashboardLocale());
  const current = text[locale];
  const [view, setView] = useState<ViewState>("loading");
  const [session, setSession] = useState<DiscordSetupSession>();
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ guildName: string; organizationName: string }>();
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const setupToken = setupTokenFromLocation();

  async function load(signal?: AbortSignal): Promise<void> {
    setError("");
    setView("loading");
    try {
      const next = await getDiscordSetupSession(signal);
      setSession(next);
      if (next.authenticated) {
        setSelectedGuildId(next.guilds[0]?.id ?? "");
        setView("select");
      } else if (setupToken) {
        setView("login");
      } else {
        setView("expired");
      }
    } catch (loadError) {
      setError(errorMessage(loadError, locale));
      setView("error");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (view !== "loading") headingRef.current?.focus();
  }, [view]);

  async function submit(): Promise<void> {
    if (!session?.authenticated || !selectedGuildId || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const connected = await connectDiscordGuild({
        csrfToken: session.csrfToken,
        guildId: selectedGuildId,
        ...(selectedOrganizationId ? { organizationId: selectedOrganizationId } : {})
      });
      setResult({
        guildName: connected.guild.name,
        organizationName: connected.organization.displayName
      });
      setView("completed");
    } catch (submitError) {
      const message = errorMessage(submitError, locale);
      setError(message);
      if (
        submitError instanceof DiscordSetupApiError
        && (submitError.code === "setup_session_expired" || submitError.code === "setup_session_consumed")
      ) {
        setView("expired");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const organizations: DiscordSetupOrganization[] = session?.authenticated
    ? session.organizations
    : [];

  return (
    <main className="discord-setup-shell">
      <Card className="discord-setup-card" aria-busy={view === "loading"}>
        <CardHeader>
          <span className="eyebrow" data-ko={text.ko.eyebrow} data-ja={text.ja.eyebrow}>
            {current.eyebrow}
          </span>
          <CardTitle>
            <h1 ref={headingRef} tabIndex={-1} data-ko={text.ko.title} data-ja={text.ja.title}>
              {current.title}
            </h1>
          </CardTitle>
          <CardDescription data-ko={text.ko.description} data-ja={text.ja.description}>
            {current.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view === "loading" ? (
            <SkeletonCard role="status" loadingLabel={current.loading} />
          ) : null}

          {view === "login" ? (
            <section className="discord-setup-step">
              <h2 data-ko={text.ko.loginTitle} data-ja={text.ja.loginTitle}>{current.loginTitle}</h2>
              <p data-ko={text.ko.loginDescription} data-ja={text.ja.loginDescription}>
                {current.loginDescription}
              </p>
              <Button
                type="button"
                onClick={() => {
                  window.location.assign(discordOAuthStartUrl(setupToken));
                }}
                data-ko={text.ko.login}
                data-ja={text.ja.login}
              >
                {current.login}
              </Button>
            </section>
          ) : null}

          {view === "select" && session?.authenticated ? (
            <section className="discord-setup-step">
              <h2 data-ko={text.ko.selectTitle} data-ja={text.ja.selectTitle}>{current.selectTitle}</h2>
              <p data-ko={text.ko.selectDescription} data-ja={text.ja.selectDescription}>
                {current.selectDescription}
              </p>
              {session.guilds.length === 0 ? (
                <EmptyState>
                  <EmptyStateTitle data-ko={text.ko.noGuilds} data-ja={text.ja.noGuilds}>
                    {current.noGuilds}
                  </EmptyStateTitle>
                  <EmptyStateDescription data-ko={text.ko.permission} data-ja={text.ja.permission}>
                    {current.permission}
                  </EmptyStateDescription>
                </EmptyState>
              ) : (
                <>
                  <fieldset className="discord-guild-list">
                    <legend data-ko={text.ko.selectDescription} data-ja={text.ja.selectDescription}>
                      {current.selectDescription}
                    </legend>
                    {session.guilds.map((guild) => (
                      <label className="discord-guild-option" key={guild.id} title={guild.name}>
                        <input
                          type="radio"
                          name="discord-guild"
                          value={guild.id}
                          checked={selectedGuildId === guild.id}
                          onChange={() => setSelectedGuildId(guild.id)}
                        />
                        {guild.iconUrl ? (
                          <img src={guild.iconUrl} alt="" width="48" height="48" loading="lazy" />
                        ) : (
                          <span className="discord-guild-fallback" aria-hidden="true">D</span>
                        )}
                        <span className="discord-guild-name">{guild.name}</span>
                      </label>
                    ))}
                  </fieldset>
                  <label className="discord-organization-field">
                    <span data-ko={text.ko.organization} data-ja={text.ja.organization}>
                      {current.organization}
                    </span>
                    <select
                      value={selectedOrganizationId}
                      onChange={(event) => setSelectedOrganizationId(event.target.value)}
                    >
                      <option value="" data-ko={text.ko.createOrganization} data-ja={text.ja.createOrganization}>
                        {current.createOrganization}
                      </option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    loading={submitting}
                    disabled={!selectedGuildId || submitting}
                    onClick={() => void submit()}
                  >
                    {submitting ? current.connecting : current.connect}
                  </Button>
                </>
              )}
            </section>
          ) : null}

          {view === "completed" ? (
            <section className="discord-setup-complete" aria-live="polite">
              <h2 data-ko={text.ko.completedTitle} data-ja={text.ja.completedTitle}>
                {current.completedTitle}
              </h2>
              <p>{result ? `${result.guildName} · ${result.organizationName}` : null}</p>
              <p data-ko={text.ko.completedDescription} data-ja={text.ja.completedDescription}>
                {current.completedDescription}
              </p>
            </section>
          ) : null}

          {view === "expired" ? (
            <EmptyState role="alert">
              <EmptyStateTitle data-ko={text.ko.expiredTitle} data-ja={text.ja.expiredTitle}>
                {current.expiredTitle}
              </EmptyStateTitle>
              <EmptyStateDescription data-ko={text.ko.expiredDescription} data-ja={text.ja.expiredDescription}>
                {current.expiredDescription}
              </EmptyStateDescription>
            </EmptyState>
          ) : null}

          {error ? <p className="discord-setup-error" role="alert">{error}</p> : null}
          {view === "error" ? (
            <Button type="button" variant="secondary" onClick={() => void load()}>
              {current.retry}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
