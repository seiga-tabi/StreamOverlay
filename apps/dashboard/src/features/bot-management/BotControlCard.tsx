import { useEffect, useState } from "react";
import type {
  BotManagementRole,
  DiscordBotControlOverview,
  DiscordBotControlSettings
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

const copy = {
  ko: {
    title: "Discord Bot 제어",
    description: "Organization에 연결된 Discord 서버의 공개 명령과 Palworld 상태 모듈을 관리합니다.",
    loading: "Discord Bot 설정을 불러오는 중입니다.",
    noInstallation: "활성 Bot 연결이 없습니다.",
    noInstallationDescription: "YORO Bot을 Discord 서버에 추가하고 Organization 연결을 완료해 주세요.",
    install: "YORO Bot 추가",
    globalDisabledLabel: "전역 명령 비활성",
    globalDisabled: "운영 전역 설정에서 일반 사용자 명령이 비활성화되어 있습니다. 저장한 설정은 보존되지만 Bot에는 적용되지 않습니다.",
    globalEnabled: "일반 사용자 명령 운영 가능",
    guild: "연결된 Discord 서버",
    module: "Palworld 서버 상태",
    moduleDescription: "`!yoro 상태`, 접속 플레이어 프로필 조회와 전용 서버 가이드를 제공하는 안전한 읽기 전용 모듈입니다.",
    publicCommands: "일반 사용자 명령 사용",
    moduleEnabled: "Palworld 상태 모듈 사용",
    statusCommand: "`!yoro 상태` 사용",
    playerCommand: "`!yoro 플레이어` 사용",
    guideCommand: "`!yoro 가이드` 사용",
    locale: "Bot 응답 언어",
    localeAuto: "Discord 서버 언어 자동 감지",
    localeKo: "한국어",
    localeJa: "日本語",
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
    previewDescription: "현재 언어와 표시 항목을 기준으로 `!yoro 상태` 응답을 미리 확인합니다.",
    previewServer: "YORO Palworld Server",
    previewCommandStatus: "상태 명령",
    previewCommandPlayer: "플레이어 명령",
    previewCommandGuide: "가이드 명령",
    enabled: "사용",
    disabled: "사용 안 함"
  },
  ja: {
    title: "Discord Bot コントロール",
    description: "Organizationに連携されたDiscordサーバーの公開コマンドとPalworld状態モジュールを管理します。",
    loading: "Discord Bot設定を読み込んでいます。",
    noInstallation: "有効なBot連携がありません。",
    noInstallationDescription: "YORO BotをDiscordサーバーに追加し、Organization連携を完了してください。",
    install: "YORO Botを追加",
    globalDisabledLabel: "全体コマンド無効",
    globalDisabled: "運用全体の設定で一般ユーザーコマンドが無効です。保存した設定は保持されますが、Botには適用されません。",
    globalEnabled: "一般ユーザーコマンドを運用可能",
    guild: "連携済みDiscordサーバー",
    module: "Palworldサーバー状態",
    moduleDescription: "`!yoro ステータス`、接続プレイヤーのプロフィール取得と専用サーバーガイドを提供する安全な読み取り専用モジュールです。",
    publicCommands: "一般ユーザーコマンドを使用",
    moduleEnabled: "Palworld状態モジュールを使用",
    statusCommand: "`!yoro ステータス`を使用",
    playerCommand: "`!yoro プレイヤー`を使用",
    guideCommand: "`!yoro ガイド`を使用",
    locale: "Bot応答言語",
    localeAuto: "Discordサーバー言語を自動検出",
    localeKo: "한국어",
    localeJa: "日本語",
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
    previewDescription: "現在の言語と表示項目を基準に`!yoro ステータス`の応答を確認します。",
    previewServer: "YORO Palworld Server",
    previewCommandStatus: "ステータスコマンド",
    previewCommandPlayer: "プレイヤーコマンド",
    previewCommandGuide: "ガイドコマンド",
    enabled: "使用",
    disabled: "使用しない"
  }
} as const;

type Draft = Omit<DiscordBotControlSettings, "revision">;

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
  return (
    <Card className="bot-control-card">
      <CardHeader>
        <div>
          <CardTitle as="h2">{text.title}</CardTitle>
          <CardDescription>{text.description}</CardDescription>
        </div>
        <StatusPill tone={overview.globalPrefixCommandsEnabled ? "success" : "warning"}>
          {overview.globalPrefixCommandsEnabled
            ? text.globalEnabled
            : text.globalDisabledLabel}
        </StatusPill>
      </CardHeader>
      <CardContent className="bot-control-content">
        {!overview.globalPrefixCommandsEnabled ? (
          <p className="bot-control-warning" role="status">{text.globalDisabled}</p>
        ) : null}
        <div className="bot-control-guild">
          <span>{text.guild}</span>
          <strong title={overview.installation.guildDisplayName}>
            {overview.installation.guildDisplayName}
          </strong>
          <Badge>active</Badge>
        </div>
        <fieldset className="bot-control-settings" disabled={disabled}>
          <legend>{text.module}</legend>
          <p>{text.moduleDescription}</p>
          <label className="bot-control-toggle">
            <input
              checked={draft.publicCommandsEnabled}
              type="checkbox"
              onChange={(event) => setDraft({
                ...draft,
                publicCommandsEnabled: event.target.checked
              })}
            />
            <span>{text.publicCommands}</span>
          </label>
          <label className="bot-control-toggle">
            <input
              checked={draft.palworldStatusEnabled}
              type="checkbox"
              onChange={(event) => setDraft({
                ...draft,
                palworldStatusEnabled: event.target.checked
              })}
            />
            <span>{text.moduleEnabled}</span>
          </label>
          <div className="bot-control-grid">
            <label className="bot-control-toggle">
              <input
                checked={draft.statusCommandEnabled}
                type="checkbox"
                onChange={(event) => setDraft({
                  ...draft,
                  statusCommandEnabled: event.target.checked
                })}
              />
              <span>{text.statusCommand}</span>
            </label>
            <label className="bot-control-toggle">
              <input
                checked={draft.guideCommandEnabled}
                type="checkbox"
                onChange={(event) => setDraft({
                  ...draft,
                  guideCommandEnabled: event.target.checked
                })}
              />
              <span>{text.guideCommand}</span>
            </label>
            <label className="bot-control-toggle">
              <input
                checked={draft.playerCommandEnabled}
                type="checkbox"
                onChange={(event) => setDraft({
                  ...draft,
                  playerCommandEnabled: event.target.checked
                })}
              />
              <span>{text.playerCommand}</span>
            </label>
          </div>
          <label className="bot-management-field bot-control-locale">
            <span>{text.locale}</span>
            <select
              value={draft.preferredLocale}
              onChange={(event) => setDraft({
                ...draft,
                preferredLocale: event.target.value as Draft["preferredLocale"]
              })}
            >
              <option value="auto">{text.localeAuto}</option>
              <option value="ko">{text.localeKo}</option>
              <option value="ja">{text.localeJa}</option>
            </select>
          </label>
          <fieldset className="bot-control-fields">
            <legend>{text.fields}</legend>
            {([
              ["players", text.players],
              ["version", text.version],
              ["latency", text.latency],
              ["observedAt", text.observedAt]
            ] as const).map(([key, label]) => (
              <label className="bot-control-toggle" key={key}>
                <input
                  checked={draft.statusFields[key]}
                  type="checkbox"
                  onChange={(event) => setDraft({
                    ...draft,
                    statusFields: {
                      ...draft.statusFields,
                      [key]: event.target.checked
                    }
                  })}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        </fieldset>
        <section
          className="bot-control-preview"
          aria-labelledby="bot-control-preview-title"
        >
          <div className="bot-control-preview__header">
            <div>
              <h3 id="bot-control-preview-title">{text.previewTitle}</h3>
              <p>{text.previewDescription}</p>
            </div>
            <div className="bot-control-preview__commands">
              <Badge>
                {text.previewCommandStatus}: {
                  draft.publicCommandsEnabled
                  && draft.palworldStatusEnabled
                  && draft.statusCommandEnabled
                    ? text.enabled
                    : text.disabled
                }
              </Badge>
              <Badge>
                {text.previewCommandGuide}: {
                  draft.publicCommandsEnabled
                  && draft.palworldStatusEnabled
                  && draft.guideCommandEnabled
                    ? text.enabled
                    : text.disabled
                }
              </Badge>
              <Badge>
                {text.previewCommandPlayer}: {
                  draft.publicCommandsEnabled
                  && draft.palworldStatusEnabled
                  && draft.playerCommandEnabled
                    ? text.enabled
                    : text.disabled
                }
              </Badge>
            </div>
          </div>
          <div className="bot-control-preview__embed">
            <strong>{preview.statusTitle}</strong>
            <span>{text.previewServer}</span>
            <dl>
              <div>
                <dt>{preview.fields.status}</dt>
                <dd>{preview.states.online}</dd>
              </div>
              {draft.statusFields.players ? (
                <div>
                  <dt>{preview.fields.players}</dt>
                  <dd>4 / 32</dd>
                </div>
              ) : null}
              {draft.statusFields.version ? (
                <div>
                  <dt>{preview.fields.version}</dt>
                  <dd>v1.0.2</dd>
                </div>
              ) : null}
              {draft.statusFields.latency ? (
                <div>
                  <dt>{preview.fields.latency}</dt>
                  <dd>42ms</dd>
                </div>
              ) : null}
              {draft.statusFields.observedAt ? (
                <div>
                  <dt>{preview.fields.observedAt}</dt>
                  <dd>{previewLocale === "ja" ? "たった今" : "방금 전"}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
        {!writable ? <p className="bot-control-read-only">{text.readOnly}</p> : null}
        <div className="bot-control-footer">
          <small>{text.revision}: {overview.settings.revision}</small>
          {writable ? (
            <Button
              loading={saving}
              loadingLabel={text.saving}
              type="button"
              onClick={() => void save()}
            >
              {text.save}
            </Button>
          ) : null}
        </div>
        {error ? <p className="bot-management-error" role="alert">{error}</p> : null}
        <p className="sr-only" aria-live="polite">{announcement}</p>
      </CardContent>
    </Card>
  );
}
