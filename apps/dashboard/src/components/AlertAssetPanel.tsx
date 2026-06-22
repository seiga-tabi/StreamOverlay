import { useEffect, useState, type ChangeEvent } from "react";
import { apiBase, apiGet, apiPost, apiPostForm } from "../api/client";

type AlertOverlayKey = "follow" | "cheer" | "subscription";

type AlertOverlayPreset = {
  mediaUrl?: string;
  mediaAlt?: string;
};

type AlertOverlayConfig = {
  defaults?: AlertOverlayPreset;
} & Partial<Record<string, AlertOverlayPreset>>;

type AlertGifAsset = {
  fileName: string;
  url: string;
  size: number;
  updatedAt: string;
};

type AlertConfigResponse = {
  keys: string[];
  config: AlertOverlayConfig;
  assets: AlertGifAsset[];
};

type UploadResponse = {
  fileName: string;
  url: string;
  size: number;
};

const i18n = {
  ko: {
    title: "알림 GIF 등록",
    description: "팔로우, 정기구독, 후원(Bits/Cheer) 알림에 표시할 GIF를 업로드하고 연결합니다.",
    fileHint: "GIF 파일만 등록할 수 있으며 서버에서 5MB 이하로 다시 검증합니다.",
    reload: "새로고침",
    chooseFile: "GIF 선택",
    upload: "등록",
    uploading: "등록 중",
    clear: "해제",
    current: "현재 GIF",
    none: "등록된 GIF 없음",
    noFile: "등록할 GIF 파일을 먼저 선택해주세요.",
    saved: "GIF 설정을 저장했습니다.",
    cleared: "GIF 설정을 해제했습니다.",
    loadFailed: "알림 GIF 설정 조회에 실패했습니다.",
    saveFailed: "알림 GIF 설정 저장에 실패했습니다.",
    availableAssets: "업로드된 GIF",
    noAssets: "업로드된 GIF가 없습니다.",
    bytes: "bytes",
    events: {
      follow: {
        label: "팔로우",
        description: "새 팔로워 알림 배너에 표시합니다.",
        mediaAlt: "follow alert"
      },
      subscription: {
        label: "정기구독",
        description: "신규 구독 알림 배너에 표시합니다.",
        mediaAlt: "subscription alert"
      },
      cheer: {
        label: "후원(Bits)",
        description: "Bits/Cheer 후원 알림 배너에 표시합니다.",
        mediaAlt: "bits alert"
      }
    }
  },
  ja: {
    title: "通知 GIF 登録",
    description: "フォロー、サブスク、支援(Bits/Cheer)通知に表示する GIF をアップロードして紐づけます。",
    fileHint: "GIF ファイルのみ登録できます。サーバー側でも 5MB 以下か再検証します。",
    reload: "再読み込み",
    chooseFile: "GIF 選択",
    upload: "登録",
    uploading: "登録中",
    clear: "解除",
    current: "現在の GIF",
    none: "登録された GIF はありません",
    noFile: "登録する GIF ファイルを先に選択してください。",
    saved: "GIF 設定を保存しました。",
    cleared: "GIF 設定を解除しました。",
    loadFailed: "通知 GIF 設定の取得に失敗しました。",
    saveFailed: "通知 GIF 設定の保存に失敗しました。",
    availableAssets: "アップロード済み GIF",
    noAssets: "アップロードされた GIF はありません。",
    bytes: "bytes",
    events: {
      follow: {
        label: "フォロー",
        description: "新規フォロワー通知バナーに表示します。",
        mediaAlt: "follow alert"
      },
      subscription: {
        label: "サブスク",
        description: "新規サブスク通知バナーに表示します。",
        mediaAlt: "subscription alert"
      },
      cheer: {
        label: "支援(Bits)",
        description: "Bits/Cheer 支援通知バナーに表示します。",
        mediaAlt: "bits alert"
      }
    }
  }
} as const;

const t = i18n.ko;

const alertEvents: Array<{ key: AlertOverlayKey; label: string; description: string; mediaAlt: string }> = [
  { key: "follow", ...t.events.follow },
  { key: "subscription", ...t.events.subscription },
  { key: "cheer", ...t.events.cheer }
];

