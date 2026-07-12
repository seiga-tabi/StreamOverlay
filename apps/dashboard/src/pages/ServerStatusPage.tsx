import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardServerStatus } from "@streamops/shared";
import { apiGet } from "../api/client";
import { dashboardLocale } from "../i18n";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../shared/ui/Card";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle
} from "../shared/ui/PageHeader";
import { SkeletonCard } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill, type StatusTone } from "../shared/ui/Status";
import "./ServerStatusPage.css";

const POLL_INTERVAL_MS = 10_000;

const text = {
  ko: {
    eyebrow: "관리자 운영",
    title: "서버 현황",
    description: "현재 서버 프로세스와 핵심 서비스 연결 상태를 실시간으로 확인합니다.",
    refresh: "새로고침",
    refreshing: "갱신 중",
    autoRefresh: "10초 자동 갱신",
    ready: "정상 운영",
    degraded: "점검 필요",
    shuttingDown: "종료 처리 중",
    loadFailed: "서버 현황을 불러오지 못했습니다. 네트워크 또는 서버 상태를 확인해주세요.",
    loading: "서버 현황을 불러오는 중입니다.",
    lastChecked: "마지막 확인",
    uptime: "가동 시간",
    rssMemory: "프로세스 메모리",
    heapMemory: "Heap 사용량",
    httpConnections: "HTTP 연결",
    connections: "실시간 연결",
    connectionsDescription: "현재 서버에 연결된 운영 클라이언트 수입니다.",
    dashboardWebSocket: "Dashboard WebSocket",
    overlayWebSocket: "Overlay WebSocket",
    bridge: "OBS Bridge",
    connected: "연결됨",
    disconnected: "연결 안 됨",
    services: "핵심 서비스",
    servicesDescription: "Store가 보고하는 방송 운영 서비스의 현재 상태입니다.",
    readiness: "배포 준비 상태",
    readinessDescription: "요청 수신과 영속 저장소 상태를 검사합니다.",
    checkPassed: "통과",
    checkFailed: "실패",
    noErrors: "감지된 readiness 오류가 없습니다.",
    errors: "감지된 오류",
    build: "빌드 정보",
    buildDescription: "현재 실행 중인 artifact의 비민감 식별 정보입니다.",
    version: "버전",
    gitSha: "Git SHA",
    builtAt: "빌드 시각",
    environment: "실행 환경",
    nodeVersion: "Node.js",
    unavailable: "확인 불가",
    heapTotal: "전체 Heap",
    server: "서버",
    twitch: "Twitch",
    stream: "방송",
    obs: "OBS",
    participation: "시청자 참여",
    statePathsConfigured: "상태 저장 경로 설정",
    statePathsWritable: "상태 저장 경로 쓰기",
    persistenceHealthy: "영속 저장 상태",
    acceptingRequests: "신규 요청 수신",
    additionalCheck: "추가 검사",
    day: "일",
    hour: "시간",
    minute: "분",
    second: "초"
  },
  ja: {
    eyebrow: "管理者運用",
    title: "サーバー状況",
    description: "現在のサーバープロセスと主要サービスの接続状態をリアルタイムで確認します。",
    refresh: "更新",
    refreshing: "更新中",
    autoRefresh: "10秒ごとに自動更新",
    ready: "正常稼働",
    degraded: "確認が必要",
    shuttingDown: "終了処理中",
    loadFailed: "サーバー状況を取得できませんでした。ネットワークまたはサーバー状態を確認してください。",
    loading: "サーバー状況を読み込んでいます。",
    lastChecked: "最終確認",
    uptime: "稼働時間",
    rssMemory: "プロセスメモリ",
    heapMemory: "Heap 使用量",
    httpConnections: "HTTP 接続",
    connections: "リアルタイム接続",
    connectionsDescription: "現在サーバーに接続している運用クライアント数です。",
    dashboardWebSocket: "Dashboard WebSocket",
    overlayWebSocket: "Overlay WebSocket",
    bridge: "OBS Bridge",
    connected: "接続済み",
    disconnected: "未接続",
    services: "主要サービス",
    servicesDescription: "Store が報告する配信運用サービスの現在状態です。",
    readiness: "デプロイ準備状態",
    readinessDescription: "リクエスト受付と永続ストレージの状態を確認します。",
    checkPassed: "正常",
    checkFailed: "失敗",
    noErrors: "readiness エラーは検出されていません。",
    errors: "検出エラー",
    build: "ビルド情報",
    buildDescription: "現在稼働中の artifact の非機密識別情報です。",
    version: "バージョン",
    gitSha: "Git SHA",
    builtAt: "ビルド日時",
    environment: "実行環境",
    nodeVersion: "Node.js",
    unavailable: "確認不可",
    heapTotal: "Heap 合計",
    server: "サーバー",
    twitch: "Twitch",
    stream: "配信",
    obs: "OBS",
    participation: "視聴者参加",
    statePathsConfigured: "状態保存先の設定",
    statePathsWritable: "状態保存先への書き込み",
    persistenceHealthy: "永続保存状態",
    acceptingRequests: "新規リクエスト受付",
    additionalCheck: "追加チェック",
    day: "日",
    hour: "時間",
    minute: "分",
    second: "秒"
  }
} as const;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatDuration(seconds: number, locale: keyof typeof text): string {
  const t = text[locale];
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safeSeconds / 86_400);
  const hours = Math.floor((safeSeconds % 86_400) / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  if (days > 0) return `${days}${t.day} ${hours}${t.hour}`;
  if (hours > 0) return `${hours}${t.hour} ${minutes}${t.minute}`;
  if (minutes > 0) return `${minutes}${t.minute}`;
  return `${safeSeconds}${t.second}`;
}

