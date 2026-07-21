import type {
  PalworldServerConnectionSummary,
  PalworldServerDiagnostic,
  PalworldServerStatus
} from "@streamops/shared";
import type { DashboardLocale } from "../../../i18n";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
  Metric,
  StatusPill,
  type StatusTone
} from "../../../shared/ui";
import type { PalworldServerText } from "../i18n";

type PalworldServerStatusPanelProps = {
  connection: PalworldServerConnectionSummary;
  status: PalworldServerStatus;
  locale: DashboardLocale;
  text: PalworldServerText;
};

export function palworldServerStatusTone(state: string): StatusTone {
  if (state === "online") return "success";
  if (state === "checking") return "info";
  if (state === "degraded" || state === "auth_failed" || state === "stale") return "warning";
  if (state === "not_configured" || state === "unknown") return "neutral";
  return "danger";
}

export function palworldServerStatusLabel(state: string, text: PalworldServerText): string {
  return text.status[state as keyof typeof text.status] ?? text.status.unknown;
}

export function palworldServerErrorCodeLabel(
  errorCode: NonNullable<PalworldServerStatus["errorCode"]>,
  text: PalworldServerText
): string {
  return text.errorCodes[errorCode];
}

function diagnosticTone(state: PalworldServerDiagnostic["state"]): StatusTone {
  if (state === "passed") return "success";
  if (state === "failed") return "danger";
  if (state === "pending") return "info";
  return "neutral";
}

function diagnosticLabel(key: PalworldServerDiagnostic["key"], text: PalworldServerText): string {
  return text.diagnosticSteps[key] ?? key;
}

function diagnosticStateLabel(state: PalworldServerDiagnostic["state"], text: PalworldServerText): string {
  return text.diagnosticStates[state] ?? state;
}

function formatDate(value: string | undefined, locale: DashboardLocale, fallback: string): string {
  if (!value) return fallback;
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

function formatDecimal(value: number | undefined, fractionDigits = 1, fallback = "-"): string {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
}

function formatDuration(seconds: number | undefined, text: PalworldServerText): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return text.unavailable;
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safeSeconds / 86_400);
  const hours = Math.floor((safeSeconds % 86_400) / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  if (days > 0) return `${days}${text.day} ${hours}${text.hour}`;
  if (hours > 0) return `${hours}${text.hour} ${minutes}${text.minute}`;
  if (minutes > 0) return `${minutes}${text.minute}`;
  return `${safeSeconds}${text.second}`;
}

function PalworldServerMetricsCard({
  status,
  text
}: Pick<PalworldServerStatusPanelProps, "status" | "text">) {
  const metrics = status.metrics;
  return (
    <Card className="palworld-server-metrics-card" padding="lg">
      <CardHeader>
        <CardTitle>{text.metricsTitle}</CardTitle>
        <CardDescription>{text.metricsDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {metrics ? (
          <div className="palworld-server-metrics">
            <Metric
              label={text.currentPlayers}
              value={`${formatDecimal(metrics.currentPlayers, 0)} / ${formatDecimal(metrics.maxPlayers, 0)}`}
              description={text.people}
              tone="info"
            />
            <Metric label={text.serverFps} value={formatDecimal(metrics.serverFps)} tone="success" />
            <Metric label={text.frameTime} value={`${formatDecimal(metrics.frameTimeMs, 2)} ms`} />
            <Metric label={text.uptime} value={formatDuration(metrics.uptimeSeconds, text)} />
            <Metric label={text.baseCampCount} value={formatDecimal(metrics.baseCampCount, 0)} />
            <Metric label={text.gameDays} value={formatDecimal(metrics.gameDays, 0)} />
          </div>
        ) : (
          <EmptyState as="div" className="palworld-server-inline-empty">
            <EmptyStateIcon>—</EmptyStateIcon>
            <EmptyStateTitle as="h3">{text.status.unknown}</EmptyStateTitle>
            <EmptyStateDescription>{text.metricsDescription}</EmptyStateDescription>
          </EmptyState>
        )}
      </CardContent>
    </Card>
  );
}

function PalworldServerDiagnosticsCard({
  status,
  text
}: Pick<PalworldServerStatusPanelProps, "status" | "text">) {
  const diagnostics = status.diagnostics ?? [];
  return (
    <Card className="palworld-server-diagnostics-card" padding="lg">
      <CardHeader>
        <CardTitle>{text.diagnosticsTitle}</CardTitle>
        <CardDescription>{text.diagnosticsDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {diagnostics.length > 0 ? (
          <ol className="palworld-server-diagnostics">
            {diagnostics.map((diagnostic) => (
              <li key={diagnostic.key}>
                <span className="palworld-server-diagnostic-copy">
                  <strong>{diagnosticLabel(diagnostic.key, text)}</strong>
                  {diagnostic.errorCode ? <code>{diagnostic.errorCode}</code> : null}
                </span>
                <StatusPill size="sm" tone={diagnosticTone(diagnostic.state)}>
                  {diagnosticStateLabel(diagnostic.state, text)}
                </StatusPill>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState as="div" className="palworld-server-inline-empty">
            <EmptyStateIcon>✓</EmptyStateIcon>
            <EmptyStateTitle as="h3">{text.noDiagnostics}</EmptyStateTitle>
          </EmptyState>
        )}
      </CardContent>
    </Card>
  );
}

export function PalworldServerStatusPanel({
  connection,
  status,
  locale,
  text
}: PalworldServerStatusPanelProps) {
  return (
    <div className="palworld-server-status-layout">
      <Card className="palworld-server-overview" padding="lg">
        <CardHeader>
          <div className="palworld-server-card-heading">
            <div>
              <CardTitle>{text.overviewTitle}</CardTitle>
              <CardDescription>{text.overviewDescription}</CardDescription>
            </div>
            <StatusPill size="sm" tone={palworldServerStatusTone(status.state)}>
              {palworldServerStatusLabel(status.state, text)}
            </StatusPill>
          </div>
        </CardHeader>
        <CardContent>
          {status.errorCode ? (
            <div className="palworld-server-status-error" role="alert">
              <Badge size="sm" tone={palworldServerStatusTone(status.state)}>{status.errorCode}</Badge>
              <span>{palworldServerErrorCodeLabel(status.errorCode, text)}</span>
            </div>
          ) : null}
          <dl className="palworld-server-definition-list">
            <div><dt>{text.serverName}</dt><dd>{status.info?.serverName ?? text.unavailable}</dd></div>
            <div><dt>{text.serverVersion}</dt><dd>{status.info?.version ?? text.unavailable}</dd></div>
            <div><dt>{text.baseUrl}</dt><dd>{connection.baseUrl ?? text.unavailable}</dd></div>
            <div><dt>{text.updatedAt}</dt><dd>{formatDate(connection.updatedAt, locale, text.unavailable)}</dd></div>
            <div><dt>{text.checkedAt}</dt><dd>{formatDate(status.checkedAt, locale, text.unavailable)}</dd></div>
            <div><dt>{text.lastSuccessAt}</dt><dd>{formatDate(status.lastSuccessAt, locale, text.unavailable)}</dd></div>
            <div><dt>{text.latency}</dt><dd>{status.latencyMs === undefined ? text.unavailable : `${formatDecimal(status.latencyMs, 0)} ms`}</dd></div>
            <div><dt>{text.consecutiveFailures}</dt><dd>{formatDecimal(status.consecutiveFailures, 0)}{text.failureCount}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <PalworldServerMetricsCard status={status} text={text} />
      <PalworldServerDiagnosticsCard status={status} text={text} />
    </div>
  );
}
