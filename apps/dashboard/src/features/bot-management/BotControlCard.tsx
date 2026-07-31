import { useEffect, useState } from "react";
import type {
  BotManagementRole,
  DiscordBotControlOverview
} from "@streamops/shared";
import { DISCORD_BOT_MESSAGES } from "@streamops/shared";
import { detectDashboardLocale } from "../../i18n";
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
  SkeletonCard,
  StatusPill
} from "../../shared/ui";
import {
  BotManagementApiError,
  botInstallUrl,
  getManagementBotControl,
  updateManagementBotControl
} from "./api";
import {
  botControlActiveCommandCount,
  botControlDraftChanged,
  type DiscordBotControlDraft
} from "./bot-control-view";

const copy = {
  ko: {
    title: "Discord Bot 제어",
    description: "Organization에 연결된 Discord 서버의 공개 명령과 Palworld 상태 모듈을 관리합니다.",
    loading: "Discord Bot 설정을 불러오는 중입니다.",
    noInstallation: "활성 Bot 연결이 없습니다.",
    noInstallationDescription: "Bot이 제거되었거나 설치되지 않았습니다. 같은 Discord 서버에 다시 추가하면 기존 Organization 연결과 저장된 설정이 자동으로 복구됩니다.",
    install: "YORO Bot 추가",
    globalDisabledLabel: "전역 명령 비활성",
    globalDisabled: "운영 전역 설정에서 일반 사용자 명령이 비활성화되어 있습니다. 저장한 설정은 보존되지만 Bot에는 적용되지 않습니다.",
    globalEnabled: "일반 사용자 명령 운영 가능",
    guild: "연결된 Discord 서버",
    module: "Palworld 서버 상태",
    moduleDescription: "`!yoro status`, 접속 플레이어 프로필 조회와 전용 서버 가이드를 제공하는 안전한 읽기 전용 모듈입니다.",
    privateCommandNotice: "작성자에게만 보이는 응답은 Discord의 제한상 `!` 메시지가 아니라 `/yoro status`, `/yoro player`, `/yoro guide`로 제공합니다.",
    publicCommands: "일반 사용자 명령 사용",
    moduleEnabled: "Palworld 상태 모듈 사용",
    statusCommand: "`!yoro status` 사용",
    playerCommand: "`!yoro player` 사용",
    guideCommand: "`!yoro guide` 사용",
    deleteInvocation: "Bot 응답 후 사용한 명령어 삭제",
    deleteInvocationDescription: "인식된 `!yoro` 명령에 응답한 뒤 원본 메시지만 삭제합니다. 삭제 실패는 Bot 응답에 영향을 주지 않습니다.",
    locale: "명령 응답 언어",
    localeAuto: "Discord 서버 언어 자동 감지",
    localeKo: "한국어",
    localeJa: "日本語",
    localeEn: "English",
    localeDescription: "명령 입력은 영어만 지원합니다. 이 설정은 `!yoro`와 `/yoro` 명령의 한국어·일본어·영어 응답에 적용되며, Discord에서는 `/yoro language`로도 변경할 수 있습니다.",
    fields: "상태 메시지 표시 항목",
    players: "접속 인원",
    version: "게임 버전",
    latency: "응답 시간",
    observedAt: "마지막 확인 시각",
    save: "Bot 설정 저장",
    saving: "Bot 설정 저장 중",
    saved: "Discord Bot 설정을 저장했습니다.",
    readOnly: "조회 권한으로 접속했습니다. owner 또는 manager가 설정을 변경할 수 있습니다.",
    revision: "설정 revision",
    conflict: "다른 관리자가 설정을 먼저 변경했습니다. 최신 설정을 다시 불러왔습니다.",
    unavailable: "Discord Bot 설정을 불러오거나 저장할 수 없습니다.",
    sessionExpired: "관리 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
    permissionDenied: "이 Organization의 Discord Bot 설정을 관리할 권한이 없습니다.",
    storageUnavailable: "Discord Bot 설정 저장소를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    invalidResponse: "Discord Bot 설정 응답을 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
    retry: "설정 다시 불러오기",
    previewTitle: "Discord 응답 미리보기",
    previewDescription: "현재 언어와 표시 항목을 기준으로 `!yoro status` 응답을 미리 확인합니다.",
    previewServer: "YORO Palworld Server",
    previewCommandStatus: "상태 명령",
    previewCommandPlayer: "플레이어 명령",
    previewCommandGuide: "가이드 명령",
    enabled: "사용",
    disabled: "사용 안 함",
    statusActive: "연결 활성",
    statusLimited: "일부 기능 비활성",
    installationStatus: "Bot 설치",
    moduleStatus: "Palworld 모듈",
    commandStatus: "활성 명령",
    languageStatus: "응답 언어",
    active: "ACTIVE",
    connected: "연결됨",
    paused: "일시 정지",
    activeCount: "개 활성",
    tabGeneral: "일반",
    tabCommands: "명령",
    tabPreview: "미리보기",
    tabAdvanced: "고급",
    generalTitle: "기본 운영 설정",
    generalDescription: "일반 사용자 접근과 Palworld 모듈, Bot 응답 언어를 관리합니다.",
    commandsTitle: "사용자 명령",
    commandsDescription: "서버 구성원에게 공개할 명령만 활성화합니다.",
    statusCommandDescription: "Palworld 서버의 온라인 상태, 인원과 응답 정보를 조회합니다.",
    guideCommandDescription: "Palworld 전용 서버 연결과 설정 가이드를 제공합니다.",
    playerCommandDescription: "현재 접속 플레이어 목록과 게임 내 프로필을 조회합니다.",
    previewSettingsTitle: "상태 응답 표시 항목",
    previewSettingsDescription: "오른쪽 Discord 미리보기에 표시할 정보를 선택합니다.",
    previewStatusTab: "Status",
    previewGuideTab: "Guide",
    previewPlayerTab: "Player",
    previewChannel: "server-status",
    previewExample: "예시 데이터",
    previewGuideBody: "Palworld 전용 서버 연결에 필요한 설정 방법을 확인합니다.",
    previewPlayerName: "tata",
    previewPlayerLevel: "Lv.80",
    advancedTitle: "고급 동작",
    advancedDescription: "메시지 삭제처럼 추가 Discord 권한이 필요한 동작을 관리합니다.",
    reset: "변경 취소",
    resetDone: "저장되지 않은 변경을 취소했습니다.",
    savedState: "모든 변경 사항이 저장되었습니다.",
    pendingState: "저장되지 않은 변경 사항이 있습니다.",
    readOnlyState: "조회 전용",
    organizationStatus: "Organization",
    organizationConnected: "연결됨"
  },
  ja: {
    title: "Discord Bot コントロール",
    description: "Organizationに連携されたDiscordサーバーの公開コマンドとPalworld状態モジュールを管理します。",
    loading: "Discord Bot設定を読み込んでいます。",
    noInstallation: "有効なBot連携がありません。",
    noInstallationDescription: "Botが削除されたか、導入されていません。同じDiscordサーバーに再度追加すると、既存のOrganization連携と保存済み設定が自動的に復元されます。",
    install: "YORO Botを追加",
    globalDisabledLabel: "全体コマンド無効",
    globalDisabled: "運用全体の設定で一般ユーザーコマンドが無効です。保存した設定は保持されますが、Botには適用されません。",
    globalEnabled: "一般ユーザーコマンドを運用可能",
    guild: "連携済みDiscordサーバー",
    module: "Palworldサーバー状態",
    moduleDescription: "`!yoro status`、接続プレイヤーのプロフィール取得と専用サーバーガイドを提供する安全な読み取り専用モジュールです。",
    privateCommandNotice: "実行者だけに表示される応答はDiscordの制限により`!`メッセージではなく、`/yoro status`、`/yoro player`、`/yoro guide`で提供します。",
    publicCommands: "一般ユーザーコマンドを使用",
    moduleEnabled: "Palworld状態モジュールを使用",
    statusCommand: "`!yoro status`を使用",
    playerCommand: "`!yoro player`を使用",
    guideCommand: "`!yoro guide`を使用",
    deleteInvocation: "Bot応答後に使用したコマンドを削除",
    deleteInvocationDescription: "認識された`!yoro`コマンドに応答した後、元のメッセージのみ削除します。削除失敗はBot応答に影響しません。",
    locale: "コマンド応答言語",
    localeAuto: "Discordサーバー言語を自動検出",
    localeKo: "한국어",
    localeJa: "日本語",
    localeEn: "English",
    localeDescription: "コマンド入力は英語のみ対応します。この設定は`!yoro`と`/yoro`コマンドの韓国語・日本語・英語応答に適用され、Discordでは`/yoro language`からも変更できます。",
    fields: "状態メッセージの表示項目",
    players: "接続人数",
    version: "ゲームバージョン",
    latency: "応答時間",
    observedAt: "最終確認時刻",
    save: "Bot設定を保存",
    saving: "Bot設定を保存中",
    saved: "Discord Bot設定を保存しました。",
    readOnly: "閲覧権限でアクセスしています。ownerまたはmanagerが設定を変更できます。",
    revision: "設定revision",
    conflict: "別の管理者が先に設定を変更しました。最新設定を再読み込みしました。",
    unavailable: "Discord Bot設定を読み込みまたは保存できません。",
    sessionExpired: "管理ログインセッションの有効期限が切れました。もう一度ログインしてください。",
    permissionDenied: "このOrganizationのDiscord Bot設定を管理する権限がありません。",
    storageUnavailable: "Discord Bot設定ストレージを利用できません。しばらくしてからもう一度お試しください。",
    invalidResponse: "Discord Bot設定の応答を確認できません。ページを再読み込みしてください。",
    retry: "設定を再読み込み",
    previewTitle: "Discord応答プレビュー",
    previewDescription: "現在の言語と表示項目を基準に`!yoro status`の応答を確認します。",
    previewServer: "YORO Palworld Server",
    previewCommandStatus: "ステータスコマンド",
    previewCommandPlayer: "プレイヤーコマンド",
    previewCommandGuide: "ガイドコマンド",
    enabled: "使用",
    disabled: "使用しない",
    statusActive: "連携有効",
    statusLimited: "一部機能が無効",
    installationStatus: "Bot導入",
    moduleStatus: "Palworldモジュール",
    commandStatus: "有効コマンド",
    languageStatus: "応答言語",
    active: "ACTIVE",
    connected: "連携済み",
    paused: "一時停止",
    activeCount: "件有効",
    tabGeneral: "一般",
    tabCommands: "コマンド",
    tabPreview: "プレビュー",
    tabAdvanced: "詳細",
    generalTitle: "基本運用設定",
    generalDescription: "一般ユーザーの利用、Palworldモジュール、Bot応答言語を管理します。",
    commandsTitle: "ユーザーコマンド",
    commandsDescription: "サーバーメンバーへ公開するコマンドだけを有効にします。",
    statusCommandDescription: "Palworldサーバーのオンライン状態、人数、応答情報を取得します。",
    guideCommandDescription: "Palworld専用サーバーの連携・設定ガイドを提供します。",
    playerCommandDescription: "接続中プレイヤー一覧とゲーム内プロフィールを取得します。",
    previewSettingsTitle: "状態応答の表示項目",
    previewSettingsDescription: "右側のDiscordプレビューに表示する情報を選択します。",
    previewStatusTab: "Status",
    previewGuideTab: "Guide",
    previewPlayerTab: "Player",
    previewChannel: "server-status",
    previewExample: "サンプルデータ",
    previewGuideBody: "Palworld専用サーバー連携に必要な設定方法を確認します。",
    previewPlayerName: "tata",
    previewPlayerLevel: "Lv.80",
    advancedTitle: "詳細動作",
    advancedDescription: "メッセージ削除など追加のDiscord権限が必要な動作を管理します。",
    reset: "変更を破棄",
    resetDone: "保存前の変更を破棄しました。",
    savedState: "すべての変更が保存されています。",
    pendingState: "保存されていない変更があります。",
    readOnlyState: "閲覧専用",
    organizationStatus: "Organization",
    organizationConnected: "連携済み"
  }
} as const;

