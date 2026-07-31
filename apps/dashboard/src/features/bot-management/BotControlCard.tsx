import { useEffect, useState } from "react";
import type {
  BotManagementRole,
  DiscordBotControlOverview,
  DiscordBotControlSettings
} from "@streamops/shared";
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
    moduleDescription: "`!yoro 상태`와 전용 서버 가이드 기능을 제공하는 안전한 읽기 전용 모듈입니다.",
    publicCommands: "일반 사용자 명령 사용",
    moduleEnabled: "Palworld 상태 모듈 사용",
    statusCommand: "`!yoro 상태` 사용",
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
    unavailable: "Discord Bot 설정을 불러오거나 저장할 수 없습니다."
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
    moduleDescription: "`!yoro ステータス`と専用サーバーガイドを提供する安全な読み取り専用モジュールです。",
    publicCommands: "一般ユーザーコマンドを使用",
    moduleEnabled: "Palworld状態モジュールを使用",
    statusCommand: "`!yoro ステータス`を使用",
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
    unavailable: "Discord Bot設定を読み込みまたは保存できません。"
  }
} as const;

type Draft = Omit<DiscordBotControlSettings, "revision">;

function draftFrom(overview: DiscordBotControlOverview): Draft {
  const { revision: _revision, ...draft } = overview.settings;
  return draft;
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
        setError(text.unavailable);
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
        setError(text.unavailable);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading && !overview) {
    return <SkeletonCard role="status" loadingLabel={text.loading} />;
  }

  if (!overview || !draft) {
    return <p className="bot-management-error" role="alert">{error}</p>;
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
