import { useEffect, useState, type FormEvent } from "react";
import type { LolChampionSkinOption, LolChampionSummary, LolGameMonitorSettings } from "@streamops/shared";
import { apiGet, apiPost } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";

type LolProfileSettings = {
  championSkinOverrides: Record<string, number>;
  refreshError?: string;
};

type LolProfileSkinOptions = {
  status: "ready" | "missing_streamer" | "riot_not_configured" | "invalid_streamer" | "not_found" | "no_mastery";
  streamerRiotId: string;
  champion?: LolChampionSummary;
  skins: LolChampionSkinOption[];
  selectedSkinNum: number;
  message?: string;
};

const i18n = {
  ko: {
    title: "솔로랭크 방송 설정",
    description: "방송자 Riot ID, 게임 자동 감시, 솔로랭크 오버레이용 챔피언 스킨을 관리합니다.",
    active: "진행 중",
    closed: "대기",
    gameMonitorTitle: "게임 자동 감시",
    streamerRiotId: "방송자 Riot ID",
    gameMonitorEnabled: "자동 감시 사용",
    autoSelectNext: "게임 종료 후 다음 참가자 자동 선정",
    announceInChat: "채팅 안내 사용",
    saveGameMonitor: "저장",
    gameMonitorSaved: "게임 감시 설정을 저장했습니다.",
    gameMonitorSaveFailed: "게임 감시 설정 저장에 실패했습니다.",
    gameMonitorLoadFailed: "게임 감시 설정을 불러오지 못했습니다.",
    gameMonitorWaiting: "Riot ID가 비어 있으면 감시가 대기 상태로 유지됩니다.",
    refreshStreamerProfile: "실제 전적 갱신",
    refreshingStreamerProfile: "갱신 중",
    streamerProfileRefreshed: "방송자 솔로랭크 전적을 갱신하고 overlay에 전송했습니다.",
    streamerProfileRefreshFailed: "방송자 전적 갱신에 실패했습니다.",
    profileSettingsTitle: "방송자 챔피언 스킨 설정",
    championSkinOverrides: "모스트 1 챔피언 스킨",
    championSkinOverridesHelp: "방송자 Riot ID가 등록되어 있고 Riot API key가 설정되어 있으면 숙련도 1등 챔피언의 스킨을 이미지로 선택할 수 있습니다.",
    reloadProfileSettings: "스킨 목록 새로고침",
    profileSettingsSaved: "스킨 설정을 저장했습니다.",
    profileSettingsLoadFailed: "스킨 설정을 불러오지 못했습니다.",
    profileSettingsSaveFailed: "스킨 설정 저장에 실패했습니다.",
    profileSettingsMissingStreamer: "방송자 Riot ID를 먼저 등록하세요.",
    profileSettingsRiotMissing: "Riot API key가 설정되어 있어야 스킨 목록을 불러올 수 있습니다.",
    profileSettingsNoChampion: "숙련도 1등 챔피언 정보를 찾지 못했습니다.",
    selectedSkin: "선택됨",
    none: "없음"
  },
  ja: {
    title: "ソロランク配信設定",
    description: "配信者 Riot ID、試合自動監視、ソロランクオーバーレイ用チャンピオンスキンを管理します。",
    active: "進行中",
    closed: "待機",
    gameMonitorTitle: "試合自動監視",
    streamerRiotId: "配信者 Riot ID",
    gameMonitorEnabled: "自動監視を使用",
    autoSelectNext: "試合終了後に次の参加者を自動選出",
    announceInChat: "チャット案内を使用",
    saveGameMonitor: "保存",
    gameMonitorSaved: "試合監視設定を保存しました。",
    gameMonitorSaveFailed: "試合監視設定の保存に失敗しました。",
    gameMonitorLoadFailed: "試合監視設定を読み込めませんでした。",
    gameMonitorWaiting: "Riot ID が空の場合、監視は待機状態になります。",
    refreshStreamerProfile: "実戦績を更新",
    refreshingStreamerProfile: "更新中",
    streamerProfileRefreshed: "配信者ソロランク戦績を更新し、overlay に送信しました。",
    streamerProfileRefreshFailed: "配信者戦績の更新に失敗しました。",
    profileSettingsTitle: "配信者チャンピオンスキン設定",
    championSkinOverrides: "得意1位チャンピオンスキン",
    championSkinOverridesHelp: "配信者 Riot ID が登録され、Riot API key が設定されている場合、熟練度1位チャンピオンのスキンを画像で選択できます。",
    reloadProfileSettings: "スキン一覧を更新",
    profileSettingsSaved: "スキン設定を保存しました。",
    profileSettingsLoadFailed: "スキン設定を読み込めませんでした。",
    profileSettingsSaveFailed: "スキン設定の保存に失敗しました。",
    profileSettingsMissingStreamer: "配信者 Riot ID を先に登録してください。",
    profileSettingsRiotMissing: "スキン一覧を読み込むには Riot API key が必要です。",
    profileSettingsNoChampion: "熟練度1位チャンピオン情報が見つかりませんでした。",
    selectedSkin: "選択中",
    none: "なし"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

function championArtUrl(champion: LolChampionSummary | undefined): string | undefined {
  return champion?.splashUrl ?? champion?.loadingUrl ?? champion?.iconUrl;
}

function skinOptionsMessage(options: LolProfileSkinOptions | null): string {
  if (!options) return "";
  if (options.status === "missing_streamer") return t.profileSettingsMissingStreamer;
  if (options.status === "riot_not_configured") return t.profileSettingsRiotMissing;
  if (options.status === "invalid_streamer") return options.message ?? t.gameMonitorSaveFailed;
  if (["not_found", "no_mastery"].includes(options.status)) return t.profileSettingsNoChampion;
  return "";
}

function championDisplayName(champion: LolChampionSummary | undefined): string {
  if (!champion) return t.none;
  return champion.nameJa ?? champion.nameKo ?? champion.championKey ?? String(champion.championId);
}

function skinDisplayName(skin: LolChampionSkinOption): string {
  return skin.nameJa ?? skin.nameKo;
}

function apiErrorDetail(error: unknown, path: string, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return error.message.replace(new RegExp(`^${escapedPath} failed: \\d+(?: - )?`), "") || fallback;
}

export function SoloRankPage() {
  const [gameMonitor, setGameMonitor] = useState<LolGameMonitorSettings | null>(null);
  const [streamerRiotId, setStreamerRiotId] = useState("");
  const [monitorEnabled, setMonitorEnabled] = useState(true);
  const [autoSelectNextAfterGame, setAutoSelectNextAfterGame] = useState(true);
  const [announceInChat, setAnnounceInChat] = useState(true);
  const [monitorSaving, setMonitorSaving] = useState(false);
  const [monitorMessage, setMonitorMessage] = useState("");
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [profileRefreshMessage, setProfileRefreshMessage] = useState("");
  const [profileSettings, setProfileSettings] = useState<LolProfileSettings>({ championSkinOverrides: {} });
  const [skinOptions, setSkinOptions] = useState<LolProfileSkinOptions | null>(null);
  const [skinOptionsLoading, setSkinOptionsLoading] = useState(false);
  const [profileSettingsSaving, setProfileSettingsSaving] = useState(false);
  const [profileSettingsMessage, setProfileSettingsMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    void apiGet<LolGameMonitorSettings>("/api/participation/game-monitor")
      .then((settings) => {
        if (!mounted) return;
        setGameMonitor(settings);
        setStreamerRiotId(settings.streamerRiotId);
        setMonitorEnabled(settings.enabled);
        setAutoSelectNextAfterGame(settings.autoSelectNextAfterGame);
        setAnnounceInChat(settings.announceInChat);
      })
      .catch(() => {
        if (mounted) setMonitorMessage(t.gameMonitorLoadFailed);
      });
    void apiGet<LolProfileSettings>("/api/participation/profile-settings")
      .then((settings) => {
        if (mounted) setProfileSettings(settings);
      })
      .catch(() => {
        if (mounted) setProfileSettingsMessage(t.profileSettingsLoadFailed);
      });
    void loadSkinOptions(() => mounted);
    return () => {
      mounted = false;
    };
  }, []);

  async function saveGameMonitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMonitorSaving(true);
    setMonitorMessage("");
    let savedSettings: LolGameMonitorSettings | undefined;
    try {
      const saved = await apiPost<LolGameMonitorSettings>("/api/participation/game-monitor", {
        streamerRiotId,
        enabled: monitorEnabled,
        autoSelectNextAfterGame,
        announceInChat
      });
      setGameMonitor(saved);
      setStreamerRiotId(saved.streamerRiotId);
      setMonitorEnabled(saved.enabled);
      setAutoSelectNextAfterGame(saved.autoSelectNextAfterGame);
      setAnnounceInChat(saved.announceInChat);
      setMonitorMessage(t.gameMonitorSaved);
      savedSettings = saved;
      await loadSkinOptions();
    } catch {
      setMonitorMessage(t.gameMonitorSaveFailed);
    } finally {
      setMonitorSaving(false);
    }
    if (savedSettings?.streamerRiotId.trim()) await refreshStreamerProfile(false);
  }

  async function refreshStreamerProfile(showSuccess = true) {
    setProfileRefreshing(true);
    if (showSuccess) setProfileRefreshMessage("");
    try {
      await apiPost("/api/participation/streamer-profile/refresh", {});
      setProfileRefreshMessage(t.streamerProfileRefreshed);
    } catch (error) {
      setProfileRefreshMessage(apiErrorDetail(error, "/api/participation/streamer-profile/refresh", t.streamerProfileRefreshFailed));
    } finally {
      setProfileRefreshing(false);
    }
  }

  async function loadSkinOptions(shouldApply = () => true) {
    setSkinOptionsLoading(true);
    setProfileSettingsMessage("");
    try {
      const options = await apiGet<LolProfileSkinOptions>("/api/participation/profile-settings/skin-options");
      if (!shouldApply()) return;
      setSkinOptions(options);
      const message = skinOptionsMessage(options);
      if (message) setProfileSettingsMessage(message);
    } catch {
      if (shouldApply()) setProfileSettingsMessage(t.profileSettingsLoadFailed);
    } finally {
      if (shouldApply()) setSkinOptionsLoading(false);
    }
  }

  async function saveProfileSkin(skin: LolChampionSkinOption) {
    const champion = skinOptions?.champion;
    if (!champion) return;
    const championKey = champion.championKey ?? String(champion.championId);
    const championSkinOverrides = {
      ...profileSettings.championSkinOverrides,
      [championKey]: skin.skinNum
    };
    setProfileSettingsSaving(true);
    setProfileSettingsMessage("");
    let savedSettings: LolProfileSettings | undefined;
    try {
      const saved = await apiPost<LolProfileSettings>("/api/participation/profile-settings", {
        championSkinOverrides
      });
      setProfileSettings(saved);
      setSkinOptions((previous) => previous ? { ...previous, selectedSkinNum: skin.skinNum } : previous);
      setProfileSettingsMessage(t.profileSettingsSaved);
      savedSettings = saved;
    } catch (error) {
      setProfileSettingsMessage(apiErrorDetail(error, "/api/participation/profile-settings", t.profileSettingsSaveFailed));
    } finally {
      setProfileSettingsSaving(false);
    }
    if (savedSettings?.refreshError) {
      setProfileRefreshMessage(savedSettings.refreshError);
      return;
    }
    if (savedSettings) await refreshStreamerProfile(false);
  }

  return (
    <>
      <div className="page-title-row page-header compact">
        <div>
          <h1 data-ko={i18n.ko.title} data-ja={i18n.ja.title}>{t.title}</h1>
          <p className="muted" data-ko={i18n.ko.description} data-ja={i18n.ja.description}>{t.description}</p>
        </div>
      </div>

      <div className="card participation-monitor-card">
        <div className="card-title-row">
          <h2 data-ko={i18n.ko.gameMonitorTitle} data-ja={i18n.ja.gameMonitorTitle}>{t.gameMonitorTitle}</h2>
          <span className={`queue-status ${monitorEnabled && streamerRiotId.trim() ? "good" : "neutral"}`}>
            {monitorEnabled && streamerRiotId.trim() ? t.active : t.closed}
          </span>
        </div>
        <form className="participation-monitor-form" onSubmit={(event) => void saveGameMonitor(event)}>
          <label className="field">
            <span data-ko={i18n.ko.streamerRiotId} data-ja={i18n.ja.streamerRiotId}>{t.streamerRiotId}</span>
            <input
              value={streamerRiotId}
              placeholder="StreamerName#KR1"
              onChange={(event) => setStreamerRiotId(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={monitorEnabled} onChange={(event) => setMonitorEnabled(event.target.checked)} />
            <span data-ko={i18n.ko.gameMonitorEnabled} data-ja={i18n.ja.gameMonitorEnabled}>{t.gameMonitorEnabled}</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={autoSelectNextAfterGame} onChange={(event) => setAutoSelectNextAfterGame(event.target.checked)} />
            <span data-ko={i18n.ko.autoSelectNext} data-ja={i18n.ja.autoSelectNext}>{t.autoSelectNext}</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={announceInChat} onChange={(event) => setAnnounceInChat(event.target.checked)} />
            <span data-ko={i18n.ko.announceInChat} data-ja={i18n.ja.announceInChat}>{t.announceInChat}</span>
          </label>
          <button className="secondary compact-button" disabled={monitorSaving} type="submit">{t.saveGameMonitor}</button>
        </form>
        <p className="muted">{gameMonitor?.streamerRiotId ? gameMonitor.streamerRiotId : t.gameMonitorWaiting}</p>
        <button
          className="secondary compact-button"
          disabled={profileRefreshing || !streamerRiotId.trim()}
          onClick={() => void refreshStreamerProfile()}
          type="button"
        >
          {profileRefreshing ? t.refreshingStreamerProfile : t.refreshStreamerProfile}
        </button>
        {monitorMessage ? <p className="form-message">{monitorMessage}</p> : null}
        {profileRefreshMessage ? <p className="form-message">{profileRefreshMessage}</p> : null}
      </div>

      <div className="card participation-monitor-card">
        <div className="card-title-row">
          <h2 data-ko={i18n.ko.profileSettingsTitle} data-ja={i18n.ja.profileSettingsTitle}>{t.profileSettingsTitle}</h2>
          <button className="secondary compact-button" disabled={skinOptionsLoading} onClick={() => void loadSkinOptions()} type="button">
            {t.reloadProfileSettings}
          </button>
        </div>
        <div className="profile-skin-summary">
          <div className="queue-champion-card">
            <span data-ko={i18n.ko.championSkinOverrides} data-ja={i18n.ja.championSkinOverrides}>{t.championSkinOverrides}</span>
            {championArtUrl(skinOptions?.champion) ? <img src={championArtUrl(skinOptions?.champion)} alt="" /> : null}
            <strong>{championDisplayName(skinOptions?.champion)}</strong>
          </div>
          <p className="muted" data-ko={i18n.ko.championSkinOverridesHelp} data-ja={i18n.ja.championSkinOverridesHelp}>{t.championSkinOverridesHelp}</p>
        </div>
        {skinOptions?.status === "ready" && skinOptions.skins.length > 0 ? (
          <div className="skin-option-grid">
            {skinOptions.skins.map((skin) => {
              const selected = skinOptions.selectedSkinNum === skin.skinNum;
              return (
                <button
                  className={selected ? "skin-option selected" : "skin-option"}
                  disabled={profileSettingsSaving}
                  key={skin.skinNum}
                  onClick={() => void saveProfileSkin(skin)}
                  type="button"
                >
                  <img src={skin.splashUrl} alt="" />
                  <span>{skinDisplayName(skin)}</span>
                  {selected ? <strong>{t.selectedSkin}</strong> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        {profileSettingsMessage ? <p className="form-message">{profileSettingsMessage}</p> : null}
      </div>
    </>
  );
}
