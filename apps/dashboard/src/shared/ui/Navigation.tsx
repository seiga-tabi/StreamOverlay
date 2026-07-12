import {
  Children,
  forwardRef,
  isValidElement,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import "./Navigation.css";

export type NavigationVariant = "public" | "user" | "streamer" | "admin";

export type NavigationElement = "nav" | "div";

export type NavigationItemElement = "a" | "button";

export type NavigationRootRenderProps = {
  children: ReactNode;
  className: string;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  "data-collapsed"?: "true";
  "data-variant": NavigationVariant;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "onKeyDown">;

type SharedNavigationRootProps = Omit<NavigationRootRenderProps, "children">;

export type NavigationProps = {
  children: ReactNode;
  variant?: NavigationVariant;
  collapsed?: boolean;
  keyboardNavigation?: boolean;
  as?: NavigationElement;
  className?: string;
  renderRoot?: (props: NavigationRootRenderProps) => ReactElement;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

export type NavigationSectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  title?: ReactNode;
  collapsed?: boolean;
};

export type NavigationGroupProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  title?: ReactNode;
  collapsed?: boolean;
};

export type NavigationBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
};

export type NavigationItemRootRenderProps = {
  children: ReactNode;
  className: string;
  onClick: MouseEventHandler<HTMLElement>;
  "aria-current"?: "page";
  "aria-disabled"?: true;
  "data-active"?: "true";
  "data-collapsed"?: "true";
  "data-disabled"?: "true";
  "data-external"?: "true";
  "data-yoro-navigation-item": "true";
  tabIndex?: number;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "onClick">;

type NavigationItemBaseProps = {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  external?: boolean;
  collapsed?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
};

type NativeNavigationItemProps = NavigationItemBaseProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof NavigationItemBaseProps | "aria-current" | "aria-disabled" | "children" | "className"
  > & {
    as?: "button";
  };

type AnchorNavigationItemProps = NavigationItemBaseProps &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof NavigationItemBaseProps | "aria-current" | "aria-disabled" | "children" | "className"
  > & {
    as: "a";
    href: string;
  };

type CustomNavigationItemProps = NavigationItemBaseProps & {
  renderRoot: (props: NavigationItemRootRenderProps) => ReactElement;
  onClick?: MouseEventHandler<HTMLElement>;
  tabIndex?: number;
};

export type NavigationItemProps =
  | NativeNavigationItemProps
  | AnchorNavigationItemProps
  | CustomNavigationItemProps;

function getNavigationClassName(className?: string) {
  return ["yoro-navigation", className].filter(Boolean).join(" ");
}

function getSlotClassName(slotClassName: string, className?: string) {
  return [slotClassName, className].filter(Boolean).join(" ");
}

function getNavigationItemClassName(className?: string) {
  return ["yoro-navigation-item", className].filter(Boolean).join(" ");
}

function getFocusableNavigationItems(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-yoro-navigation-item="true"]:not([aria-disabled="true"])',
    ),
  );
}

function focusNavigationItem(
  event: ReactKeyboardEvent<HTMLElement>,
  direction: "first" | "last" | "next" | "previous",
) {
  const items = getFocusableNavigationItems(event.currentTarget);
  if (items.length === 0) {
    return;
  }

  const activeIndex = items.findIndex((item) => item === document.activeElement);
  const lastIndex = items.length - 1;
  const nextIndex =
    direction === "first"
      ? 0
      : direction === "last"
        ? lastIndex
        : direction === "next"
          ? activeIndex >= lastIndex
            ? 0
            : activeIndex + 1
          : activeIndex <= 0
            ? lastIndex
            : activeIndex - 1;

  event.preventDefault();
  items[nextIndex]?.focus();
}

function getNavigationKeyboardHandler({
  keyboardNavigation,
  onKeyDown,
}: {
  keyboardNavigation: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
}) {
  const handleKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !keyboardNavigation) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      focusNavigationItem(event, "next");
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      focusNavigationItem(event, "previous");
      return;
    }
    if (event.key === "Home") {
      focusNavigationItem(event, "first");
      return;
    }
    if (event.key === "End") {
      focusNavigationItem(event, "last");
    }
  };

  return handleKeyDown;
}

function isNavigationBadge(child: ReactNode) {
  return isValidElement(child) && child.type === NavigationBadge;
}

function getNavigationItemContent({
  badge,
  children,
  icon,
}: Pick<NavigationItemBaseProps, "badge" | "children" | "icon">) {
  const childArray = Children.toArray(children);
  const childBadge = childArray.find(isNavigationBadge);
  const labelChildren = childArray.filter((child) => !isNavigationBadge(child));

  return (
    <>
      {icon ? (
        <span aria-hidden="true" className="yoro-navigation-item__icon">
          {icon}
        </span>
      ) : null}
      <span className="yoro-navigation-item__label">{labelChildren}</span>
      {badge ?? childBadge ? (
        <span className="yoro-navigation-item__badge-slot">{badge ?? childBadge}</span>
      ) : null}
    </>
  );
}

