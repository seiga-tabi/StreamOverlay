import { useEffect, useState, type ChangeEvent } from "react";
import { apiBase, apiGet, apiPost, apiPostForm } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";
import { Button } from "../shared/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../shared/ui/Card";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../shared/ui/EmptyState";
import { FormControl, FormField, FormHint, FormLabel, Input } from "../shared/ui/Form";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Badge, StatusPill } from "../shared/ui/Status";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../shared/ui/Toast";

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
    close: "닫기",
    current: "현재 GIF",
    configured: "설정됨",
    loading: "알림 GIF 설정을 불러오는 중입니다.",
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
    close: "閉じる",
    current: "現在の GIF",
    configured: "設定済み",
    loading: "通知 GIF 設定を読み込んでいます。",
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

const t = createDashboardLocaleProxy(i18n);

function alertEvents(): Array<{ key: AlertOverlayKey; label: string; description: string; mediaAlt: string }> {
  return [
    { key: "follow", ...t.events.follow },
    { key: "subscription", ...t.events.subscription },
    { key: "cheer", ...t.events.cheer }
  ];
}

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
  const [loading, setLoading] = useState(true);

  function applyResponse(response: AlertConfigResponse): void {
    setConfig(response.config);
    setAssets(response.assets ?? []);
  }

  async function refresh(): Promise<void> {
    setBusyKey("reload");
    setLoading(true);
    setError("");
    try {
      applyResponse(await apiGet<AlertConfigResponse>("/api/alerts/config"));
    } catch {
      setError(t.loadFailed);
    } finally {
      setLoading(false);
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
    <>
      <Card as="section" className="overlay-studio-card overlay-studio-alert-panel" padding="lg" variant="glass">
        <CardHeader className="overlay-studio-card-header">
          <div>
            <CardTitle as="h2">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Button loading={busyKey === "reload"} onClick={() => void refresh()} size="sm" variant="secondary">
            {t.reload}
          </Button>
        </CardHeader>
        <CardContent className="overlay-studio-alert-content">
          <StatusPill tone="warning">{t.fileHint}</StatusPill>

          {loading ? (
            <SkeletonCard loadingLabel={t.loading} size="md">
              <SkeletonText lines={4} size="md" />
            </SkeletonCard>
          ) : null}

          <div className="overlay-studio-alert-list">
            {alertEvents().map((item) => {
              const preset = config[item.key];
              const mediaUrl = preset?.mediaUrl ?? "";
              const selectedFile = selectedFiles[item.key];
              const busy = busyKey === item.key;
              return (
                <Card as="article" className="overlay-studio-alert-row" key={item.key} padding="md" variant="elevated">
                  <div className="overlay-studio-alert-info">
                    <strong>{item.label}</strong>
                    <p>{item.description}</p>
                    <Badge tone={mediaUrl ? "success" : "neutral"}>{mediaUrl ? t.configured : t.none}</Badge>
                  </div>
                  <div className="alert-preview overlay-studio-alert-preview">
                    {mediaUrl ? <img src={absoluteAssetUrl(mediaUrl)} alt={preset?.mediaAlt ?? item.mediaAlt} /> : <span>{t.none}</span>}
                    <small>{t.current}</small>
                  </div>
                  <FormField
                    className="overlay-studio-alert-form"
                    controlId={`overlay-alert-${item.key}-file`}
                    loading={busy}
                  >
                    <FormLabel>{t.chooseFile}</FormLabel>
                    <FormControl>
                      <Input
                        accept="image/gif,.gif"
                        id={`overlay-alert-${item.key}-file`}
                        onChange={(event) => selectFile(item.key, event as ChangeEvent<HTMLInputElement>)}
                        type="file"
                      />
                    </FormControl>
                    <FormHint>{selectedFile ? selectedFile.name : t.fileHint}</FormHint>
                    <div className="overlay-studio-action-row">
                      <Button loading={busy} onClick={() => void uploadGif(item.key, item.mediaAlt)} variant="primary">
                        {busy ? t.uploading : t.upload}
                      </Button>
                      <Button disabled={busy || !mediaUrl} onClick={() => void clearGif(item.key)} variant="danger">
                        {t.clear}
                      </Button>
                    </div>
                  </FormField>
                </Card>
              );
            })}
          </div>

          <Card as="section" className="overlay-studio-asset-library" padding="md" variant="default">
            <CardHeader className="overlay-studio-card-header">
              <CardTitle as="h3">{t.availableAssets}</CardTitle>
              <Badge tone={assets.length > 0 ? "success" : "neutral"}>{assets.length}</Badge>
            </CardHeader>
            <CardContent>
              {assets.length === 0 ? (
                <EmptyState className="overlay-studio-empty" variant="streamer">
                  <EmptyStateIcon>GIF</EmptyStateIcon>
                  <EmptyStateTitle as="h3">{t.noAssets}</EmptyStateTitle>
                  <EmptyStateDescription>{t.description}</EmptyStateDescription>
                </EmptyState>
              ) : null}
              <div className="overlay-studio-asset-list">
                {assets.map((asset) => (
                  <Card as="article" className="overlay-studio-asset-row" key={asset.fileName} padding="sm" variant="elevated">
                    <img src={absoluteAssetUrl(asset.url)} alt={asset.fileName} />
                    <div>
                      <strong>{asset.fileName}</strong>
                      <p>{asset.size} {t.bytes} · {formatDate(asset.updatedAt)}</p>
                    </div>
                    <code>{asset.url}</code>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <ToastProvider position="bottom-right">
        <ToastViewport className="overlay-studio-toast-viewport">
          {message || error ? (
            <Toast
              autoDismiss
              onOpenChange={(open) => {
                if (!open) {
                  setMessage("");
                  setError("");
                }
              }}
              tone={error ? "danger" : "success"}
            >
              <ToastTitle>{error ? t.saveFailed : t.saved}</ToastTitle>
              <ToastDescription>{error || message}</ToastDescription>
              <ToastCloseButton aria-label={t.close}>×</ToastCloseButton>
            </Toast>
          ) : null}
        </ToastViewport>
      </ToastProvider>
    </>
  );
}
