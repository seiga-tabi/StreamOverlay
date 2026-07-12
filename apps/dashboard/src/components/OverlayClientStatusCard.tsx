import { useEffect, useMemo, useState } from "react";
import type { OverlayChannel, OverlayStatus } from "@streamops/shared";
import type { DashboardStreamerInfo } from "../api/client";
import { apiGet } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";
import { runtimeConfig } from "../runtime-config";
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
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../shared/ui/Modal";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill } from "../shared/ui/Status";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../shared/ui/Toast";

const OVERLAY_BASE = runtimeConfig().overlayBase ?? import.meta.env.VITE_OVERLAY_BASE ?? "http://localhost:5174";
const DASHBOARD_OVERLAY_CHANNELS = ["events", "chat", "participation", "solo-rank"] as const;

const i18n = {
  ko: {
    title: "Overlay 클라이언트",
    description: "OBS Browser Source로 연결된 overlay client와 최근 메시지를 확인합니다.",
    copy: "복사",
    copied: "복사했습니다.",
    close: "닫기",
    connected: "연결됨",
    disconnected: "미연결",
    details: "OBS Source URL 확인",
    detailsDescription: "이 URL을 OBS Browser Source의 URL 필드에 그대로 붙여넣습니다.",
    loading: "Overlay 상태를 불러오는 중입니다.",
    open: "열기",
    previewTitle: "Overlay 미리보기",
    previewDescription: "실제 OBS Source와 같은 overlay URL을 mock 데이터로 렌더링합니다.",
    refreshPreview: "미리보기 새로고침",
    previewFrameTitle: "Overlay 미리보기",
    streamerOverlay: "스트리머 전용 오버레이",
    streamerOverlayDescription: "승인된 스트리머 key가 포함된 OBS Browser Source URL입니다. key는 외부에 공개하지 마세요.",
    streamerSlug: "URL 닉네임",
    streamerKey: "스트리머 key",
    tokenMissing: "Token 없음",
    tokenReady: "Token 준비됨",
    clients: "연결 client",
    totalClients: "전체 연결",
    sourceUrl: "Source URL",
    recent: "최근 overlay 메시지",
    empty: "최근 overlay 메시지가 없습니다.",
    obsGuide: "OBS Browser Source 설정",
    guideItems: [
      "Source URL에는 필요한 mode URL을 사용하세요.",
      "권장 해상도는 1920 x 1080입니다.",
      "배경은 투명하게 렌더링되므로 OBS에서 별도 chroma key를 쓰지 않아도 됩니다."
    ],
    modes: {
      events: "이벤트",
      chat: "채팅",
      participation: "시참",
      "solo-rank": "솔로랭크 전적"
    }
  },
  ja: {
    title: "Overlay クライアント",
    description: "OBS Browser Source として接続された overlay client と最近のメッセージを確認します。",
    copy: "コピー",
    copied: "コピーしました。",
    close: "閉じる",
    connected: "接続中",
    disconnected: "未接続",
    details: "OBS Source URL 確認",
    detailsDescription: "この URL を OBS Browser Source の URL 欄にそのまま貼り付けます。",
    loading: "Overlay 状態を読み込んでいます。",
    open: "開く",
    previewTitle: "Overlay プレビュー",
    previewDescription: "実際の OBS Source と同じ overlay URL を mock データで描画します。",
    refreshPreview: "プレビュー更新",
    previewFrameTitle: "Overlay プレビュー",
    streamerOverlay: "配信者専用オーバーレイ",
    streamerOverlayDescription: "承認済み配信者 key を含む OBS Browser Source URL です。key は外部に公開しないでください。",
    streamerSlug: "URL ニックネーム",
    streamerKey: "配信者 key",
    tokenMissing: "Token なし",
    tokenReady: "Token 準備済み",
    clients: "接続 client",
    totalClients: "全体接続",
    sourceUrl: "Source URL",
    recent: "最近の overlay メッセージ",
    empty: "最近の overlay メッセージはありません。",
    obsGuide: "OBS Browser Source 設定",
    guideItems: [
      "Source URL には必要な mode URL を使用してください。",
      "推奨解像度は 1920 x 1080 です。",
      "背景は透明に描画されるため OBS で chroma key は不要です。"
    ],
    modes: {
      events: "イベント",
      chat: "チャット",
      participation: "参加",
      "solo-rank": "ソロランク戦績"
    }
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

function overlayUrl(mode: OverlayChannel, params: Record<string, string> = {}, streamer?: DashboardStreamerInfo): string {
  const base = OVERLAY_BASE.endsWith("/") ? OVERLAY_BASE : `${OVERLAY_BASE}/`;
  try {
    const url = new URL(base, window.location.href);
    if (streamer?.overlaySlug) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}/${encodeURIComponent(streamer.overlaySlug)}`;
    }
    url.searchParams.set("mode", mode);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (streamer?.overlayKey && !params.mock) {
      url.hash = new URLSearchParams({ token: streamer.overlayKey }).toString();
    }
    return url.toString();
  } catch {
    const search = new URLSearchParams({ mode, ...params });
    const path = streamer?.overlaySlug ? `${base}${encodeURIComponent(streamer.overlaySlug)}` : base;
    const hash = streamer?.overlayKey && !params.mock ? `#${new URLSearchParams({ token: streamer.overlayKey }).toString()}` : "";
    return `${path}?${search.toString()}${hash}`;
  }
}

function modeUrl(mode: OverlayChannel, streamer?: DashboardStreamerInfo): string {
  return overlayUrl(mode, {}, streamer);
}

function previewUrl(mode: OverlayChannel, nonce: number, streamer?: DashboardStreamerInfo): string {
  return overlayUrl(mode, { mock: "1", preview: "1", reload: "0", nonce: String(nonce) }, streamer);
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

type OverlaySourceDetail = {
  title: string;
  url: string;
  clients: number;
};

export function OverlayClientStatusCard({ streamer }: { streamer?: DashboardStreamerInfo }) {
  const [status, setStatus] = useState<OverlayStatus>();
  const [previewNonce, setPreviewNonce] = useState(0);
  const [sourceDetail, setSourceDetail] = useState<OverlaySourceDetail | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const modes = useMemo(() => DASHBOARD_OVERLAY_CHANNELS, []);

  async function loadStatus() {
    setStatus(await apiGet<OverlayStatus>("/api/overlay/status"));
  }

  useEffect(() => {
    void loadStatus().catch(() => undefined);
    const timer = window.setInterval(() => void loadStatus().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function copyOverlayUrl(value: string): Promise<void> {
    await copyText(value);
    setToastMessage(t.copied);
  }

  return (
    <>
      <Card as="section" className="overlay-studio-card overlay-studio-manager" padding="lg" variant="glass">
        <CardHeader className="overlay-studio-card-header">
          <div>
            <CardTitle as="h2">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Badge size="lg" tone={(status?.clientCount ?? 0) > 0 ? "success" : "neutral"}>
            {status?.clientCount ?? 0}
          </Badge>
        </CardHeader>

        <CardContent className="overlay-studio-content">
          <div className="overlay-studio-metrics">
            <Metric
              label={t.totalClients}
              value={status?.clientCount ?? 0}
              tone={(status?.clientCount ?? 0) > 0 ? "success" : "neutral"}
              status={
                <StatusPill size="sm" tone={(status?.clientCount ?? 0) > 0 ? "success" : "warning"}>
                  {(status?.clientCount ?? 0) > 0 ? t.connected : t.disconnected}
                </StatusPill>
              }
            />
            <Metric
              label={t.streamerSlug}
              value={streamer?.overlaySlug ?? "-"}
              tone={streamer?.overlaySlug ? "streamer" : "warning"}
              status={
                <StatusPill size="sm" tone={streamer?.overlayKey ? "success" : "warning"}>
                  {streamer?.overlayKey ? t.tokenReady : t.tokenMissing}
                </StatusPill>
              }
            />
          </div>

          {streamer?.overlaySlug && streamer.overlayKey ? (
            <Card as="section" className="overlay-studio-access" padding="md" variant="elevated">
              <strong>{t.streamerOverlay}</strong>
              <p>{t.streamerOverlayDescription}</p>
              <div className="overlay-access-grid">
                <span>{t.streamerSlug}</span>
                <code>{streamer.overlaySlug}</code>
                <span>{t.streamerKey}</span>
                <code>{streamer.overlayKey}</code>
              </div>
            </Card>
          ) : null}

          <section className="overlay-studio-source-list" aria-label={t.sourceUrl}>
            {!status ? (
              <SkeletonCard className="overlay-studio-source-skeleton" loadingLabel={t.loading} size="md">
                <SkeletonText lines={4} size="md" />
              </SkeletonCard>
            ) : null}
            {modes.map((mode) => {
              const url = modeUrl(mode, streamer);
              const clients = status?.clientsByChannel[mode] ?? 0;
              return (
                <Card as="article" className="overlay-studio-source-row" key={mode} padding="md" variant="elevated">
                  <div>
                    <strong>{t.modes[mode]}</strong>
                    <code>{url}</code>
                  </div>
                  <StatusPill size="sm" tone={clients > 0 ? "success" : "neutral"}>
                    {clients > 0 ? t.connected : t.disconnected}
                  </StatusPill>
                  <Button
                    onClick={() => setSourceDetail({ clients, title: t.modes[mode], url })}
                    size="sm"
                    variant="secondary"
                  >
                    {t.details}
                  </Button>
                  <Button onClick={() => void copyOverlayUrl(url)} size="sm" variant="primary">
                    {t.copy}
                  </Button>
                </Card>
              );
            })}
          </section>

      <Card as="aside" className="overlay-studio-obs-guide" padding="md" variant="default">
        <strong>{t.obsGuide}</strong>
        <ul>{t.guideItems.map((item) => <li key={item}>{item}</li>)}</ul>
      </Card>

      <section className="overlay-studio-preview-section" aria-label={t.previewTitle}>
        <div className="overlay-studio-section-title">
          <div>
            <h3>{t.previewTitle}</h3>
            <p>{t.previewDescription}</p>
          </div>
          <Button onClick={() => setPreviewNonce((value) => value + 1)} size="sm" variant="secondary">
            {t.refreshPreview}
          </Button>
        </div>
        <div className="overlay-studio-preview-grid">
          {modes.map((mode) => (
            <Card as="article" className="overlay-studio-preview-tile" key={mode} padding="md" variant="elevated">
              <CardHeader className="overlay-studio-preview-head">
                <CardTitle as="h3">{t.modes[mode]}</CardTitle>
                <Button as="a" href={modeUrl(mode, streamer)} rel="noreferrer" size="sm" target="_blank" variant="ghost">
                  {t.open}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overlay-preview-frame overlay-studio-preview-frame">
                <iframe
                  key={`${mode}-${previewNonce}`}
                  title={`${t.previewFrameTitle}: ${t.modes[mode]}`}
                  src={previewUrl(mode, previewNonce, streamer)}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin"
                  referrerPolicy="no-referrer"
                />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="overlay-studio-recent" aria-label={t.recent}>
        <div className="overlay-studio-section-title">
          <div>
            <h3>{t.recent}</h3>
          </div>
          <Badge tone="info">{status?.recentMessages.length ?? 0}</Badge>
        </div>
        {status?.recentMessages.length ? status.recentMessages.slice(0, 20).map((message) => (
          <Card as="article" className="overlay-studio-message-row" key={message.id} padding="sm" variant="default">
            <span>
              <strong>{message.type}</strong>
              <small className="muted">{message.messagePreview ?? message.source ?? message.channel}</small>
            </span>
            <StatusPill size="sm" tone="neutral">{message.channel}</StatusPill>
          </Card>
        )) : (
          <EmptyState className="overlay-studio-empty" variant="streamer">
            <EmptyStateIcon>OBS</EmptyStateIcon>
            <EmptyStateTitle as="h3">{t.empty}</EmptyStateTitle>
            <EmptyStateDescription>{t.description}</EmptyStateDescription>
          </EmptyState>
        )}
      </section>
        </CardContent>
      </Card>

      <Modal
        closeOnBackdrop
        onOpenChange={(open) => {
          if (!open) setSourceDetail(null);
        }}
        open={Boolean(sourceDetail)}
        size="lg"
      >
        <ModalHeader>
          <ModalTitle>{sourceDetail?.title ?? t.details}</ModalTitle>
          <ModalDescription>{t.detailsDescription}</ModalDescription>
        </ModalHeader>
        {sourceDetail ? (
          <ModalContent>
            <div className="overlay-studio-modal-content">
              <StatusPill tone={sourceDetail.clients > 0 ? "success" : "neutral"}>
                {sourceDetail.clients > 0 ? t.connected : t.disconnected}
              </StatusPill>
              <code>{sourceDetail.url}</code>
            </div>
          </ModalContent>
        ) : null}
        <ModalFooter>
          {sourceDetail ? (
            <Button onClick={() => void copyOverlayUrl(sourceDetail.url)} variant="primary">
              {t.copy}
            </Button>
          ) : null}
          <ModalCloseButton aria-label={t.close}>{t.close}</ModalCloseButton>
        </ModalFooter>
      </Modal>

      <ToastProvider position="bottom-right">
        <ToastViewport className="overlay-studio-toast-viewport">
          {toastMessage ? (
            <Toast
              autoDismiss
              onOpenChange={(open) => {
                if (!open) setToastMessage("");
              }}
              tone="success"
            >
              <ToastTitle>{t.copied}</ToastTitle>
              <ToastDescription>{toastMessage}</ToastDescription>
              <ToastCloseButton aria-label={t.close}>×</ToastCloseButton>
            </Toast>
          ) : null}
        </ToastViewport>
      </ToastProvider>
    </>
  );
}
