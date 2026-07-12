import {
  forwardRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import "./AppShell.css";

export const DEFAULT_APP_SHELL_MAIN_ID = "yoro-app-shell-main";

export type AppShellVariant = "public" | "user" | "streamer" | "admin";

export type AppShellSidebarMode = "static" | "drawer";

export type AppShellElement = "div" | "section";

export type AppShellRootRenderProps = {
  children: ReactNode;
  className: string;
  "data-sidebar-mode": AppShellSidebarMode;
  "data-sidebar-open"?: "true";
  "data-variant": AppShellVariant;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

type SharedAppShellRootProps = Omit<AppShellRootRenderProps, "children">;

export type AppShellProps = {
  children: ReactNode;
  variant?: AppShellVariant;
  sidebarMode?: AppShellSidebarMode;
  sidebarOpen?: boolean;
  mainId?: string;
  skipLinkLabel?: ReactNode;
  showSkipLink?: boolean;
  as?: AppShellElement;
  className?: string;
  renderRoot?: (props: AppShellRootRenderProps) => ReactElement;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

type AppShellSlotProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
};

export type AppShellHeaderProps = AppShellSlotProps & {
  as?: "header" | "div";
};

export type AppShellSidebarProps = AppShellSlotProps & {
  as?: "aside" | "nav" | "div";
  open?: boolean;
};

export type AppShellMainProps = AppShellSlotProps & {
  as?: "main" | "div";
};

export type AppShellFooterProps = AppShellSlotProps & {
  as?: "footer" | "div";
};

function getAppShellClassName(className?: string) {
  return ["yoro-app-shell", className].filter(Boolean).join(" ");
}

function getSlotClassName(slotClassName: string, className?: string) {
  return [slotClassName, className].filter(Boolean).join(" ");
}

function getSkipLink(label: ReactNode, mainId: string) {
  return (
    <a
      className="yoro-app-shell__skip-link"
      data-ja="本文へ移動"
      data-ko="본문으로 이동"
      href={`#${mainId}`}
    >
      {label}
    </a>
  );
}

export const AppShell = forwardRef<HTMLElement, AppShellProps>((props, ref) => {
  const {
    as = "div",
    children,
    className,
    mainId = DEFAULT_APP_SHELL_MAIN_ID,
    renderRoot,
    showSkipLink = true,
    sidebarMode = "static",
    sidebarOpen = false,
    skipLinkLabel = "본문으로 이동",
    variant = "public",
    ...rootProps
  } = props;
  const content = (
    <>
      {showSkipLink ? getSkipLink(skipLinkLabel, mainId) : null}
      {children}
    </>
  );
  const sharedProps = {
    ...rootProps,
    className: getAppShellClassName(className),
    "data-sidebar-mode": sidebarMode,
    "data-sidebar-open": sidebarOpen ? "true" : undefined,
    "data-variant": variant,
  } satisfies SharedAppShellRootProps;

  if (renderRoot) {
    return renderRoot({
      ...sharedProps,
      children: content,
    });
  }

  if (as === "section") {
    return (
      <section {...sharedProps} ref={ref as Ref<HTMLElement>}>
        {content}
      </section>
    );
  }

  return (
    <div {...sharedProps} ref={ref as Ref<HTMLDivElement>}>
      {content}
    </div>
  );
});

AppShell.displayName = "AppShell";

export function AppShellHeader({ as = "header", children, className, ...props }: AppShellHeaderProps) {
  const slotClassName = getSlotClassName("yoro-app-shell__header", className);

  if (as === "div") {
    return (
      <div {...props} className={slotClassName}>
        {children}
      </div>
    );
  }

  return (
    <header {...props} className={slotClassName}>
      {children}
    </header>
  );
}

export function AppShellSidebar({
  as = "aside",
  children,
  className,
  open,
  ...props
}: AppShellSidebarProps) {
  const slotClassName = getSlotClassName("yoro-app-shell__sidebar", className);
  const sharedProps = {
    ...props,
    className: slotClassName,
    "data-open": open ? "true" : undefined,
  };

  if (as === "nav") {
    return <nav {...sharedProps}>{children}</nav>;
  }

  if (as === "div") {
    return <div {...sharedProps}>{children}</div>;
  }

  return <aside {...sharedProps}>{children}</aside>;
}

export function AppShellMain({
  as = "main",
  children,
  className,
  id = DEFAULT_APP_SHELL_MAIN_ID,
  tabIndex,
  ...props
}: AppShellMainProps) {
  const slotClassName = getSlotClassName("yoro-app-shell__main", className);
  const sharedProps = {
    ...props,
    className: slotClassName,
    id,
    tabIndex: tabIndex ?? -1,
  };

  if (as === "div") {
    return <div {...sharedProps}>{children}</div>;
  }

  return <main {...sharedProps}>{children}</main>;
}

export function AppShellFooter({ as = "footer", children, className, ...props }: AppShellFooterProps) {
  const slotClassName = getSlotClassName("yoro-app-shell__footer", className);

  if (as === "div") {
    return (
      <div {...props} className={slotClassName}>
        {children}
      </div>
    );
  }

  return (
    <footer {...props} className={slotClassName}>
      {children}
    </footer>
  );
}
