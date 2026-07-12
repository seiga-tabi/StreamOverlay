import { Metric, StatusPill, type StatusTone } from "../../../shared/ui/Status";

export type TwitchStreamOverviewRowLocalizedText = {
  label: string;
  ko?: string;
  ja?: string;
};

export type TwitchStreamOverviewRowViewModel = {
  isLive: boolean;
  profileImageUrl?: string;
  fallbackLabel: string;
  label: TwitchStreamOverviewRowLocalizedText;
  value: TwitchStreamOverviewRowLocalizedText;
  metricTone: StatusTone;
  statusLabel: string;
  statusTone: StatusTone;
  categoryLabel?: string;
  viewerLabel?: string;
  offlineLabel?: string;
};

export type TwitchStreamOverviewRowProps = {
  stream: TwitchStreamOverviewRowViewModel;
};

export function TwitchStreamOverviewRow({
  stream,
}: TwitchStreamOverviewRowProps) {
  return (
    <>
      {stream.profileImageUrl ? (
        <img src={stream.profileImageUrl} alt="" />
      ) : (
        <div className={`public-rank-fallback public-stream-fallback ${stream.isLive ? "live" : ""}`}>{stream.fallbackLabel}</div>
      )}
      <Metric
        className="public-profile-shared-rank-metric"
        label={<span data-ko={stream.label.ko} data-ja={stream.label.ja}>{stream.label.label}</span>}
        value={<span data-ko={stream.value.ko} data-ja={stream.value.ja}>{stream.value.label}</span>}
        tone={stream.metricTone}
        status={<StatusPill size="sm" tone={stream.statusTone}>{stream.statusLabel}</StatusPill>}
        description={
          <span className="public-stream-meta">
            {stream.categoryLabel ? <small title={stream.categoryLabel}>{stream.categoryLabel}</small> : null}
            {stream.viewerLabel ? <small title={stream.viewerLabel}>{stream.viewerLabel}</small> : null}
            {stream.offlineLabel ? <small title={stream.offlineLabel}>{stream.offlineLabel}</small> : null}
          </span>
        }
      />
    </>
  );
}
