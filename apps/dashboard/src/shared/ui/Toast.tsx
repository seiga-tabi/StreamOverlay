import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FocusEvent as ReactFocusEvent,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import "./Toast.css";

export type ToastTone = "neutral" | "info" | "success" | "warning" | "danger";

export type ToastPosition = "top-right" | "top-center" | "bottom-right" | "bottom-center";

export type ToastState = "open" | "closing" | "dismissed" | "loading";

type ToastProviderContextValue = {
  ariaLive: "polite" | "assertive";
  duration: number;
  pauseOnFocus: boolean;
  pauseOnHover: boolean;
  position: ToastPosition;
};

type ToastItemContextValue = {
  dismissDisabled: boolean;
  loading: boolean;
  requestDismiss: () => void;
};

const ToastProviderContext = createContext<ToastProviderContextValue | null>(null);
const ToastItemContext = createContext<ToastItemContextValue | null>(null);

export type ToastProviderProps = {
  ariaLive?: "polite" | "assertive";
  children: ReactNode;
  duration?: number;
  pauseOnFocus?: boolean;
  pauseOnHover?: boolean;
  position?: ToastPosition;
};

export type ToastViewportProps = Omit<HTMLAttributes<HTMLOListElement>, "children"> & {
  children: ReactNode;
  position?: ToastPosition;
  ariaLive?: "polite" | "assertive";
};

export type ToastProps = Omit<HTMLAttributes<HTMLLIElement>, "children"> & {
  autoDismiss?: boolean;
  children: ReactNode;
  closing?: boolean;
  dismissed?: boolean;
  dismissDisabled?: boolean;
  duration?: number;
  loading?: boolean;
  onDismiss?: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  pauseOnFocus?: boolean;
  pauseOnHover?: boolean;
  state?: ToastState;
  tone?: ToastTone;
};

export type ToastTitleProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export type ToastDescriptionProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

export type ToastActionProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> & {
  children: ReactNode;
  loading?: boolean;
  type?: "button";
};

export type ToastCloseButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children" | "disabled" | "type"
> & {
  "aria-label": string;
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  type?: "button";
};

function getClassName(baseClassName: string, className?: string) {
  return [baseClassName, className].filter(Boolean).join(" ");
}

function getToastState({
  closing,
  dismissed,
  loading,
  open,
  state,
}: Pick<ToastProps, "closing" | "dismissed" | "loading" | "open" | "state">): ToastState {
  if (state) {
    return state;
  }
  if (dismissed) {
    return "dismissed";
  }
  if (closing) {
    return "closing";
  }
  if (loading) {
    return "loading";
  }
  return open === false ? "dismissed" : "open";
}

export function ToastProvider({
  ariaLive = "polite",
  children,
  duration = 5000,
  pauseOnFocus = true,
  pauseOnHover = true,
  position = "top-right",
}: ToastProviderProps) {
  const value = useMemo<ToastProviderContextValue>(
    () => ({
      ariaLive,
      duration,
      pauseOnFocus,
      pauseOnHover,
      position,
    }),
    [ariaLive, duration, pauseOnFocus, pauseOnHover, position],
  );

  return <ToastProviderContext.Provider value={value}>{children}</ToastProviderContext.Provider>;
}

export const ToastViewport = forwardRef<HTMLOListElement, ToastViewportProps>(
  ({ ariaLive, children, className, position, ...props }, ref) => {
    const context = useContext(ToastProviderContext);
    const resolvedAriaLive = ariaLive ?? context?.ariaLive ?? "polite";
    const resolvedPosition = position ?? context?.position ?? "top-right";

    return (
      <ol
        {...props}
        ref={ref}
        aria-atomic="false"
        aria-live={resolvedAriaLive}
        className={getClassName("yoro-toast-viewport", className)}
        data-position={resolvedPosition}
      >
        {children}
      </ol>
    );
  },
);

ToastViewport.displayName = "ToastViewport";