export const Navigation = forwardRef<HTMLElement, NavigationProps>((props, ref) => {
  const {
    as = "nav",
    children,
    className,
    collapsed = false,
    keyboardNavigation = true,
    renderRoot,
    variant = "public",
    ...rootProps
  } = props;
  const sharedProps = {
    ...rootProps,
    className: getNavigationClassName(className),
    "data-collapsed": collapsed ? "true" : undefined,
    "data-variant": variant,
    onKeyDown: getNavigationKeyboardHandler({
      keyboardNavigation,
      onKeyDown: rootProps.onKeyDown,
    }),
  } satisfies SharedNavigationRootProps;

  if (renderRoot) {
    return renderRoot({
      ...sharedProps,
      children,
    });
  }

  if (as === "div") {
    return (
      <div {...sharedProps} ref={ref as Ref<HTMLDivElement>}>
        {children}
      </div>
    );
  }

  return (
    <nav {...sharedProps} ref={ref as Ref<HTMLElement>}>
      {children}
    </nav>
  );
});

Navigation.displayName = "Navigation";

export function NavigationSection({
  children,
  className,
  collapsed = false,
  title,
  ...props
}: NavigationSectionProps) {
  return (
    <section
      {...props}
      className={getSlotClassName("yoro-navigation-section", className)}
      data-collapsed={collapsed ? "true" : undefined}
    >
      {title ? <p className="yoro-navigation-section__title">{title}</p> : null}
      <div className="yoro-navigation-section__items">{children}</div>
    </section>
  );
}

export function NavigationGroup({
  children,
  className,
  collapsed = false,
  title,
  ...props
}: NavigationGroupProps) {
  return (
    <div
      {...props}
      className={getSlotClassName("yoro-navigation-group", className)}
      data-collapsed={collapsed ? "true" : undefined}
    >
      {title ? <p className="yoro-navigation-group__title">{title}</p> : null}
      <div className="yoro-navigation-group__items">{children}</div>
    </div>
  );
}

export const NavigationItem = forwardRef<HTMLAnchorElement | HTMLButtonElement, NavigationItemProps>(
  (props, ref) => {
    const {
      active = false,
      badge,
      children,
      className,
      collapsed = false,
      disabled = false,
      external = false,
      icon,
    } = props;
    const content = getNavigationItemContent({ badge, children, icon });
    const itemClassName = getNavigationItemClassName(className);

    if ("renderRoot" in props) {
      const handleCustomClick: MouseEventHandler<HTMLElement> = (event) => {
        if (disabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        props.onClick?.(event);
      };

      return props.renderRoot({
        children: content,
        className: itemClassName,
        onClick: handleCustomClick,
        "aria-current": active ? "page" : undefined,
        "aria-disabled": disabled ? true : undefined,
        "data-active": active ? "true" : undefined,
        "data-collapsed": collapsed ? "true" : undefined,
        "data-disabled": disabled ? "true" : undefined,
        "data-external": external ? "true" : undefined,
        "data-yoro-navigation-item": "true",
        tabIndex: disabled ? -1 : props.tabIndex,
      });
    }

    if (props.as === "a") {
      const {
        active: _active,
        as: _as,
        badge: _badge,
        children: _children,
        className: _className,
        collapsed: _collapsed,
        disabled: _disabled,
        external: _external,
        icon: _icon,
        onClick,
        rel,
        target,
        tabIndex,
        ...anchorProps
      } = props;
      const handleAnchorClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
        if (disabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      };

      return (
        <a
          {...anchorProps}
          ref={ref as Ref<HTMLAnchorElement>}
          aria-current={active ? "page" : undefined}
          aria-disabled={disabled ? true : undefined}
          className={itemClassName}
          data-active={active ? "true" : undefined}
          data-collapsed={collapsed ? "true" : undefined}
          data-disabled={disabled ? "true" : undefined}
          data-external={external ? "true" : undefined}
          data-yoro-navigation-item="true"
          onClick={handleAnchorClick}
          rel={external ? rel ?? "noreferrer" : rel}
          tabIndex={disabled ? -1 : tabIndex}
          target={external ? target ?? "_blank" : target}
        >
          {content}
        </a>
      );
    }

    const {
      active: _active,
      as: _as,
      badge: _badge,
      children: _children,
      className: _className,
      collapsed: _collapsed,
      disabled: _disabled,
      external: _external,
      icon: _icon,
      onClick,
      tabIndex,
      type = "button",
      ...buttonProps
    } = props;
    const handleButtonClick: MouseEventHandler<HTMLButtonElement> = (event) => {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onClick?.(event);
    };

    return (
      <button
        {...buttonProps}
        ref={ref as Ref<HTMLButtonElement>}
        aria-current={active ? "page" : undefined}
        aria-disabled={disabled ? true : undefined}
        className={itemClassName}
        data-active={active ? "true" : undefined}
        data-collapsed={collapsed ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
        data-external={external ? "true" : undefined}
        data-yoro-navigation-item="true"
        disabled={disabled}
        onClick={handleButtonClick}
        tabIndex={disabled ? -1 : tabIndex}
        type={type}
      >
        {content}
      </button>
    );
  },
);

NavigationItem.displayName = "NavigationItem";

export function NavigationBadge({ children, className, ...props }: NavigationBadgeProps) {
  return (
    <span {...props} className={getSlotClassName("yoro-navigation-badge", className)}>
      {children}
    </span>
  );
}
