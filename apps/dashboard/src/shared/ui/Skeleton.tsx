import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import "./Skeleton.css";

export type SkeletonSize = "sm" | "md" | "lg";

export type SkeletonProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  size?: SkeletonSize;
  rounded?: boolean;
};

export type SkeletonTextProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  lines?: number;
  size?: SkeletonSize;
};

export type SkeletonCardProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children?: ReactNode;
  loadingLabel?: string;
  size?: SkeletonSize;
};

export type SkeletonAvatarProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  size?: SkeletonSize;
};

export type SkeletonButtonProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  size?: SkeletonSize;
};

function getClassName(baseClassName: string, className?: string) {
  return [baseClassName, className].filter(Boolean).join(" ");
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, rounded = false, size = "md", ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      aria-hidden={props["aria-hidden"] ?? true}
      className={getClassName("yoro-skeleton", className)}
      data-rounded={rounded ? "true" : undefined}
      data-size={size}
    />
  ),
);

Skeleton.displayName = "Skeleton";

export function SkeletonText({ className, lines = 3, size = "md", ...props }: SkeletonTextProps) {
  const safeLines = Math.max(1, Math.floor(lines));

  return (
    <div
      {...props}
      aria-hidden={props["aria-hidden"] ?? true}
      className={getClassName("yoro-skeleton-text", className)}
      data-size={size}
    >
      {Array.from({ length: safeLines }, (_, index) => (
        <span
          className="yoro-skeleton yoro-skeleton-text__line"
          data-last={index === safeLines - 1 ? "true" : undefined}
          data-size={size}
          key={index}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({
  children,
  className,
  loadingLabel,
  size = "md",
  ...props
}: SkeletonCardProps) {
  return (
    <div
      {...props}
      aria-busy="true"
      aria-label={loadingLabel}
      className={getClassName("yoro-skeleton-card", className)}
      data-size={size}
      role={loadingLabel ? "status" : props.role}
    >
      {children ?? (
        <>
          <Skeleton size={size} />
          <SkeletonText lines={3} size={size} />
        </>
      )}
    </div>
  );
}

export const SkeletonAvatar = forwardRef<HTMLDivElement, SkeletonAvatarProps>(
  ({ className, size = "md", ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      aria-hidden={props["aria-hidden"] ?? true}
      className={getClassName("yoro-skeleton-avatar", className)}
      data-size={size}
    />
  ),
);

SkeletonAvatar.displayName = "SkeletonAvatar";

export const SkeletonButton = forwardRef<HTMLDivElement, SkeletonButtonProps>(
  ({ className, size = "md", ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      aria-hidden={props["aria-hidden"] ?? true}
      className={getClassName("yoro-skeleton-button", className)}
      data-size={size}
    />
  ),
);

SkeletonButton.displayName = "SkeletonButton";
