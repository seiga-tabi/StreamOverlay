import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { AppShellFooter } from "./ui/AppShell";

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function usePublicHorizontalNavScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [scrollState, setScrollState] = useState({ start: false, end: false });

  const syncScrollState = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    setScrollState({
      start: scroller.scrollLeft > 1,
      end: scroller.scrollLeft < maxScroll - 1,
    });
  }, []);

  const revealFocusedItem = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const scroller = scrollRef.current;
    const target = event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>("a, button, [tabindex]")
      : null;
    if (!scroller || !target || !scroller.contains(target)) return;

    window.requestAnimationFrame(() => {
      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (targetRect.left < scrollerRect.left) {
        scroller.scrollBy({ left: targetRect.left - scrollerRect.left });
      } else if (targetRect.right > scrollerRect.right) {
        scroller.scrollBy({ left: targetRect.right - scrollerRect.right });
      }
    });
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return undefined;

    syncScrollState();
    scroller.addEventListener("scroll", syncScrollState, { passive: true });
    window.addEventListener("resize", syncScrollState);
    const observer = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(syncScrollState);
    observer?.observe(scroller);
    if (contentRef.current) observer?.observe(contentRef.current);

    return () => {
      scroller.removeEventListener("scroll", syncScrollState);
      window.removeEventListener("resize", syncScrollState);
      observer?.disconnect();
    };
  }, [syncScrollState]);

  return {
    contentRef,
    revealFocusedItem,
    scrollRef,
    scrollState,
  };
}

export function PublicHorizontalNav({
  ariaLabel,
  children,
  className,
  testId,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const {
    contentRef,
    revealFocusedItem,
    scrollRef,
    scrollState,
  } = usePublicHorizontalNavScroll();

  return (
    <div
      className={joinClassNames(
        "public-horizontal-nav",
        scrollState.start ? "can-scroll-start" : undefined,
        scrollState.end ? "can-scroll-end" : undefined,
        className,
      )}
      data-scroll-end={scrollState.end ? "true" : undefined}
      data-scroll-start={scrollState.start ? "true" : undefined}
      onFocusCapture={revealFocusedItem}
      ref={scrollRef}
    >
      <nav
        aria-label={ariaLabel}
        className="public-horizontal-nav__content"
        data-testid={testId}
        ref={contentRef}
      >
        {children}
      </nav>
    </div>
  );
}

export function PublicGameHeaderFrame({
  accountTools,
  brand,
  className,
  gameSelector,
  home = false,
  mobileGameTray,
  mobileMenu,
  mobileMenuToggle,
  navigation,
  pageActions,
  search,
  tools,
}: {
  accountTools?: ReactNode;
  brand: ReactNode;
  className?: string;
  gameSelector: ReactNode;
  home?: boolean;
  mobileGameTray?: ReactNode;
  mobileMenu?: ReactNode;
  mobileMenuToggle: ReactNode;
  navigation: ReactNode;
  pageActions?: ReactNode;
  search?: ReactNode;
  tools?: ReactNode;
}) {
  const resolvedAccountTools = accountTools ?? tools;
  const hasSearchRow = Boolean(search || pageActions);

  return (
    <>
      <header
        className={joinClassNames("public-game-header", className)}
        data-home={home ? "true" : undefined}
        data-search={hasSearchRow ? "true" : undefined}
      >
        <div className="public-game-header__layout">
          <div className="public-game-header__primary-row">
            <div className="public-game-header__product">
              {brand}
              <div className="public-game-header__desktop-game-selector">
                {gameSelector}
              </div>
            </div>
            {hasSearchRow ? (
              <div className="public-game-header__search-slot">
                {search ? (
                  <div className="public-game-header__search-content">
                    {search}
                  </div>
                ) : null}
                {pageActions ? (
                  <div className="public-game-header__page-actions">
                    {pageActions}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="public-game-header__tools">
              {resolvedAccountTools}
            </div>
            <div className="public-game-header__mobile-toggle">
              {mobileMenuToggle}
            </div>
          </div>
          <div className="public-game-header__secondary-row">
            <div className="public-game-header__nav-slot">
              {navigation}
            </div>
          </div>
        </div>
      </header>
      {mobileMenu ?? mobileGameTray}
    </>
  );
}

export function PublicGameFooterFrame({
  brand,
  className,
  copyright,
  disclaimer,
  legalNavigation,
  ...props
}: {
  brand: ReactNode;
  className?: string;
  copyright?: ReactNode;
  disclaimer: ReactNode;
  legalNavigation?: ReactNode;
} & Omit<React.ComponentProps<typeof AppShellFooter>, "children">) {
  return (
    <AppShellFooter
      {...props}
      className={joinClassNames("public-game-footer", className)}
    >
      <strong className="public-game-footer__brand">{brand}</strong>
      {legalNavigation ? (
        <div className="public-game-footer__legal">
          {legalNavigation}
        </div>
      ) : null}
      <div className="public-game-footer__notice">
        {disclaimer}
        {copyright ? <span>{copyright}</span> : null}
      </div>
    </AppShellFooter>
  );
}
