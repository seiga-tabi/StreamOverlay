import { useEffect, useMemo, useState } from "react";
import type { OverlayChannel, OverlayStatus } from "@streamops/shared";
import { OVERLAY_CHANNELS } from "@streamops/shared";
import { apiGet } from "../api/client";
import { runtimeConfig } from "../runtime-config";

const OVERLAY_BASE = runtimeConfig().overlayBase ?? import.meta.env.VITE_OVERLAY_BASE ?? "http://localhost:5174";

const i18n = {
  ko: {
    title: "Overlay 클라이언트",
    description: "OBS Browser Source로 연결된 overlay client와 최근 메시지를 확인합니다.",
    copy: "복사",
    copied: "복사했습니다.",
    open: "열기",
    previewTitle: "Overlay 미리보기",
    previewDescription: "실제 OBS Source와 같은 overlay URL을 mock 데이터로 렌더링합니다.",
    refreshPreview: "미리보기 새로고침",
    previewFrameTitle: "Overlay 미리보기",
    clients: "연결 client",
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
      subtitles: "자막",
      questions: "질문",
      mission: "미션",
      participation: "시참",
      all: "전체"
    }
  },
  ja: {
    title: "Overlay クライアント",
    description: "OBS Browser Source として接続された overlay client と最近のメッセージを確認します。",
    copy: "コピー",
    copied: "コピーしました。",
    open: "開く",
    previewTitle: "Overlay プレビュー",
    previewDescription: "実際の OBS Source と同じ overlay URL を mock データで描画します。",
    refreshPreview: "プレビュー更新",
    previewFrameTitle: "Overlay プレビュー",
    clients: "接続 client",
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
      subtitles: "字幕",
      questions: "質問",
      mission: "ミッション",
      participation: "参加",
      all: "全体"
    }
  }
} as const;

const t = i18n.ko;

function overlayUrl(mode: OverlayChannel, params: Record<string, string> = {}): string {
  const base = OVERLAY_BASE.endsWith("/") ? OVERLAY_BASE : `${OVERLAY_BASE}/`;
  try {
    const url = new URL(base, window.location.href);
    url.searchParams.set("mode", mode);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  } catch {
    const search = new URLSearchParams({ mode, ...params });
    return `${base}?${search.toString()}`;
  }
}

function modeUrl(mode: OverlayChannel): string {
  return overlayUrl(mode);
}

function previewUrl(mode: OverlayChannel, nonce: number): string {
  return overlayUrl(mode, { mock: "1", preview: "1", reload: "0", nonce: String(nonce) });
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
  alert(t.copied);
}

export function OverlayClientStatusCard() {
  const [status, setStatus] = useState<OverlayStatus>();
  const [previewNonce, setPreviewNonce] = useState(0);
  const modes = useMemo(() => OVERLAY_CHANNELS, []);

  async function loadStatus() {
    setStatus(await apiGet<OverlayStatus>("/api/overlay/status"));
  }

  useEffect(() => {
    void loadStatus().catch(() => undefined);
    const timer = window.setInterval(() => void loadStatus().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="card overlay-settings-card">
      <div className="card-title-row">
        <div>
          <h2>{t.title}</h2>
          <p className="muted">{t.description}</p>
        </div>
        <span className="count-badge">{status?.clientCount ?? 0}</span>
      </div>
      <div className="overlay-url-list">
        {modes.map((mode) => {
          const url = modeUrl(mode);
          return (
            <div className="overlay-url-row" key={mode}>
              <div>
                <strong>{t.modes[mode]}</strong>
                <code>{url}</code>
              </div>
              <span className="queue-status neutral">{status?.clientsByChannel[mode] ?? 0}</span>
              <button className="secondary" onClick={() => void copyText(url)}>{t.copy}</button>
            </div>
          );
        })}
      </div>
      <div className="ops-note">
        <strong>{t.obsGuide}</strong>
        <ul>{t.guideItems.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div className="overlay-preview-section">
        <div className="section-title-row">
          <div>
            <h2>{t.previewTitle}</h2>
            <p className="muted">{t.previewDescription}</p>
          </div>
          <button className="secondary compact-button" onClick={() => setPreviewNonce((value) => value + 1)}>{t.refreshPreview}</button>
        </div>
        <div className="overlay-preview-grid">
          {modes.map((mode) => (
            <div className="overlay-preview-tile" key={mode}>
              <div className="overlay-preview-head">
                <strong>{t.modes[mode]}</strong>
                <a className="secondary compact-button" href={modeUrl(mode)} target="_blank" rel="noreferrer">{t.open}</a>
              </div>
              <div className="overlay-preview-frame">
                <iframe
                  key={`${mode}-${previewNonce}`}
                  title={`${t.previewFrameTitle}: ${t.modes[mode]}`}
                  src={previewUrl(mode, previewNonce)}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="subscription-list">
        <span className="muted">{t.recent}</span>
        {status?.recentMessages.length ? status.recentMessages.slice(0, 20).map((message) => (
          <div className="subscription-row" key={message.id}>
            <span>
              <strong>{message.type}</strong>
              <small className="muted">{message.messagePreview ?? message.source ?? message.channel}</small>
            </span>
            <span className="queue-status neutral">{message.channel}</span>
          </div>
        )) : <p className="muted empty-state">{t.empty}</p>}
      </div>
    </div>
  );
}