type Draft = DiscordBotControlDraft;
type BotControlTab = "general" | "commands" | "preview" | "advanced";
type BotControlPreview = "status" | "guide" | "player";

function draftFrom(overview: DiscordBotControlOverview): Draft {
  const { revision: _revision, ...draft } = overview.settings;
  return draft;
}

export function botControlErrorMessage(
  error: unknown,
  locale: "ko" | "ja"
): string {
  const text = copy[locale];
  if (!(error instanceof BotManagementApiError)) return text.unavailable;
  if (error.status === 401 || error.code === "session_required") {
    return text.sessionExpired;
  }
  if (error.status === 403 || error.code === "permission_required") {
    return text.permissionDenied;
  }
  if (error.status === 503 || error.code === "database_unavailable") {
    return text.storageUnavailable;
  }
  if (error.code === "invalid_response") return text.invalidResponse;
  return text.unavailable;
}

export function BotControlCard(props: {
  organizationId: string;
  role: BotManagementRole;
  csrfToken: string;
}) {
  const [locale] = useState(() => detectDashboardLocale());
  const text = copy[locale];
  const [overview, setOverview] = useState<DiscordBotControlOverview>();
  const [draft, setDraft] = useState<Draft>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [activeTab, setActiveTab] = useState<BotControlTab>("general");
  const [previewCommand, setPreviewCommand] = useState<BotControlPreview>("status");
  const writable = props.role === "owner" || props.role === "manager";

  async function load(signal?: AbortSignal): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const next = await getManagementBotControl(props.organizationId, signal);
      setOverview(next);
      setDraft(draftFrom(next));
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
        setError(botControlErrorMessage(loadError, locale));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setOverview(undefined);
    setDraft(undefined);
    void load(controller.signal);
    return () => controller.abort();
  }, [props.organizationId]);

  useEffect(() => {
    const controller = new AbortController();
    let refreshInFlight = false;
    const refreshInstallation = () => {
      if (
        document.visibilityState !== "visible"
        || refreshInFlight
        || saving
      ) return;
      refreshInFlight = true;
      void getManagementBotControl(props.organizationId, controller.signal)
        .then((next) => {
          const currentGuildId = overview?.installation?.guildId;
          const nextGuildId = next.installation?.guildId;
          if (currentGuildId === nextGuildId) return;
          setOverview(next);
          setDraft(draftFrom(next));
        })
        // 백그라운드 설치 확인 실패는 현재 편집 상태를 유지합니다.
        .catch(() => undefined)
        .finally(() => {
          refreshInFlight = false;
        });
    };
    const timer = window.setInterval(refreshInstallation, 15_000);
    window.addEventListener("focus", refreshInstallation);
    document.addEventListener("visibilitychange", refreshInstallation);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshInstallation);
      document.removeEventListener("visibilitychange", refreshInstallation);
    };
  }, [overview?.installation?.guildId, props.organizationId, saving]);

  async function save(): Promise<void> {
    if (!overview || !draft || !writable || saving) return;
    setSaving(true);
    setError("");
    try {
      const next = await updateManagementBotControl({
        organizationId: props.organizationId,
        csrfToken: props.csrfToken,
        value: {
          ...draft,
          expectedRevision: overview.settings.revision
        }
      });
      setOverview(next);
      setDraft(draftFrom(next));
      setAnnouncement(text.saved);
    } catch (saveError) {
      if (
        saveError instanceof BotManagementApiError
        && saveError.code === "revision_conflict"
      ) {
        setError(text.conflict);
        await load();
      } else {
        setError(botControlErrorMessage(saveError, locale));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading && !overview) {
    return <SkeletonCard role="status" loadingLabel={text.loading} />;
  }

  if (!overview || !draft) {
    return (
      <Card className="bot-control-card">
        <CardHeader>
          <CardTitle as="h2">{text.title}</CardTitle>
          <CardDescription>{text.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="bot-management-error" role="alert">{error}</p>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            {text.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!overview.installation) {
    return (
      <Card className="bot-control-card">
        <CardHeader>
          <CardTitle as="h2">{text.title}</CardTitle>
          <CardDescription>{text.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState>
            <EmptyStateTitle>{text.noInstallation}</EmptyStateTitle>
            <EmptyStateDescription>{text.noInstallationDescription}</EmptyStateDescription>
            <Button
              as="a"
              href={botInstallUrl()}
              rel="noopener noreferrer"
              target="_blank"
            >
              {text.install}
            </Button>
          </EmptyState>
        </CardContent>
      </Card>
    );
  }

  const disabled = !writable || saving;
  const previewLocale = draft.preferredLocale === "auto"
    ? locale
    : draft.preferredLocale;
  const preview = DISCORD_BOT_MESSAGES[previewLocale].prefix;
  const savedDraft = draftFrom(overview);
  const hasChanges = botControlDraftChanged(draft, savedDraft);
  const activeCommandCount = botControlActiveCommandCount(draft);
  const effectiveCommandsEnabled = overview.globalPrefixCommandsEnabled
    && draft.publicCommandsEnabled
    && draft.palworldStatusEnabled;
  const effectiveActiveCommandCount = effectiveCommandsEnabled
    ? activeCommandCount
    : 0;
  const operational = effectiveActiveCommandCount > 0;
  const languageLabel = draft.preferredLocale === "auto"
    ? text.localeAuto
    : draft.preferredLocale === "ko"
      ? text.localeKo
      : draft.preferredLocale === "ja"
        ? text.localeJa
        : text.localeEn;
  const tabs: readonly Readonly<{
    id: BotControlTab;
    label: string;
  }>[] = [
    { id: "general", label: text.tabGeneral },
    { id: "commands", label: text.tabCommands },
    { id: "preview", label: text.tabPreview },
    { id: "advanced", label: text.tabAdvanced },
  ];

  function resetDraft(): void {
    setDraft(savedDraft);
    setError("");
    setAnnouncement(text.resetDone);
  }

  return (
    <Card className="bot-control-card">
      <CardContent className="bot-control-console">
        <header className="bot-control-hero">
          <div className="bot-control-hero__heading">
            <span
              aria-hidden="true"
              className={`bot-control-status-dot${operational ? " is-active" : ""}`}
            />
            <div>
              <span className="bot-control-eyebrow">Discord Bot</span>
              <CardTitle as="h2">{text.title}</CardTitle>
              <CardDescription>{text.description}</CardDescription>
            </div>
          </div>
          <div className="bot-control-hero__actions">
            <StatusPill tone={operational ? "success" : "warning"}>
              {operational ? text.statusActive : text.statusLimited}
            </StatusPill>
            {writable ? (
              <>
                <Button
                  disabled={!hasChanges || saving}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={resetDraft}
                >
                  {text.reset}
                </Button>
                <Button
                  disabled={!hasChanges}
                  loading={saving}
                  loadingLabel={text.saving}
                  size="sm"
                  type="button"
                  onClick={() => void save()}
                >
                  {text.save}
                </Button>
              </>
            ) : null}
          </div>
          <dl className="bot-control-hero__details">
            <div>
              <dt>Guild</dt>
              <dd title={overview.installation.guildDisplayName}>
                {overview.installation.guildDisplayName}
              </dd>
            </div>
            <div>
              <dt>{text.organizationStatus}</dt>
              <dd>{text.organizationConnected}</dd>
            </div>
            <div>
              <dt>{text.installationStatus}</dt>
              <dd>{text.active}</dd>
            </div>
          </dl>
        </header>

        {!overview.globalPrefixCommandsEnabled ? (
          <p className="bot-control-warning" role="status">{text.globalDisabled}</p>
        ) : null}

        <section className="bot-control-summary" aria-label={text.title}>
          {([
            [text.installationStatus, text.active, "installation"],
            [text.moduleStatus, draft.palworldStatusEnabled ? text.enabled : text.paused, "module"],
            [text.commandStatus, `${effectiveActiveCommandCount}${text.activeCount}`, "commands"],
            [text.languageStatus, languageLabel, "language"]
          ] as const).map(([label, value, icon]) => (
            <article className="bot-control-summary__item" key={icon}>
              <span aria-hidden="true" className={`bot-control-summary__icon is-${icon}`} />
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            </article>
          ))}
        </section>

        <nav className="bot-control-tabs" aria-label={text.title} role="tablist">
          {tabs.map((tab) => (
            <button
              aria-controls={`bot-control-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "is-active" : undefined}
              id={`bot-control-tab-${tab.id}`}
              key={tab.id}
              role="tab"
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "general" ? (
          <section
            aria-labelledby="bot-control-tab-general"
            className="bot-control-panel"
            id="bot-control-panel-general"
            role="tabpanel"
          >
            <div className="bot-control-panel__heading">
              <div>
                <h3>{text.generalTitle}</h3>
                <p>{text.generalDescription}</p>
              </div>
            </div>
            <fieldset className="bot-control-panel__fieldset" disabled={disabled}>
              <div className="bot-control-general-grid">
                {([
                  ["public", text.publicCommands, text.globalEnabled, draft.publicCommandsEnabled],
                  ["module", text.moduleEnabled, text.moduleDescription, draft.palworldStatusEnabled]
                ] as const).map(([key, title, description, checked]) => (
                  <label className="bot-control-switch-card" key={key}>
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                    <input
                      checked={checked}
                      type="checkbox"
                      onChange={(event) => setDraft({
                        ...draft,
                        [key === "public" ? "publicCommandsEnabled" : "palworldStatusEnabled"]:
                          event.target.checked
                      })}
                    />
                  </label>
                ))}
              </div>
              <div className="bot-control-language">
                <div>
                  <h4>{text.locale}</h4>
                  <p>{text.localeDescription}</p>
                </div>
                <div className="bot-control-language__grid">
                  {([
                    ["auto", "AUTO", text.localeAuto],
                    ["ko", "KO", text.localeKo],
                    ["ja", "JA", text.localeJa],
                    ["en", "EN", text.localeEn]
                  ] as const).map(([value, code, label]) => (
                    <label
                      className={`bot-control-language__option${draft.preferredLocale === value ? " is-selected" : ""}`}
                      key={value}
                    >
                      <input
                        checked={draft.preferredLocale === value}
                        name="bot-control-locale"
                        type="radio"
                        value={value}
                        onChange={() => setDraft({ ...draft, preferredLocale: value })}
                      />
                      <span>{code}</span>
                      <strong>{label}</strong>
                      <i aria-hidden="true">✓</i>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>
          </section>
        ) : null}

        {activeTab === "commands" ? (
          <section
            aria-labelledby="bot-control-tab-commands"
            className="bot-control-panel"
            id="bot-control-panel-commands"
            role="tabpanel"
          >
            <div className="bot-control-panel__heading">
              <div>
                <h3>{text.commandsTitle}</h3>
                <p>{text.commandsDescription}</p>
              </div>
              <Badge>{effectiveActiveCommandCount}{text.activeCount}</Badge>
            </div>
            <fieldset className="bot-control-panel__fieldset" disabled={disabled}>
              <div className="bot-control-command-grid">
                {([
                  ["statusCommandEnabled", "!yoro status", text.statusCommandDescription],
                  ["guideCommandEnabled", "!yoro guide", text.guideCommandDescription],
                  ["playerCommandEnabled", "!yoro player", text.playerCommandDescription]
                ] as const).map(([key, command, description]) => (
                  <label className={`bot-control-command-card${draft[key] ? " is-enabled" : ""}`} key={key}>
                    <div className="bot-control-command-card__topline">
                      <code>{command}</code>
                      <input
                        checked={draft[key]}
                        type="checkbox"
                        onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
                      />
                    </div>
                    <strong>{draft[key] ? text.enabled : text.disabled}</strong>
                    <p>{description}</p>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="bot-control-note" role="note">{text.privateCommandNotice}</p>
          </section>
        ) : null}

        {activeTab === "preview" ? (
          <section
            aria-labelledby="bot-control-tab-preview"
            className="bot-control-panel"
            id="bot-control-panel-preview"
            role="tabpanel"
          >
            <div className="bot-control-panel__heading">
              <div>
                <h3>{text.previewTitle}</h3>
                <p>{text.previewDescription}</p>
              </div>
              <Badge>{text.previewExample}</Badge>
            </div>
            <div className="bot-control-preview-workspace">
              <fieldset className="bot-control-preview-settings" disabled={disabled}>
                <legend>{text.previewSettingsTitle}</legend>
                <p>{text.previewSettingsDescription}</p>
                {([
                  ["players", text.players],
                  ["version", text.version],
                  ["latency", text.latency],
                  ["observedAt", text.observedAt]
                ] as const).map(([key, label]) => (
                  <label className="bot-control-preview-option" key={key}>
                    <span>{label}</span>
                    <input
                      checked={draft.statusFields[key]}
                      type="checkbox"
                      onChange={(event) => setDraft({
                        ...draft,
                        statusFields: { ...draft.statusFields, [key]: event.target.checked }
                      })}
                    />
                  </label>
                ))}
              </fieldset>
              <div className="bot-control-discord-preview">
                <div className="bot-control-preview-tabs" role="tablist" aria-label={text.previewTitle}>
                  {([
                    ["status", text.previewStatusTab],
                    ["guide", text.previewGuideTab],
                    ["player", text.previewPlayerTab]
                  ] as const).map(([value, label]) => (
                    <button
                      aria-controls="bot-control-preview-surface"
                      aria-selected={previewCommand === value}
                      className={previewCommand === value ? "is-active" : undefined}
                      key={value}
                      role="tab"
                      type="button"
                      onClick={() => setPreviewCommand(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="bot-control-discord-shell" id="bot-control-preview-surface">
                  <div className="bot-control-discord-shell__channel">
                    <span aria-hidden="true">#</span> {text.previewChannel}
                  </div>
                  <div className="bot-control-discord-message">
                    <span aria-hidden="true" className="bot-control-discord-avatar">Y</span>
                    <div>
                      <div className="bot-control-discord-author">
                        <strong>YORO Bot</strong><span>BOT</span><time>16:42</time>
                      </div>
                      <div className="bot-control-preview__embed">
                        {previewCommand === "status" ? (
                          <>
                            <strong>{preview.statusTitle}</strong>
                            <span>{text.previewServer}</span>
                            <dl>
                              <div><dt>{preview.fields.status}</dt><dd>{preview.states.online}</dd></div>
                              {draft.statusFields.players ? <div><dt>{preview.fields.players}</dt><dd>4 / 32</dd></div> : null}
                              {draft.statusFields.version ? <div><dt>{preview.fields.version}</dt><dd>v1.0.2</dd></div> : null}
                              {draft.statusFields.latency ? <div><dt>{preview.fields.latency}</dt><dd>42ms</dd></div> : null}
                              {draft.statusFields.observedAt ? (
                                <div>
                                  <dt>{preview.fields.observedAt}</dt>
                                  <dd>{previewLocale === "ja" ? "たった今" : previewLocale === "en" ? "Just now" : "방금 전"}</dd>
                                </div>
                              ) : null}
                            </dl>
                          </>
                        ) : null}
                        {previewCommand === "guide" ? (
                          <>
                            <strong>{preview.guideTitle}</strong>
                            <p>{text.previewGuideBody}</p>
                            <span className="bot-control-preview__button">{preview.guideButton}</span>
                          </>
                        ) : null}
                        {previewCommand === "player" ? (
                          <>
                            <span className="bot-control-preview__kicker">PALWORLD PLAYER CARD</span>
                            <strong>{preview.playerCardTitle}</strong>
                            <div className="bot-control-preview__player">
                              <span aria-hidden="true">80</span>
                              <div><strong>{text.previewPlayerName}</strong><small>{text.previewPlayerLevel}</small></div>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "advanced" ? (
          <section
            aria-labelledby="bot-control-tab-advanced"
            className="bot-control-panel"
            id="bot-control-panel-advanced"
            role="tabpanel"
          >
            <div className="bot-control-panel__heading">
              <div>
                <h3>{text.advancedTitle}</h3>
                <p>{text.advancedDescription}</p>
              </div>
            </div>
            <fieldset className="bot-control-panel__fieldset" disabled={disabled}>
              <label className="bot-control-switch-card">
                <span>
                  <strong>{text.deleteInvocation}</strong>
                  <small>{text.deleteInvocationDescription}</small>
                </span>
                <input
                  checked={draft.deleteInvocationAfterReply}
                  type="checkbox"
                  onChange={(event) => setDraft({
                    ...draft,
                    deleteInvocationAfterReply: event.target.checked
                  })}
                />
              </label>
            </fieldset>
          </section>
        ) : null}

        {!writable ? <p className="bot-control-read-only">{text.readOnly}</p> : null}
        <div className="bot-control-footer">
          <div>
            <small>{text.revision}: {overview.settings.revision}</small>
            <strong className={hasChanges ? "is-pending" : undefined}>
              {writable
                ? hasChanges ? text.pendingState : text.savedState
                : text.readOnlyState}
            </strong>
          </div>
          {writable ? (
            <div className="bot-control-footer__actions">
              <Button
                disabled={!hasChanges || saving}
                type="button"
                variant="secondary"
                onClick={resetDraft}
              >
                {text.reset}
              </Button>
              <Button
                disabled={!hasChanges}
                loading={saving}
                loadingLabel={text.saving}
                type="button"
                onClick={() => void save()}
              >
                {text.save}
              </Button>
            </div>
          ) : null}
        </div>
        {error ? <p className="bot-management-error" role="alert">{error}</p> : null}
        <p className="sr-only" aria-live="polite">{announcement}</p>
      </CardContent>
    </Card>
  );
}
