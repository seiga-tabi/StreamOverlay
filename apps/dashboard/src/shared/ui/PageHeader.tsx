import {
  Children,
  forwardRef,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import "./PageHeader.css";

export type PageHeaderLayout = "default" | "compact" | "split";

export type PageHeaderElement = "header" | "section" | "div";

export type PageHeaderRootRenderProps = {
  children: ReactNode;
  className: string;
  "data-layout": PageHeaderLayout;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

type SharedPageHeaderRootProps = Omit<PageHeaderRootRenderProps, "children">;

export type PageHeaderProps = {
  children: ReactNode;
  layout?: PageHeaderLayout;
  as?: PageHeaderElement;
  className?: string;
  renderRoot?: (props: PageHeaderRootRenderProps) => ReactElement;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

type PageHeaderTextProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export type PageHeaderTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3";
  children: ReactNode;
};

function getPageHeaderClassName(className?: string) {
  return ["yoro-page-header", className].filter(Boolean).join(" ");
}

function getSlotClassName(slotClassName: string, className?: string) {
  return [slotClassName, className].filter(Boolean).join(" ");
}

function isPageHeaderSlot(child: ReactNode, slot: (props: PageHeaderTextProps) => ReactElement) {
  return isValidElement(child) && child.type === slot;
}

function splitPageHeaderChildren(children: ReactNode) {
  const mainChildren: ReactNode[] = [];
  const statusChildren: ReactNode[] = [];
  const actionChildren: ReactNode[] = [];

  Children.toArray(children).forEach((child) => {
    if (isPageHeaderSlot(child, PageHeaderStatus)) {
      statusChildren.push(child);
      return;
    }
    if (isPageHeaderSlot(child, PageHeaderActions)) {
      actionChildren.push(child);
      return;
    }
    mainChildren.push(child);
  });

  return { actionChildren, mainChildren, statusChildren };
}

function getPageHeaderContent(children: ReactNode) {
  const { actionChildren, mainChildren, statusChildren } = splitPageHeaderChildren(children);

  return (
    <>
      <div className="yoro-page-header__main">{mainChildren}</div>
      {statusChildren}
      {actionChildren}
    </>
  );
}

export function PageHeaderEyebrow({ children, className, ...props }: PageHeaderTextProps) {
  return (
    <p {...props} className={getSlotClassName("yoro-page-header__eyebrow", className)}>
      {children}
    </p>
  );
}

export function PageHeaderTitle({ as = "h1", children, className, ...props }: PageHeaderTitleProps) {
  const titleClassName = getSlotClassName("yoro-page-header__title", className);

  if (as === "h2") {
    return (
      <h2 {...props} className={titleClassName}>
        {children}
      </h2>
    );
  }

  if (as === "h3") {
    return (
      <h3 {...props} className={titleClassName}>
        {children}
      </h3>
    );
  }

  return (
    <h1 {...props} className={titleClassName}>
      {children}
    </h1>
  );
}

export function PageHeaderDescription({ children, className, ...props }: PageHeaderTextProps) {
  return (
    <p {...props} className={getSlotClassName("yoro-page-header__description", className)}>
      {children}
    </p>
  );
}

export function PageHeaderActions({ children, className, ...props }: PageHeaderTextProps) {
  return (
    <div {...props} className={getSlotClassName("yoro-page-header__actions", className)}>
      {children}
    </div>
  );
}

export function PageHeaderStatus({ children, className, ...props }: PageHeaderTextProps) {
  return (
    <div {...props} className={getSlotClassName("yoro-page-header__status", className)}>
      {children}
    </div>
  );
}

export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>((props, ref) => {
  const {
    as = "header",
    children,
    className,
    layout = "default",
    renderRoot,
    ...rootProps
  } = props;
  const content = getPageHeaderContent(children);
  const sharedProps = {
    ...rootProps,
    className: getPageHeaderClassName(className),
    "data-layout": layout,
  } satisfies SharedPageHeaderRootProps;

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

  if (as === "div") {
    return (
      <div {...sharedProps} ref={ref as Ref<HTMLDivElement>}>
        {content}
      </div>
    );
  }

  return (
    <header {...sharedProps} ref={ref as Ref<HTMLElement>}>
      {content}
    </header>
  );
});

PageHeader.displayName = "PageHeader";
