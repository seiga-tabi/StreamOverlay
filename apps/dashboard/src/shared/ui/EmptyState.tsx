import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from "react";
import "./EmptyState.css";

export type EmptyStateVariant =
  | "default"
  | "search"
  | "community"
  | "streamer"
  | "tournament"
  | "error";

export type EmptyStateElement = "section" | "div" | "article";

export type EmptyStateProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  children: ReactNode;
  variant?: EmptyStateVariant;
  as?: EmptyStateElement;
};

export type EmptyStateIconProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  decorative?: boolean;
};

export type EmptyStateTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4";
  children: ReactNode;
};

export type EmptyStateDescriptionProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

export type EmptyStateActionsProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

function getClassName(baseClassName: string, className?: string) {
  return [baseClassName, className].filter(Boolean).join(" ");
}

export const EmptyState = forwardRef<HTMLElement, EmptyStateProps>(
  ({ as = "section", children, className, variant = "default", ...props }, ref) => {
    const rootProps = {
      ...props,
      className: getClassName("yoro-empty-state", className),
      "data-variant": variant,
    };

    if (as === "div") {
      return (
        <div {...rootProps} ref={ref as Ref<HTMLDivElement>}>
          {children}
        </div>
      );
    }

    if (as === "article") {
      return (
        <article {...rootProps} ref={ref as Ref<HTMLElement>}>
          {children}
        </article>
      );
    }

    return (
      <section {...rootProps} ref={ref as Ref<HTMLElement>}>
        {children}
      </section>
    );
  },
);

EmptyState.displayName = "EmptyState";

export function EmptyStateIcon({
  children,
  className,
  decorative = true,
  ...props
}: EmptyStateIconProps) {
  return (
    <div
      {...props}
      aria-hidden={decorative ? true : props["aria-hidden"]}
      className={getClassName("yoro-empty-state__icon", className)}
    >
      {children}
    </div>
  );
}

export function EmptyStateTitle({
  as = "h2",
  children,
  className,
  ...props
}: EmptyStateTitleProps) {
  const titleClassName = getClassName("yoro-empty-state__title", className);

  if (as === "h3") {
    return (
      <h3 {...props} className={titleClassName}>
        {children}
      </h3>
    );
  }

  if (as === "h4") {
    return (
      <h4 {...props} className={titleClassName}>
        {children}
      </h4>
    );
  }

  return (
    <h2 {...props} className={titleClassName}>
      {children}
    </h2>
  );
}

export function EmptyStateDescription({
  children,
  className,
  ...props
}: EmptyStateDescriptionProps) {
  return (
    <p {...props} className={getClassName("yoro-empty-state__description", className)}>
      {children}
    </p>
  );
}

export function EmptyStateActions({ children, className, ...props }: EmptyStateActionsProps) {
  return (
    <div {...props} className={getClassName("yoro-empty-state__actions", className)}>
      {children}
    </div>
  );
}
