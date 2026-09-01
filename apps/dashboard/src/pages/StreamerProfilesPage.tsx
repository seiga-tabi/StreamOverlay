import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut, DashboardApiError } from "../api/client";
import { AdminConfirmDialog } from "../components/AdminConfirmDialog";
import { createDashboardLocaleProxy } from "../i18n";

type Platform = "twitch" | "chzzk" | "youtube";
type Game = "lol" | "valorant" | "palworld" | "minecraft";

type OfficialProfile = {
  id: string;
  streamerName: string;
  platform: Platform;
  channelUrl: string;
  games: readonly Game[];
  riotId?: string;
  officialProfile: { handle: string; seoSlug: string; liveStatusSupported: boolean };
  active: boolean;
};

const PLATFORMS: readonly Platform[] = ["twitch", "chzzk", "youtube"];
const GAMES: readonly Game[] = ["lol", "valorant", "palworld", "minecraft"];

const i18n = {
  ko: {
    title: "스트리머 공식 프로필",
    description: "검색에 노출할 공식 프로필을 등록하고 고정 URL과 활성 상태를 관리합니다.",
    name: "스트리머 이름",
    handle: "플랫폼 핸들",
    platform: "플랫폼",
    games: "주력 게임",
    riotId: "Riot ID (LoL, 선택)",
    riotIdPlaceholder: "게임명#KR1",
    create: "공식 프로필 등록",
    update: "변경 저장",
    cancelEdit: "편집 취소",
    edit: "편집",
    deactivate: "비활성화",
    inactive: "비활성",
    active: "활성",
    officialUrl: "공식 URL",
    liveEnabled: "Twitch 라이브 상태 사용",
    staticOnly: "정적 프로필",
    empty: "등록된 공식 프로필이 없습니다.",
    loading: "공식 프로필을 불러오는 중입니다.",
    loadFailed: "공식 프로필을 불러오지 못했습니다.",
    saveFailed: "공식 프로필을 저장하지 못했습니다.",
    duplicate: "이미 등록된 채널 또는 공식 URL입니다.",
    saved: "공식 프로필을 저장했습니다.",
    deactivated: "공식 프로필을 비활성화했습니다.",
    deactivateFailed: "공식 프로필을 비활성화하지 못했습니다.",
    confirmTitle: "공식 프로필 비활성화",
    confirmBody: "공개 페이지와 목록에서 즉시 숨겨집니다. 고정 URL은 다른 프로필에 재사용되지 않습니다.",
    confirm: "비활성화합니다",
    cancel: "취소",
    required: "이름·핸들·게임을 모두 입력해 주세요."
  },
  ja: {
    title: "配信者公式プロフィール",
    description: "検索に表示する公式プロフィールを登録し、固定URLと公開状態を管理します。",
    name: "配信者名",
    handle: "プラットフォームハンドル",
    platform: "プラットフォーム",
    games: "主なゲーム",
    riotId: "Riot ID（LoL、任意）",
    riotIdPlaceholder: "ゲーム名#KR1",
    create: "公式プロフィールを登録",
    update: "変更を保存",
    cancelEdit: "編集をキャンセル",
    edit: "編集",
    deactivate: "無効化",
    inactive: "無効",
    active: "有効",
    officialUrl: "公式URL",
    liveEnabled: "Twitchライブ状態を使用",
    staticOnly: "静的プロフィール",
    empty: "登録済みの公式プロフィールはありません。",
    loading: "公式プロフィールを読み込んでいます。",
    loadFailed: "公式プロフィールを読み込めませんでした。",
    saveFailed: "公式プロフィールを保存できませんでした。",
    duplicate: "同じチャンネルまたは公式URLがすでに登録されています。",
    saved: "公式プロフィールを保存しました。",
    deactivated: "公式プロフィールを無効化しました。",
    deactivateFailed: "公式プロフィールを無効化できませんでした。",
    confirmTitle: "公式プロフィールを無効化",
    confirmBody: "公開ページと一覧から直ちに非表示になります。固定URLは別のプロフィールには再利用されません。",
    confirm: "無効化します",
    cancel: "キャンセル",
    required: "名前・ハンドル・ゲームをすべて入力してください。"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

function isProfile(value: unknown): value is OfficialProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const official = row.officialProfile;
  return typeof row.id === "string"
    && typeof row.streamerName === "string"
    && PLATFORMS.includes(row.platform as Platform)
    && typeof row.channelUrl === "string"
    && Array.isArray(row.games)
    && (row.riotId === undefined || typeof row.riotId === "string")
    && typeof row.active === "boolean"
    && typeof official === "object" && official !== null
    && typeof (official as Record<string, unknown>).handle === "string"
    && typeof (official as Record<string, unknown>).seoSlug === "string"
    && typeof (official as Record<string, unknown>).liveStatusSupported === "boolean";
}

function profilesFrom(value: unknown): OfficialProfile[] | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const rows = (value as Record<string, unknown>).profiles;
  return Array.isArray(rows) ? rows.filter(isProfile) : undefined;
}

