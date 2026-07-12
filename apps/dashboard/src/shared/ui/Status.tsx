import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import "./Status.css";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "live"
  | "streamer"
  | "admin";

export type StatusSize = "sm" | "md" | "lg";

type StatusInlineBaseProps = {
  children: ReactNode;
  tone?: StatusTone;
  size?: StatusSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
};

type StatusInlineNativeProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  keyof StatusInlineBaseProps | "children" | "className"
>;

export type StatusPillProps = StatusInlineBaseProps & StatusInlineNativeProps;

export type BadgeProps = StatusInlineBaseProps & StatusInlineNativeProps;

export type TagProps = StatusInlineBaseProps & StatusInlineNativeProps;

export type MetricProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  tone?: StatusTone;
  size?: StatusSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export type LiveIndicatorProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  children?: ReactNode;
  size?: StatusSize;
  pulse?: boolean;
  rightIcon?: ReactNode;
};

function getClassName(baseClassName: string, className?: string) {
  return [baseClassName, className].filter(Boolean).join(" ");
}

function getStatusContent({
  children,
  leftIcon,
  rightIcon,
}: Pick<StatusInlineBaseProps, "children" | "leftIcon" | "rightIcon">) {
  return (
    <>
      {leftIcon ? (
        <span aria-hidden="true" className="yoro-status__icon yoro-status__icon--left">
          {leftIcon}
        </span>
      ) : null}
      <span className="yoro-status__label">{children}</span>
      {rightIcon ? (
        <span aria-hidden="true" className="yoro-status__icon yoro-status__icon--right">
          {rightIcon}
        </span>
      ) : null}
    </>
  );
}

export const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(
  (
    {
      children,
      className,
      leftIcon,
      rightIcon,
      size = "md",
      tone = "neutral",
      ...props
    },
    ref,
  ) => (
    <span
      {...props}
      ref={ref}
      className={getClassName("yoro-status", className)}
      data-size={size}
      data-tone={tone}
    >
      {getStatusContent({ children, leftIcon, rightIcon })}
    </span>
  ),
);

StatusPill.displayName = "StatusPill";

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      children,
      className,
      leftIcon,
      rightIcon,
      size = "md",
      tone = "neutral",
      ...props
    },
    ref,
  ) => (
    <span
      {...props}
      ref={ref}
      className={getClassName("yoro-badge", className)}
      data-size={size}
      data-tone={tone}
    >
      {getStatusContent({ children, leftIcon, rightIcon })}
    </span>
  ),
);

Badge.displayName = "Badge";

export const Tag = forwardRef<HTMLSpanElement, TagProps>(
  (
    {
      children,
      className,
      leftIcon,
      rightIcon,
      size = "md",
      tone = "neutral",
      ...props
    },
    ref,
  ) => (
    <span
      {...props}
      ref={ref}
      className={getClassName("yoro-tag", className)}
      data-size={size}
      data-tone={tone}
    >
      {getStatusContent({ children, leftIcon, rightIcon })}
    </span>
  ),
);

Tag.displayName = "Tag";

export function Metric({
  className,
  description,
  label,
  leftIcon,
  rightIcon,
  size = "md",
  status,
  tone = "neutral",
  value,
  ...props
}: MetricProps) {
  return (
    <div
      {...props}
      className={getClassName("yoro-metric", className)}
      data-size={size}
      data-tone={tone}
    >
      <div className="yoro-metric__header">
        {leftIcon ? (
          <span aria-hidden="true" className="yoro-metric__icon yoro-metric__icon--left">
            {leftIcon}
          </span>
        ) : null}
        <span className="yoro-metric__label">{label}</span>
        {rightIcon ? (
          <span aria-hidden="true" className="yoro-metric__icon yoro-metric__icon--right">
            {rightIcon}
          </span>
        ) : null}
      </div>
      <div className="yoro-metric__value">{value}</div>
      {description || status ? (
        <div className="yoro-metric__footer">
          {description ? <span className="yoro-metric__description">{description}</span> : null}
          {status ? <span className="yoro-metric__status">{status}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export const LiveIndicator = forwardRef<HTMLSpanElement, LiveIndicatorProps>(
  ({ children, className, pulse = true, rightIcon, size = "md", ...props }, ref) => (
    <span
      {...props}
      ref={ref}
      className={getClassName("yoro-live-indicator", className)}
      data-pulse={pulse ? "true" : "false"}
      data-size={size}
      data-tone="live"
    >
      <span aria-hidden="true" className="yoro-live-indicator__dot" />
      {children ? <span className="yoro-live-indicator__label">{children}</span> : null}
      {rightIcon ? (
        <span aria-hidden="true" className="yoro-live-indicator__icon">
          {rightIcon}
        </span>
      ) : null}
    </span>
  ),
);

LiveIndicator.displayName = "LiveIndicator";