function absoluteAssetUrl(pathname: string | undefined): string {
  return pathname ? `${apiBase}${pathname}` : "";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export function AlertAssetPanel() {
  const [config, setConfig] = useState<AlertOverlayConfig>({});
  const [assets, setAssets] = useState<AlertGifAsset[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<AlertOverlayKey, File>>>({});
  const [busyKey, setBusyKey] = useState<AlertOverlayKey | "reload" | undefined>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applyResponse(response: AlertConfigResponse): void {
    setConfig(response.config);
    setAssets(response.assets ?? []);
  }

  async function refresh(): Promise<void> {
    setBusyKey("reload");
    setError("");
    try {
      applyResponse(await apiGet<AlertConfigResponse>("/api/alerts/config"));
    } catch {
      setError(t.loadFailed);
    } finally {
      setBusyKey(undefined);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function selectFile(key: AlertOverlayKey, event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    setSelectedFiles((current) => ({ ...current, [key]: file }));
    setMessage("");
    setError("");
  }

  async function uploadGif(key: AlertOverlayKey, mediaAlt: string): Promise<void> {
    const file = selectedFiles[key];
    if (!file) {
      setError(t.noFile);
      return;
    }
    setBusyKey(key);
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.append("eventType", key);
      form.append("file", file);
      const uploaded = await apiPostForm<UploadResponse>("/api/alerts/assets", form);
      const response = await apiPost<AlertConfigResponse>("/api/alerts/config", {
        eventType: key,
        mediaUrl: uploaded.url,
        mediaAlt
      });
      applyResponse(response);
      setSelectedFiles((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMessage(t.saved);
    } catch {
      setError(t.saveFailed);
    } finally {
      setBusyKey(undefined);
    }
  }

  async function clearGif(key: AlertOverlayKey): Promise<void> {
    setBusyKey(key);
    setMessage("");
    setError("");
    try {
      const response = await apiPost<AlertConfigResponse>("/api/alerts/config", {
        eventType: key,
        mediaUrl: "",
        mediaAlt: ""
      });
      applyResponse(response);
      setMessage(t.cleared);
    } catch {
      setError(t.saveFailed);
    } finally {
      setBusyKey(undefined);
    }
  }

  return (
    <div className="card alert-asset-panel">
      <div className="card-title-row">
        <div>
          <h2>{t.title}</h2>
          <p className="muted">{t.description}</p>
        </div>
        <button className="secondary compact-button" type="button" onClick={() => void refresh()} disabled={busyKey === "reload"}>{t.reload}</button>
      </div>
      <p className="scope-warning compact-warning">{t.fileHint}</p>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="alert-asset-list">
        {alertEvents.map((item) => {
          const preset = config[item.key];
          const mediaUrl = preset?.mediaUrl ?? "";
          const selectedFile = selectedFiles[item.key];
          const busy = busyKey === item.key;
          return (
            <div className="alert-asset-row" key={item.key}>
              <div className="alert-asset-info">
                <strong>{item.label}</strong>
                <p className="muted">{item.description}</p>
              </div>
              <div className="alert-preview">
                {mediaUrl ? <img src={absoluteAssetUrl(mediaUrl)} alt={preset?.mediaAlt ?? item.mediaAlt} /> : <span>{t.none}</span>}
                <small className="muted">{t.current}</small>
              </div>
              <div className="alert-upload-controls">
                <label className="field">
                  {t.chooseFile}
                  <input type="file" accept="image/gif,.gif" onChange={(event) => selectFile(item.key, event)} />
                </label>
                {selectedFile ? <span className="selected-file-name">{selectedFile.name}</span> : null}
                <div className="button-row inline-buttons">
                  <button type="button" onClick={() => void uploadGif(item.key, item.mediaAlt)} disabled={busy}>
                    {busy ? t.uploading : t.upload}
                  </button>
                  <button className="secondary" type="button" onClick={() => void clearGif(item.key)} disabled={busy || !mediaUrl}>
                    {t.clear}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="asset-library">
        <div className="card-title-row">
          <h3>{t.availableAssets}</h3>
          <span className="count-badge">{assets.length}</span>
        </div>
        {assets.length === 0 ? <p className="muted empty-state">{t.noAssets}</p> : null}
        {assets.map((asset) => (
          <div className="asset-library-row" key={asset.fileName}>
            <img src={absoluteAssetUrl(asset.url)} alt={asset.fileName} />
            <div>
              <strong>{asset.fileName}</strong>
              <p className="muted">{asset.size} {t.bytes} · {formatDate(asset.updatedAt)}</p>
            </div>
            <code>{asset.url}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
