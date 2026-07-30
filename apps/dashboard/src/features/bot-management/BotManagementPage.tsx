import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BotManagementGameServer,
  BotManagementOrganization,
  PalworldServerRegion
} from "@streamops/shared";
import { detectDashboardLocale, type DashboardLocale } from "../../i18n";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
  SkeletonCard
} from "../../shared/ui";
import { DiscordSymbolIcon } from "../../shared/DiscordSymbolIcon";
import {
  BotManagementApiError,
  botInstallUrl,
  claimManagementGuild,
  createManagementGameServer,
  disableManagementGameServer,
  getManagementConnectSession,
  getManagementSession,
  issueAgentBootstrapToken,
  listManagementGameServers,
  managementConnectUrl,
  managementLoginUrl,
  managementSessionNeedsGuildConnection,
  revokeAgentBootstrapToken,
  type BotManagementConnectSession,
  type BotManagementSession
} from "./api";

const copy = {
  ko: {
    eyebrow: "YORO BOT MANAGEMENT",
    title: "Organization 관리",
    description: "Discord Organization과 Palworld 게임 서버의 Agent 설치 준비를 관리합니다.",
    loginTitle: "Discord 관리 로그인이 필요합니다.",
    loginDescription: "Discord OAuth는 사용자 확인에만 사용하고, 로그인 후 즉시 폐기합니다.",
    login: "Discord로 관리 로그인",
    organization: "Organization 선택",
    noOrganization: "연결된 Organization이 없습니다.",
    noOrganizationDescription: "Discord로 로그인하여 Bot이 설치된 서버를 연결해 주세요.",
    connectTitle: "Discord 서버 연결",
    connectDescription: "관리 권한이 있고 YORO Bot이 설치된 서버만 연결할 수 있습니다.",
    connectLogin: "Discord로 로그인하고 서버 선택",
    existingLogin: "기존 Organization 로그인",
    installBot: "Discord 서버에 YORO Bot 추가",
    installedGuilds: "연결 가능한 Discord 서버",
    missingGuilds: "Bot 설치가 필요한 서버",
    installationPending: "Bot 설치 확인 중",
    installationConfirmed: "Bot 설치 확인됨",
    gatewayUnavailable: "Bot Gateway가 비활성 상태라 설치 여부를 확인할 수 없습니다.",
    refreshInstallation: "설치 여부 다시 확인",
    noManageableGuilds: "관리 가능한 Discord 서버가 없습니다.",
    createNewOrganization: "선택한 서버로 새 Organization 생성",
    claim: "선택한 Discord 서버 연결",
    claiming: "연결 중",
    claimCompleted: "Discord 서버 연결이 완료되었습니다.",
    alreadyConnected: "이 Discord 서버는 이미 다른 Organization에 연결되어 있습니다.",
    guildPermissionRequired: "이 Discord 서버를 관리할 권한이 없습니다.",
    setupExpired: "Discord 연결 session이 만료되었습니다. 다시 로그인해 주세요.",
    servers: "Palworld 게임 서버",
    noServers: "등록된 게임 서버가 없습니다.",
    createTitle: "Palworld 게임 서버 등록",
    serverName: "서버 이름",
    region: "지역",
    create: "서버 등록",
    creating: "등록 중",
    disable: "서버 비활성화",
    agent: "Agent 설치 준비",
    issue: "10분 설치 토큰 발급",
    revoke: "설치 토큰 폐기",
    copy: "설치 토큰 복사",
    copied: "설치 토큰을 복사했습니다.",
    tokenNotice: "이 설치 토큰은 한 번만 표시되며 10분 후 만료됩니다. 토큰을 채팅, 로그 또는 공개 저장소에 공유하지 마세요.",
    agentPending: "Agent daemon은 구현되어 있으며 staging 활성화 전에는 검증된 운영 설치 명령을 제공하지 않습니다.",
    expires: "만료",
    expired: "설치 토큰이 만료되었습니다.",
    entitlement: "무료 Organization은 활성 게임 서버 1개까지 등록할 수 있습니다.",
    permission: "이 작업을 수행할 Organization 권한이 없습니다.",
    unavailable: "관리 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    retry: "다시 시도",
    loading: "Organization 관리 정보를 불러오는 중입니다.",
    owner: "소유자",
    manager: "관리자",
    viewer: "조회자",
    regionAsia: "아시아",
    regionNorthAmerica: "북아메리카",
    regionSouthAmerica: "남아메리카",
    regionEurope: "유럽",
    regionOceania: "오세아니아"
  },
  ja: {
    eyebrow: "YORO BOT MANAGEMENT",
    title: "Organization 管理",
    description: "Discord OrganizationとPalworldゲームサーバーのAgent導入準備を管理します。",
    loginTitle: "Discord管理ログインが必要です。",
    loginDescription: "Discord OAuthは本人確認のみに使用し、ログイン完了後すぐに破棄します。",
    login: "Discordで管理ログイン",
    organization: "Organizationを選択",
    noOrganization: "連携済みのOrganizationがありません。",
    noOrganizationDescription: "Discordでログインし、Botが導入済みのサーバーを連携してください。",
    connectTitle: "Discordサーバー連携",
    connectDescription: "管理権限があり、YORO Botが導入済みのサーバーのみ連携できます。",
    connectLogin: "Discordでログインしてサーバーを選択",
    existingLogin: "既存Organizationにログイン",
    installBot: "DiscordサーバーにYORO Botを追加",
    installedGuilds: "連携可能なDiscordサーバー",
    missingGuilds: "Botの導入が必要なサーバー",
    installationPending: "Botの導入を確認中",
    installationConfirmed: "Botの導入を確認済み",
    gatewayUnavailable: "Bot Gatewayが無効なため、導入状態を確認できません。",
    refreshInstallation: "導入状態を再確認",
    noManageableGuilds: "管理可能なDiscordサーバーがありません。",
    createNewOrganization: "選択したサーバーで新しいOrganizationを作成",
    claim: "選択したDiscordサーバーを連携",
    claiming: "連携中",
    claimCompleted: "Discordサーバーの連携が完了しました。",
    alreadyConnected: "このDiscordサーバーは別のOrganizationに連携済みです。",
    guildPermissionRequired: "このDiscordサーバーを管理する権限がありません。",
    setupExpired: "Discord連携sessionの有効期限が切れました。もう一度ログインしてください。",
    servers: "Palworldゲームサーバー",
    noServers: "登録済みゲームサーバーはありません。",
    createTitle: "Palworldゲームサーバー登録",
    serverName: "サーバー名",
    region: "地域",
    create: "サーバー登録",
    creating: "登録中",
    disable: "サーバーを無効化",
    agent: "Agent導入準備",
    issue: "10分間の導入トークンを発行",
    revoke: "導入トークンを破棄",
    copy: "導入トークンをコピー",
    copied: "導入トークンをコピーしました。",
    tokenNotice: "この導入トークンは一度だけ表示され、10分後に期限切れとなります。チャット、ログ、公開リポジトリで共有しないでください。",
    agentPending: "Agent daemonは実装済みですが、staging有効化前は検証済みの運用導入コマンドを提供しません。",
    expires: "期限",
    expired: "導入トークンの有効期限が切れました。",
    entitlement: "無料Organizationは有効なゲームサーバーを1台まで登録できます。",
    permission: "この操作に必要なOrganization権限がありません。",
    unavailable: "管理機能を利用できません。しばらくしてからもう一度お試しください。",
    retry: "再試行",
    loading: "Organization管理情報を読み込んでいます。",
    owner: "所有者",
    manager: "管理者",
    viewer: "閲覧者",
    regionAsia: "アジア",
    regionNorthAmerica: "北米",
    regionSouthAmerica: "南米",
    regionEurope: "ヨーロッパ",
    regionOceania: "オセアニア"
  }
} as const;

