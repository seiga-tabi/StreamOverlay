import { uiText } from "../i18n";

type Props = {
  label: string;
  value: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StatusCard({ label, value, hint, actionLabel, onAction }: Props) {
  const good = ["online", "connected", "open"].includes(value);
  const disabled = value === "disabled" || value === "unknown";
  const valueLabel = uiText.statusValues[value as keyof typeof uiText.statusValues] ?? value;

  return (
    <div className="card status-card">
      <div className="status-card-head">
        <span className="muted">{label}</span>
        <span className={good ? "status-dot good-bg" : disabled ? "status-dot neutral-bg" : "status-dot bad-bg"} />
      </div>
      <div className={good ? "status good" : disabled ? "status neutral" : "status bad"}>
        <span className="status-value">{valueLabel}</span>
        <span className="status-raw">{value}</span>
      </div>
      {hint ? <div className="hint">{hint}</div> : null}
      {actionLabel && onAction ? (
        <button className="status-card-action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