function formatDate(value: string, locale: keyof typeof text, fallback: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function overallTone(status: DashboardServerStatus["status"]): StatusTone {
  if (status === "ready") return "success";
  if (status === "shutting_down") return "danger";
  return "warning";
}

function serviceTone(name: string, value: string): StatusTone {
  if (value === "online" || value === "connected" || value === "open") {
    return name === "stream" || name === "participation" ? "live" : "success";
  }
  if (value === "unknown" || value === "disabled") return "warning";
  if ((name === "stream" && value === "offline") || (name === "participation" && value === "closed")) return "neutral";
  return "danger";
}

function statusLabel(value: string, locale: keyof typeof text): string {
  const labels = locale === "ja"
    ? { online: "オンライン", offline: "オフライン", connected: "接続済み", disconnected: "未接続", disabled: "無効", unknown: "不明", open: "受付中", closed: "受付終了" }
    : { online: "온라인", offline: "오프라인", connected: "연결됨", disconnected: "연결 안 됨", disabled: "비활성", unknown: "알 수 없음", open: "모집 중", closed: "모집 종료" };
  return labels[value as keyof typeof labels] ?? value;
}

export function ServerStatusPage() {
  const locale = dashboardLocale;
  const t = text[locale];
  const [status, setStatus] = useState<DashboardServerStatus>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async (showLoading = true) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (showLoading && mountedRef.current) setLoading(true);
    try {
      const response = await apiGet<DashboardServerStatus>("/api/dashboard/server-status");
      if (!mountedRef.current) return;
      setStatus(response);
      setError("");
    } catch {
      if (mountedRef.current) setError(t.loadFailed);
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current && showLoading) setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const interval = window.setInterval(() => void refresh(false), POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

  const checkLabels: Record<string, string> = {
    statePathsConfigured: t.statePathsConfigured,
    statePathsWritable: t.statePathsWritable,
    persistenceHealthy: t.persistenceHealthy,
    acceptingRequests: t.acceptingRequests
  };
  const overallLabel = status?.status === "ready" ? t.ready : status?.status === "shutting_down" ? t.shuttingDown : t.degraded;
  const heapPercent = status?.memory.heapTotalBytes
    ? Math.round((status.memory.heapUsedBytes / status.memory.heapTotalBytes) * 100)
    : 0;
  const services = status ? [
    { key: "server", label: t.server, value: status.services.server },
    { key: "twitch", label: t.twitch, value: status.services.twitch },
    { key: "stream", label: t.stream, value: status.services.stream },
    { key: "bridge", label: t.bridge, value: status.services.bridge },
    { key: "obs", label: t.obs, value: status.services.obs },
    { key: "participation", label: t.participation, value: status.services.participation }
  ] : [];

  return (
    <div className="server-status-page">
      <PageHeader layout="split">
        <PageHeaderEyebrow data-ko={text.ko.eyebrow} data-ja={text.ja.eyebrow}>{t.eyebrow}</PageHeaderEyebrow>
        <PageHeaderTitle data-ko={text.ko.title} data-ja={text.ja.title}>{t.title}</PageHeaderTitle>
        <PageHeaderDescription data-ko={text.ko.description} data-ja={text.ja.description}>{t.description}</PageHeaderDescription>
        <PageHeaderStatus aria-live="polite">
          {status ? <StatusPill tone={overallTone(status.status)}>{overallLabel}</StatusPill> : null}
          <Badge tone="neutral">{t.autoRefresh}</Badge>
        </PageHeaderStatus>
        <PageHeaderActions>
          <Button loading={loading} loadingLabel={t.refreshing} onClick={() => void refresh()} size="sm" variant="secondary">
            {t.refresh}
          </Button>
        </PageHeaderActions>
      </PageHeader>

      {error ? <p className="server-status-error" role="alert">{error}</p> : null}

      {!status ? (
        <div className="server-status-skeletons">
          <SkeletonCard loadingLabel={t.loading} />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <section className="server-status-metrics" aria-label={t.title}>
            <Metric label={t.uptime} value={formatDuration(status.uptimeSeconds, locale)} description={formatDate(status.startedAt, locale, t.unavailable)} size="sm" tone="success" />
            <Metric label={t.rssMemory} value={formatBytes(status.memory.rssBytes)} description={t.environment} status={status.runtime.nodeEnv} size="sm" tone="info" />
            <Metric label={t.heapMemory} value={`${heapPercent}%`} description={`${t.heapTotal} ${formatBytes(status.memory.heapTotalBytes)}`} size="sm" tone={heapPercent >= 85 ? "danger" : heapPercent >= 70 ? "warning" : "success"} />
            <Metric label={t.httpConnections} value={status.connections.http} description={t.lastChecked} status={formatDate(status.collectedAt, locale, t.unavailable)} size="sm" tone="neutral" />
          </section>

          <div className="server-status-layout">
            <Card className="server-status-services" padding="lg">
              <CardHeader>
                <div>
                  <CardTitle>{t.services}</CardTitle>
                  <CardDescription>{t.servicesDescription}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="server-status-service-list">
                  {services.map((service) => (
                    <li key={service.key}>
                      <span>{service.label}</span>
                      <StatusPill size="sm" tone={serviceTone(service.key, service.value)}>{statusLabel(service.value, locale)}</StatusPill>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <div>
                  <CardTitle>{t.connections}</CardTitle>
                  <CardDescription>{t.connectionsDescription}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="server-status-definition-list">
                  <div><dt>{t.dashboardWebSocket}</dt><dd>{status.connections.dashboardWebSocket}</dd></div>
                  <div><dt>{t.overlayWebSocket}</dt><dd>{status.connections.overlayWebSocket}</dd></div>
                  <div>
                    <dt>{t.bridge}</dt>
                    <dd><StatusPill size="sm" tone={status.connections.bridge ? "success" : "danger"}>{status.connections.bridge ? t.connected : t.disconnected}</StatusPill></dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <div>
                  <CardTitle>{t.readiness}</CardTitle>
                  <CardDescription>{t.readinessDescription}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="server-status-readiness-content">
                <ul className="server-status-check-list">
                  {Object.entries(status.readiness.checks).map(([key, passed]) => (
                    <li key={key}>
                      <span>{checkLabels[key] ?? `${t.additionalCheck}: ${key}`}</span>
                      <StatusPill size="sm" tone={passed ? "success" : "danger"}>{passed ? t.checkPassed : t.checkFailed}</StatusPill>
                    </li>
                  ))}
                </ul>
                {status.readiness.errors.length ? (
                  <div className="server-status-readiness-errors" role="alert">
                    <strong>{t.errors}</strong>
                    <ul>{status.readiness.errors.map((item) => <li key={item}><code>{item}</code></li>)}</ul>
                  </div>
                ) : <p className="server-status-no-errors">{t.noErrors}</p>}
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <div>
                  <CardTitle>{t.build}</CardTitle>
                  <CardDescription>{t.buildDescription}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="server-status-definition-list server-status-build-list">
                  <div><dt>{t.version}</dt><dd><code>{status.build.version || t.unavailable}</code></dd></div>
                  <div><dt>{t.gitSha}</dt><dd><code>{status.build.gitSha === "unknown" ? t.unavailable : status.build.gitSha.slice(0, 12)}</code></dd></div>
                  <div><dt>{t.builtAt}</dt><dd>{status.build.builtAt === "unknown" ? t.unavailable : formatDate(status.build.builtAt, locale, t.unavailable)}</dd></div>
                  <div><dt>{t.nodeVersion}</dt><dd><code>{status.runtime.nodeVersion}</code></dd></div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
