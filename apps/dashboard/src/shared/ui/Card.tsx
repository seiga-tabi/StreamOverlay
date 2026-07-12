import {
  forwardRef,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import "./Card.css";

export type CardVariant = "default" | "glass" | "elevated" | "interactive" | "warning" | "danger";

export type CardPadding = "none" | "sm" | "md" | "lg";

export type CardElement = "article" | "section" | "div" | "aside";

type CardBaseProps = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  as?: CardElement;
  disabled?: boolean;
  className?: string;
};

export type CardRootRenderProps = {
  children: ReactNode;
  className: string;
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  role?: string;
  "aria-disabled"?: true;
  "data-padding": CardPadding;
  "data-variant": CardVariant;
  tabIndex?: number;
};

type SharedCardRootProps = Omit<CardRootRenderProps, "children"> &
  Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

export type CardProps = CardBaseProps &
  Omit<HTMLAttributes<HTMLElement>, keyof CardBaseProps | "className" | "children"> & {
    renderRoot?: (props: CardRootRenderProps) => ReactElement;
  };

type CardSectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4";
  children: ReactNode;
};

function getCardClassName(className?: string) {
  return ["yoro-card", className].filter(Boolean).join(" ");
}

function isKeyboardActivationKey(key: string) {
  return key === "Enter" || key === " ";
}

function getCardInteractionProps({
  disabled,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  variant,
}: Pick<CardProps, "disabled" | "onClick" | "onKeyDown" | "role" | "tabIndex" | "variant">) {
  const isInteractive = variant === "interactive" && Boolean(onClick);

  const handleClick: MouseEventHandler<HTMLElement> | undefined = onClick
    ? (event) => {
        if (disabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick(event);
      }
    : undefined;

  const handleKeyDown: KeyboardEventHandler<HTMLElement> | undefined =
    isInteractive || onKeyDown
      ? (event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || !isInteractive || disabled) {
            return;
          }
          if (isKeyboardActivationKey(event.key)) {
            event.preventDefault();
            event.currentTarget.click();
          }
        }
      : undefined;

  return {
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    role: role ?? (isInteractive ? "button" : undefined),
    tabIndex: tabIndex ?? (isInteractive && !disabled ? 0 : undefined),
  };
}

export const Card = forwardRef<HTMLElement, CardProps>((props, ref) => {
  const {
    as = "article",
    children,
    className,
    disabled = false,
    padding = "md",
    renderRoot,
    variant = "default",
    ...rootProps
  } = props;
  const interactionProps = getCardInteractionProps({
    disabled,
    onClick: rootProps.onClick,
    onKeyDown: rootProps.onKeyDown,
    role: rootProps.role,
    tabIndex: rootProps.tabIndex,
    variant,
  });
  const sharedProps = {
    ...rootProps,
    ...interactionProps,
    "aria-disabled": disabled ? true : undefined,
    className: getCardClassName(className),
    "data-padding": padding,
    "data-variant": variant,
  } satisfies SharedCardRootProps;

  if (renderRoot) {
    return renderRoot({
      ...sharedProps,
      children,
    });
  }

  if (as === "section") {
    return (
      <section {...sharedProps} ref={ref as Ref<HTMLElement>}>
        {children}
      </section>
    );
  }

  if (as === "div") {
    return (
      <div {...sharedProps} ref={ref as Ref<HTMLDivElement>}>
        {children}
      </div>
    );
  }

  if (as === "aside") {
    return (
      <aside {...sharedProps} ref={ref as Ref<HTMLElement>}>
        {children}
      </aside>
    );
  }

  return (
    <article {...sharedProps} ref={ref as Ref<HTMLElement>}>
      {children}
    </article>
  );
});

Card.displayName = "Card";

export function CardHeader({ children, className, ...props }: CardSectionProps) {
  return (
    <header {...props} className={["yoro-card__header", className].filter(Boolean).join(" ")}>
      {children}
    </header>
  );
}

export function CardTitle({ as = "h3", children, className, ...props }: CardTitleProps) {
  const titleClassName = ["yoro-card__title", className].filter(Boolean).join(" ");

  if (as === "h2") {
    return (
      <h2 {...props} className={titleClassName}>
        {children}
      </h2>
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
    <h3 {...props} className={titleClassName}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className, ...props }: CardSectionProps) {
  return (
    <p {...props} className={["yoro-card__description", className].filter(Boolean).join(" ")}>
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }: CardSectionProps) {
  return (
    <div {...props} className={["yoro-card__content", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }: CardSectionProps) {
  return (
    <footer {...props} className={["yoro-card__footer", className].filter(Boolean).join(" ")}>
      {children}
    </footer>
  );
}