export function StreamerProfilesPage() {
  const [profiles, setProfiles] = useState<OfficialProfile[]>([]);
  const [streamerName, setStreamerName] = useState("");
  const [platform, setPlatform] = useState<Platform>("twitch");
  const [handle, setHandle] = useState("");
  const [games, setGames] = useState<Game[]>(["lol"]);
  const [riotId, setRiotId] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [deactivateTarget, setDeactivateTarget] = useState<OfficialProfile>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.active), [profiles]);

  async function load() {
    setLoading(true);
    try {
      const result = profilesFrom(await apiGet<unknown>("/api/dashboard/streamer-profiles"));
      if (!result) throw new Error("invalid response");
      setProfiles(result);
    } catch {
      setMessage(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function resetForm() {
    setEditingId(undefined);
    setStreamerName("");
    setPlatform("twitch");
    setHandle("");
    setGames(["lol"]);
    setRiotId("");
  }

  function edit(profile: OfficialProfile) {
    setEditingId(profile.id);
    setStreamerName(profile.streamerName);
    setPlatform(profile.platform);
    setHandle(profile.officialProfile.handle);
    setGames([...profile.games]);
    setRiotId(profile.riotId ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!streamerName.trim() || !handle.trim() || games.length === 0) {
      setMessage(t.required);
      return;
    }
    setBusy(true);
    setMessage("");
    const body = { streamerName, platform, handle, games, riotId: riotId.trim() || undefined };
    try {
      if (editingId) await apiPut(`/api/dashboard/streamer-profiles/${editingId}`, body);
      else await apiPost("/api/dashboard/streamer-profiles", body);
      resetForm();
      setMessage(t.saved);
      await load();
    } catch (error) {
      setMessage(error instanceof DashboardApiError && error.status === 409 ? t.duplicate : t.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!deactivateTarget) return;
    setBusy(true);
    setMessage("");
    try {
      await apiDelete(`/api/dashboard/streamer-profiles/${deactivateTarget.id}`);
      setDeactivateTarget(undefined);
      if (editingId === deactivateTarget.id) resetForm();
      setMessage(t.deactivated);
      await load();
    } catch {
      setMessage(t.deactivateFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="streamer-profiles-admin">
      <header className="page-heading">
        <div><h1>{t.title}</h1><p>{t.description}</p></div>
        <strong>{activeProfiles.length}</strong>
      </header>

      <section className="streamer-profile-admin-form">
        <label>{t.name}<input maxLength={60} onChange={(event) => setStreamerName(event.target.value)} value={streamerName} /></label>
        <label>{t.platform}<select onChange={(event) => setPlatform(event.target.value as Platform)} value={platform}>{PLATFORMS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>{t.handle}<input maxLength={80} onChange={(event) => setHandle(event.target.value)} value={handle} /></label>
        {games.includes("lol") ? <label>{t.riotId}<input maxLength={60} onChange={(event) => setRiotId(event.target.value)} placeholder={t.riotIdPlaceholder} value={riotId} /></label> : null}
        <fieldset><legend>{t.games}</legend><div>{GAMES.map((game) => <label key={game}><input checked={games.includes(game)} onChange={(event) => setGames((current) => event.target.checked ? [...new Set([...current, game])] : current.filter((item) => item !== game))} type="checkbox" />{game}</label>)}</div></fieldset>
        <div className="streamer-profile-admin-form__actions"><button disabled={busy} onClick={() => void save()} type="button">{editingId ? t.update : t.create}</button>{editingId ? <button data-secondary="true" disabled={busy} onClick={resetForm} type="button">{t.cancelEdit}</button> : null}</div>
      </section>

      {message ? <p className="form-message" role="status">{message}</p> : null}
      {loading ? <p className="form-message">{t.loading}</p> : null}
      {!loading && profiles.length === 0 ? <p className="form-message">{t.empty}</p> : null}
      <div className="streamer-profile-admin-list">
        {profiles.map((profile) => (
          <article className={`streamer-profile-admin-card${profile.active ? "" : " is-inactive"}`} key={profile.id}>
            <div><span>{profile.platform}</span><strong>{profile.streamerName}</strong><small>@{profile.officialProfile.handle}</small></div>
            <div><span>{t.officialUrl}</span><a href={`/streamers/${profile.platform}/${encodeURIComponent(profile.officialProfile.seoSlug)}`} rel="noreferrer" target="_blank">{`/streamers/${profile.platform}/${profile.officialProfile.seoSlug}`}</a></div>
            <div className="streamer-profile-admin-card__tags">{profile.games.map((game) => <span key={game}>{game}</span>)}{profile.riotId ? <span>{profile.riotId}</span> : null}<span>{profile.officialProfile.liveStatusSupported ? t.liveEnabled : t.staticOnly}</span><b>{profile.active ? t.active : t.inactive}</b></div>
            {profile.active ? <div className="streamer-profile-admin-card__actions"><button onClick={() => edit(profile)} type="button">{t.edit}</button><button data-danger="true" onClick={() => setDeactivateTarget(profile)} type="button">{t.deactivate}</button></div> : null}
          </article>
        ))}
      </div>

      {deactivateTarget ? <AdminConfirmDialog busy={busy} cancelLabel={t.cancel} confirmLabel={t.confirm} description={t.confirmBody} onCancel={() => setDeactivateTarget(undefined)} onConfirm={() => void deactivate()} summary={[{ label: t.name, value: deactivateTarget.streamerName }]} title={t.confirmTitle} tone="danger" /> : null}
    </div>
  );
}