export const Toast = forwardRef<HTMLLIElement, ToastProps>(
  (
    {
      autoDismiss = false,
      children,
      className,
      closing = false,
      dismissed = false,
      dismissDisabled = false,
      duration,
      loading = false,
      onBlur,
      onDismiss,
      onFocus,
      onKeyDown,
      onMouseEnter,
      onMouseLeave,
      onOpenChange,
      open = true,
      pauseOnFocus,
      pauseOnHover,
      role,
      state,
      tone = "neutral",
      ...props
    },
    ref,
  ) => {
    const context = useContext(ToastProviderContext);
    const [paused, setPaused] = useState(false);
    const resolvedDuration = duration ?? context?.duration ?? 5000;
    const resolvedPauseOnFocus = pauseOnFocus ?? context?.pauseOnFocus ?? true;
    const resolvedPauseOnHover = pauseOnHover ?? context?.pauseOnHover ?? true;
    const toastState = getToastState({ closing, dismissed, loading, open, state });
    const isRendered = state ? true : open || closing;
    const isDismissDisabled = dismissDisabled || loading || toastState === "loading";
    const remainingDurationRef = useRef(resolvedDuration);
    const startedAtRef = useRef<number | null>(null);

    const requestDismiss = useCallback(() => {
      if (isDismissDisabled) {
        return;
      }
      onDismiss?.();
      onOpenChange?.(false);
    }, [isDismissDisabled, onDismiss, onOpenChange]);

    useEffect(() => {
      remainingDurationRef.current = resolvedDuration;
    }, [resolvedDuration, open]);

    useEffect(() => {
      if (!autoDismiss || paused || toastState !== "open") {
        return undefined;
      }

      startedAtRef.current = Date.now();
      const timer = window.setTimeout(requestDismiss, remainingDurationRef.current);

      return () => {
        window.clearTimeout(timer);
        if (startedAtRef.current !== null) {
          remainingDurationRef.current = Math.max(
            0,
            remainingDurationRef.current - (Date.now() - startedAtRef.current),
          );
        }
        startedAtRef.current = null;
      };
    }, [autoDismiss, paused, requestDismiss, toastState]);

    if (!isRendered) {
      return null;
    }

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLLIElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        requestDismiss();
      }
    };

    const handleMouseEnter = (event: ReactMouseEvent<HTMLLIElement>) => {
      onMouseEnter?.(event);
      if (resolvedPauseOnHover) {
        setPaused(true);
      }
    };

    const handleMouseLeave = (event: ReactMouseEvent<HTMLLIElement>) => {
      onMouseLeave?.(event);
      if (resolvedPauseOnHover) {
        setPaused(false);
      }
    };

    const handleFocus = (event: ReactFocusEvent<HTMLLIElement>) => {
      onFocus?.(event);
      if (resolvedPauseOnFocus) {
        setPaused(true);
      }
    };

    const handleBlur = (event: ReactFocusEvent<HTMLLIElement>) => {
      onBlur?.(event);
      if (resolvedPauseOnFocus && !event.currentTarget.contains(event.relatedTarget)) {
        setPaused(false);
      }
    };

    return (
      <ToastItemContext.Provider
        value={{
          dismissDisabled: isDismissDisabled,
          loading: toastState === "loading",
          requestDismiss,
        }}
      >
        <li
          {...props}
          ref={ref}
          aria-busy={toastState === "loading" ? true : undefined}
          className={getClassName("yoro-toast", className)}
          data-paused={paused ? "true" : undefined}
          data-state={toastState}
          data-tone={tone}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          role={role ?? (tone === "danger" || tone === "warning" ? "alert" : "status")}
          tabIndex={props.tabIndex ?? -1}
        >
          {children}
        </li>
      </ToastItemContext.Provider>
    );
  },
);

Toast.displayName = "Toast";

export function ToastTitle({ children, className, ...props }: ToastTitleProps) {
  return (
    <div {...props} className={getClassName("yoro-toast__title", className)}>
      {children}
    </div>
  );
}

export function ToastDescription({ children, className, ...props }: ToastDescriptionProps) {
  return (
    <p {...props} className={getClassName("yoro-toast__description", className)}>
      {children}
    </p>
  );
}

export const ToastAction = forwardRef<HTMLButtonElement, ToastActionProps>(
  ({ children, className, disabled = false, loading = false, type = "button", ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        {...props}
        ref={ref}
        aria-busy={loading ? true : undefined}
        aria-disabled={isDisabled ? true : undefined}
        className={getClassName("yoro-toast__action", className)}
        data-loading={loading ? "true" : undefined}
        disabled={isDisabled}
        type={type}
      >
        {children}
      </button>
    );
  },
);

ToastAction.displayName = "ToastAction";

export const ToastCloseButton = forwardRef<HTMLButtonElement, ToastCloseButtonProps>(
  ({ children, className, disabled = false, loading = false, onClick, type = "button", ...props }, ref) => {
    const context = useContext(ToastItemContext);
    const isDisabled = disabled || loading || context?.dismissDisabled || context?.loading || false;

    return (
      <button
        {...props}
        ref={ref}
        aria-busy={loading ? true : undefined}
        aria-disabled={isDisabled ? true : undefined}
        className={getClassName("yoro-toast__close-button", className)}
        data-loading={loading ? "true" : undefined}
        disabled={isDisabled}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
          if (!event.defaultPrevented) {
            context?.requestDismiss();
          }
        }}
        type={type}
      >
        {children}
      </button>
    );
  },
);

ToastCloseButton.displayName = "ToastCloseButton";
