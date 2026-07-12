import { uiText } from "../i18n";
import { Button } from "../shared/ui/Button";
import { Card, CardContent } from "../shared/ui/Card";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Metric, StatusPill, type StatusTone } from "../shared/ui/Status";

type Props = {
  label: string;
  value: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
};

function getStatusTone(value: string): StatusTone {
  if (["online", "connected", "open"].includes(value)) {
    return "success";
  }

  if (["disabled", "unknown", "closed"].includes(value)) {
    return "neutral";
  }

  if (["reconnecting"].includes(value)) {
    return "warning";
  }

  return "danger";
}

export function StatusCard({ label, value, hint, actionLabel, onAction, loading = false }: Props) {
  const tone = getStatusTone(value);
  const valueLabel = uiText.statusValues[value as keyof typeof uiText.statusValues] ?? value;

  if (loading) {
    return (
      <SkeletonCard
        className="dashboard-shared-status-card dashboard-shared-status-skeleton"
        loadingLabel={label}
      >
        <SkeletonText lines={3} />
      </SkeletonCard>
    );
  }

  return (
    <Card
      as="section"
      className="dashboard-shared-status-card"
      padding="md"
      variant={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "glass"}
    >
      <CardContent>
        <Metric
          label={label}
          status={
            <StatusPill size="sm" tone={tone}>
              {value}
            </StatusPill>
          }
          tone={tone}
          value={valueLabel}
        />
        {hint ? <p className="dashboard-shared-status-hint">{hint}</p> : null}
        {actionLabel && onAction ? (
          <Button onClick={onAction} size="sm" variant="secondary">
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