const regions: readonly PalworldServerRegion[] = [
  "asia",
  "north_america",
  "south_america",
  "europe",
  "oceania"
];

type IssuedToken = {
  gameServerId: string;
  installToken: string;
  expiresAt: string;
};

function messageFor(error: unknown, locale: DashboardLocale): string {
  const text = copy[locale];
  if (!(error instanceof BotManagementApiError)) return text.unavailable;
  if (error.code === "entitlement_exceeded") return text.entitlement;
  if (error.code === "permission_required") return text.permission;
  if (error.code === "guild_already_connected") return text.alreadyConnected;
  if (
    error.code === "guild_permission_required"
    || error.code === "organization_permission_required"
    || error.code === "permission_required"
  ) return text.guildPermissionRequired;
  if (
    error.code === "setup_session_expired"
    || error.code === "setup_session_consumed"
    || error.code === "discord_session_unavailable"
  ) return text.setupExpired;
  if (error.code === "bot_installation_required") return text.installationPending;
  if (error.code === "bot_gateway_unavailable") return text.gatewayUnavailable;
  return text.unavailable;
}

export function BotManagementPage({ embedded = false }: { embedded?: boolean }) {
  const [locale] = useState<DashboardLocale>(() => detectDashboardLocale());
  const text = copy[locale];
  const [session, setSession] = useState<BotManagementSession>();
  const [connectSession, setConnectSession] = useState<BotManagementConnectSession>();
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [claimOrganizationId, setClaimOrganizationId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [servers, setServers] = useState<readonly BotManagementGameServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [region, setRegion] = useState<PalworldServerRegion>("asia");
  const [issued, setIssued] = useState<IssuedToken>();
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const Root = embedded ? "div" : "main";

  const selectedOrganization = useMemo(
    () => session?.authenticated
      ? session.organizations.find((organization) => organization.id === organizationId)
      : undefined,
    [organizationId, session]
  );

  async function loadSession(signal?: AbortSignal): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const next = await getManagementSession(signal);
      setSession(next);
      if (next.authenticated) {
        const nextOrganization = organizationId || next.organizations[0]?.id || "";
        setOrganizationId(nextOrganization);
        if (nextOrganization) {
          setConnectSession(undefined);
          setServers(await listManagementGameServers(nextOrganization, signal));
        } else {
          const connecting = await getManagementConnectSession(signal);
          setConnectSession(connecting);
          if (connecting.authenticated) {
            setSelectedGuildId(connecting.installedGuilds[0]?.id ?? "");
          }
        }
      } else {
        const connecting = await getManagementConnectSession(signal);
        setConnectSession(connecting);
        if (connecting.authenticated) {
          setSelectedGuildId(connecting.installedGuilds[0]?.id ?? "");
        }
      }
    } catch (loadError) {
      setError(messageFor(loadError, locale));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadSession(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (
      !connectSession?.authenticated
      || connectSession.installedGuilds.length > 0
      || connectSession.missingBotGuilds.length === 0
    ) return undefined;
    let attempt = 0;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      attempt += 1;
      void getManagementConnectSession(controller.signal)
        .then((next) => {
          setConnectSession(next);
          if (next.authenticated && next.installedGuilds.length > 0) {
            setSelectedGuildId(next.installedGuilds[0]?.id ?? "");
            window.clearInterval(timer);
          }
        })
        .catch(() => undefined);
      if (attempt >= 5) window.clearInterval(timer);
    }, 2_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [connectSession]);

  async function refreshGuilds(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const next = await getManagementConnectSession();
      setConnectSession(next);
      if (next.authenticated) {
        setSelectedGuildId(next.installedGuilds[0]?.id ?? "");
      }
    } catch (refreshError) {
      setError(messageFor(refreshError, locale));
    } finally {
      setLoading(false);
    }
  }

  async function claimGuild(): Promise<void> {
    if (
      !connectSession?.authenticated
      || !selectedGuildId
      || submitting
    ) return;
    setSubmitting(true);
    setError("");
    try {
      await claimManagementGuild({
        guildId: selectedGuildId,
        ...(claimOrganizationId ? { organizationId: claimOrganizationId } : {}),
        csrfToken: connectSession.csrfToken
      });
      setAnnouncement(text.claimCompleted);
      await loadSession();
      headingRef.current?.focus();
    } catch (claimError) {
      setError(messageFor(claimError, locale));
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!issued) return undefined;
    const remaining = Date.parse(issued.expiresAt) - Date.now();
    if (remaining <= 0) {
      setIssued(undefined);
      setAnnouncement(text.expired);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setIssued(undefined);
      setAnnouncement(text.expired);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [issued, text.expired]);

  async function selectOrganization(id: string): Promise<void> {
    setOrganizationId(id);
    setIssued(undefined);
    setLoading(true);
    setError("");
    try {
      setServers(await listManagementGameServers(id));
    } catch (loadError) {
      setError(messageFor(loadError, locale));
    } finally {
      setLoading(false);
    }
  }

  async function createServer(): Promise<void> {
    if (!session?.authenticated || !organizationId || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const server = await createManagementGameServer({
        organizationId,
        csrfToken: session.csrfToken,
        value: { displayName, region }
      });
      setServers((current) => [...current, server]);
      setDisplayName("");
    } catch (createError) {
      setError(messageFor(createError, locale));
    } finally {
      setSubmitting(false);
    }
  }

  async function issueToken(server: BotManagementGameServer): Promise<void> {
    if (!session?.authenticated || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      setIssued(await issueAgentBootstrapToken({
        organizationId,
        gameServerId: server.id,
        csrfToken: session.csrfToken
      }));
      setAnnouncement(text.tokenNotice);
    } catch (issueError) {
      setError(messageFor(issueError, locale));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Root
      className={`bot-management-page ${embedded ? "is-embedded" : ""}`}
      aria-busy={loading}
    >
      <header className="bot-management-header">
        <span className="eyebrow">{text.eyebrow}</span>
        <h1 ref={headingRef} tabIndex={-1}>{text.title}</h1>
        <p>{text.description}</p>
      </header>
      {loading && !session ? <SkeletonCard role="status" loadingLabel={text.loading} /> : null}
      {!loading && session && !session.authenticated && !connectSession?.authenticated ? (
        <EmptyState>
          <EmptyStateTitle>{text.loginTitle}</EmptyStateTitle>
          <EmptyStateDescription>{text.loginDescription}</EmptyStateDescription>
          <div className="bot-management-actions">
            <Button type="button" onClick={() => window.location.assign(managementConnectUrl())}>
              {text.connectLogin}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.location.assign(botInstallUrl())}
            >
              {text.installBot}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.location.assign(managementLoginUrl())}
            >
              {text.existingLogin}
            </Button>
          </div>
        </EmptyState>
      ) : null}
      {connectSession?.authenticated ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{text.connectTitle}</CardTitle>
            <CardDescription>{text.connectDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {connectSession.installedGuilds.length > 0 ? (
              <>
                <fieldset className="discord-guild-list">
                  <legend>{text.installedGuilds}</legend>
                  {connectSession.installedGuilds.map((guild) => (
                    <label className="discord-guild-option" key={guild.id} title={guild.name}>
                      <input
                        checked={selectedGuildId === guild.id}
                        name="management-discord-guild"
                        onChange={() => setSelectedGuildId(guild.id)}
                        type="radio"
                        value={guild.id}
                      />
                      {guild.iconUrl
                        ? <img alt="" height="40" src={guild.iconUrl} width="40" />
                        : (
                            <span aria-hidden="true" className="discord-guild-fallback">
                              <DiscordSymbolIcon />
                            </span>
                          )}
                      <span className="bot-management-guild-summary">
                        <span className="discord-guild-name">{guild.name}</span>
                        <strong>{text.installationConfirmed}</strong>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="bot-management-field">
                  <span>{text.organization}</span>
                  <select
                    value={claimOrganizationId}
                    onChange={(event) => setClaimOrganizationId(event.target.value)}
                  >
                    <option value="">{text.createNewOrganization}</option>
                    {connectSession.organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={!selectedGuildId}
                  loading={submitting}
                  loadingLabel={text.claiming}
                  onClick={() => void claimGuild()}
                  type="button"
                >
                  {text.claim}
                </Button>
              </>
            ) : null}
            {connectSession.missingBotGuilds.length > 0 ? (
              <section aria-busy={loading}>
                <h3>{text.missingGuilds}</h3>
                <ul>
                  {connectSession.missingBotGuilds.map((guild) => (
                    <li key={guild.id} title={guild.name}>{guild.name}</li>
                  ))}
                </ul>
                <p role="status">{text.installationPending}</p>
                <div className="bot-management-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => window.location.assign(botInstallUrl())}
                  >
                    {text.installBot}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void refreshGuilds()}>
                    {text.refreshInstallation}
                  </Button>
                </div>
              </section>
            ) : null}
            {connectSession.installedGuilds.length === 0
              && connectSession.missingBotGuilds.length === 0 ? (
                <EmptyState>
                  <EmptyStateTitle>{text.noManageableGuilds}</EmptyStateTitle>
                </EmptyState>
              ) : null}
          </CardContent>
        </Card>
      ) : null}
      {session
        && managementSessionNeedsGuildConnection(session)
        && !connectSession?.authenticated ? (
        <EmptyState>
          <EmptyStateTitle>{text.noOrganization}</EmptyStateTitle>
          <EmptyStateDescription>{text.noOrganizationDescription}</EmptyStateDescription>
          <div className="bot-management-actions">
            <Button type="button" onClick={() => window.location.assign(managementConnectUrl())}>
              {text.connectLogin}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.location.assign(botInstallUrl())}
            >
              {text.installBot}
            </Button>
          </div>
        </EmptyState>
      ) : null}
      {session?.authenticated && session.organizations.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{text.organization}</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="bot-management-field">
                <span>{text.organization}</span>
                <select
                  value={organizationId}
                  onChange={(event) => void selectOrganization(event.target.value)}
                >
                  {session.organizations.map((organization: BotManagementOrganization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.displayName}
                    </option>
                  ))}
                </select>
              </label>
              {selectedOrganization ? (
                <Badge>{text[selectedOrganization.role]}</Badge>
              ) : null}
            </CardContent>
          </Card>

          {selectedOrganization?.role !== "viewer" ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{text.createTitle}</CardTitle>
                <CardDescription>{text.entitlement}</CardDescription>
              </CardHeader>
              <CardContent className="bot-management-create">
                <label className="bot-management-field">
                  <span>{text.serverName}</span>
                  <input
                    maxLength={120}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </label>
                <label className="bot-management-field">
                  <span>{text.region}</span>
                  <select
                    value={region}
                    onChange={(event) => setRegion(event.target.value as PalworldServerRegion)}
                  >
                    {regions.map((value) => (
                      <option key={value} value={value}>
                        {text[`region${value.split("_").map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`).join("")}` as keyof typeof text]}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  disabled={!displayName.trim()}
                  loading={submitting}
                  loadingLabel={text.creating}
                  onClick={() => void createServer()}
                >
                  {text.create}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <section className="bot-management-servers" aria-labelledby="bot-management-servers-title">
            <h2 id="bot-management-servers-title">{text.servers}</h2>
            {!loading && servers.length === 0 ? (
              <EmptyState>
                <EmptyStateTitle>{text.noServers}</EmptyStateTitle>
              </EmptyState>
            ) : null}
            {servers.map((server) => (
              <Card key={server.id}>
                <CardHeader>
                  <CardTitle>{server.displayName}</CardTitle>
                  <CardDescription>{text[`region${server.region.split("_").map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`).join("")}` as keyof typeof text]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bot-management-actions">
                    {selectedOrganization?.role !== "viewer" && server.isEnabled ? (
                      <Button type="button" variant="secondary" onClick={() => void issueToken(server)}>
                        {text.issue}
                      </Button>
                    ) : null}
                    {selectedOrganization?.role === "owner" && server.isEnabled ? (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={async () => {
                          if (!session.authenticated) return;
                          setSubmitting(true);
                          setError("");
                          try {
                            await disableManagementGameServer({
                              organizationId,
                              gameServerId: server.id,
                              csrfToken: session.csrfToken
                            });
                            setServers((current) => current.map((item) =>
                              item.id === server.id
                                ? { ...item, isEnabled: false, connectionStatus: "revoked" }
                                : item
                            ));
                          } catch (disableError) {
                            setError(messageFor(disableError, locale));
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                      >
                        {text.disable}
                      </Button>
                    ) : null}
                  </div>
                  {issued?.gameServerId === server.id ? (
                    <section className="bot-management-token" aria-labelledby={`agent-${server.id}`}>
                      <h3 id={`agent-${server.id}`}>{text.agent}</h3>
                      <p>{text.tokenNotice}</p>
                      <p>{text.agentPending}</p>
                      <label className="bot-management-field">
                        <span>{text.agent}</span>
                        <input
                          aria-label={text.agent}
                          readOnly
                          spellCheck={false}
                          value={issued.installToken}
                        />
                      </label>
                      <p>{text.expires}: {new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      }).format(new Date(issued.expiresAt))}</p>
                      <div className="bot-management-actions">
                        <Button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(issued.installToken);
                              setAnnouncement(text.copied);
                            } catch (copyError) {
                              setError(messageFor(copyError, locale));
                            }
                          }}
                          aria-label={text.copy}
                        >
                          {text.copy}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={async () => {
                            if (!session.authenticated) return;
                            setSubmitting(true);
                            setError("");
                            try {
                              await revokeAgentBootstrapToken({
                                organizationId,
                                gameServerId: server.id,
                                csrfToken: session.csrfToken
                              });
                              setIssued(undefined);
                            } catch (revokeError) {
                              setError(messageFor(revokeError, locale));
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                        >
                          {text.revoke}
                        </Button>
                      </div>
                    </section>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      ) : null}
      {error ? <p className="bot-management-error" role="alert">{error}</p> : null}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </Root>
  );
}
