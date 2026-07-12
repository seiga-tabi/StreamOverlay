import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type Dispatch,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type SetStateAction,
} from "react";
import "./Modal.css";

export type ModalSize = "sm" | "md" | "lg" | "fullscreen";

type ModalContextValue = {
  closeDisabled: boolean;
  defaultDescriptionId: string;
  defaultTitleId: string;
  loading: boolean;
  requestClose: () => void;
  setDescribedById: Dispatch<SetStateAction<string | undefined>>;
  setLabelledById: Dispatch<SetStateAction<string | undefined>>;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export type ModalProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "role"> & {
  children: ReactNode;
  open: boolean;
  closing?: boolean;
  closeDisabled?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  loading?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLElement>;
  size?: ModalSize;
};

type ModalSectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export type ModalTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4";
  children: ReactNode;
};

export type ModalDescriptionProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

export type ModalCloseButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children" | "disabled" | "type"
> & {
  "aria-label": string;
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  type?: "button";
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

function getModalId(id: string) {
  return `yoro-modal-${id.replace(/:/g, "")}`;
}

function getClassName(baseClassName: string, className?: string) {
  return [baseClassName, className].filter(Boolean).join(" ");
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    (ref as { current: T | null }).current = value;
  }
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );
}

function focusModalStart(container: HTMLElement, initialFocusRef?: RefObject<HTMLElement>) {
  const initialTarget = initialFocusRef?.current;
  if (initialTarget && container.contains(initialTarget)) {
    initialTarget.focus();
    return;
  }

  const [firstFocusable] = getFocusableElements(container);
  if (firstFocusable) {
    firstFocusable.focus();
    return;
  }

  container.focus();
}

function trapModalFocus(event: ReactKeyboardEvent<HTMLDivElement>, container: HTMLElement) {
  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (!activeElement || !container.contains(activeElement)) {
    event.preventDefault();
    firstFocusable?.focus();
    return;
  }

  if (event.shiftKey && activeElement === firstFocusable) {
    event.preventDefault();
    lastFocusable?.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastFocusable) {
    event.preventDefault();
    firstFocusable?.focus();
  }
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      children,
      className,
      closeDisabled = false,
      closeOnBackdrop = true,
      closeOnEscape = true,
      closing = false,
      initialFocusRef,
      loading = false,
      onClose,
      onKeyDown,
      onMouseDown,
      onOpenChange,
      open,
      returnFocusRef,
      size = "md",
      ...props
    },
    ref,
  ) => {
    const reactId = useId();
    const modalId = getModalId(reactId);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const [labelledById, setLabelledById] = useState<string | undefined>();
    const [describedById, setDescribedById] = useState<string | undefined>();
    const isRendered = open || closing;
    const isCloseDisabled = closeDisabled || loading;

    const requestClose = useCallback(() => {
      if (isCloseDisabled) {
        return;
      }
      onClose?.();
      onOpenChange?.(false);
    }, [isCloseDisabled, onClose, onOpenChange]);

    const contextValue = useMemo<ModalContextValue>(
      () => ({
        closeDisabled: isCloseDisabled,
        defaultDescriptionId: `${modalId}-description`,
        defaultTitleId: `${modalId}-title`,
        loading,
        requestClose,
        setDescribedById,
        setLabelledById,
      }),
      [isCloseDisabled, loading, modalId, requestClose],
    );

    const setDialogRef = useCallback(
      (node: HTMLDivElement | null) => {
        dialogRef.current = node;
        assignRef(ref, node);
      },
      [ref],
    );

    useEffect(() => {
      if (!open) {
        return undefined;
      }

      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      return () => {
        const target = returnFocusRef?.current ?? previousFocusRef.current;
        target?.focus();
      };
    }, [open, returnFocusRef]);

    useEffect(() => {
      if (!open || closing) {
        return undefined;
      }

      const frame = window.requestAnimationFrame(() => {
        if (dialogRef.current) {
          focusModalStart(dialogRef.current, initialFocusRef);
        }
      });

      return () => window.cancelAnimationFrame(frame);
    }, [closing, initialFocusRef, open]);

    if (!isRendered) {
      return null;
    }

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        requestClose();
        return;
      }

      if (dialogRef.current) {
        trapModalFocus(event, dialogRef.current);
      }
    };

    const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
      onMouseDown?.(event);
      if (event.defaultPrevented || !closeOnBackdrop || event.target !== event.currentTarget) {
        return;
      }
      requestClose();
    };

    return (
      <ModalContext.Provider value={contextValue}>
        <div
          {...props}
          className={getClassName("yoro-modal", className)}
          data-close-disabled={isCloseDisabled ? "true" : undefined}
          data-loading={loading ? "true" : undefined}
          data-size={size}
          data-state={closing ? "closing" : "open"}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
        >
          <div
            ref={setDialogRef}
            aria-busy={loading ? true : undefined}
            aria-describedby={describedById}
            aria-labelledby={labelledById}
            aria-modal="true"
            className="yoro-modal__dialog"
            role="dialog"
            tabIndex={-1}
          >
            {children}
          </div>
        </div>
      </ModalContext.Provider>
    );
  },
);

Modal.displayName = "Modal";

export function ModalHeader({ children, className, ...props }: ModalSectionProps) {
  return (
    <header {...props} className={getClassName("yoro-modal__header", className)}>
      {children}
    </header>
  );
}

export function ModalTitle({ as = "h2", children, className, id, ...props }: ModalTitleProps) {
  const context = useContext(ModalContext);
  const titleId = id ?? context?.defaultTitleId;
  const titleClassName = getClassName("yoro-modal__title", className);

  useEffect(() => {
    if (!context || !titleId) {
      return undefined;
    }

    context.setLabelledById(titleId);
    return () =>
      context.setLabelledById((currentTitleId) =>
        currentTitleId === titleId ? undefined : currentTitleId,
      );
  }, [context, titleId]);

  if (as === "h3") {
    return (
      <h3 {...props} className={titleClassName} id={titleId}>
        {children}
      </h3>
    );
  }

  if (as === "h4") {
    return (
      <h4 {...props} className={titleClassName} id={titleId}>
        {children}
      </h4>
    );
  }

  return (
    <h2 {...props} className={titleClassName} id={titleId}>
      {children}
    </h2>
  );
}

export function ModalDescription({
  children,
  className,
  id,
  ...props
}: ModalDescriptionProps) {
  const context = useContext(ModalContext);
  const descriptionId = id ?? context?.defaultDescriptionId;

  useEffect(() => {
    if (!context || !descriptionId) {
      return undefined;
    }

    context.setDescribedById(descriptionId);
    return () =>
      context.setDescribedById((currentDescriptionId) =>
        currentDescriptionId === descriptionId ? undefined : currentDescriptionId,
      );
  }, [context, descriptionId]);

  return (
    <p {...props} className={getClassName("yoro-modal__description", className)} id={descriptionId}>
      {children}
    </p>
  );
}

export function ModalContent({ children, className, ...props }: ModalSectionProps) {
  return (
    <div {...props} className={getClassName("yoro-modal__content", className)}>
      {children}
    </div>
  );
}

export function ModalFooter({ children, className, ...props }: ModalSectionProps) {
  return (
    <footer {...props} className={getClassName("yoro-modal__footer", className)}>
      {children}
    </footer>
  );
}

export const ModalCloseButton = forwardRef<HTMLButtonElement, ModalCloseButtonProps>(
  ({ children, className, disabled = false, loading = false, onClick, type = "button", ...props }, ref) => {
    const context = useContext(ModalContext);
    const isDisabled = disabled || loading || context?.closeDisabled || context?.loading || false;

    return (
      <button
        {...props}
        ref={ref}
        aria-busy={loading ? true : undefined}
        aria-disabled={isDisabled ? true : undefined}
        className={getClassName("yoro-modal__close-button", className)}
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
            context?.requestClose();
          }
        }}
        type={type}
      >
        {children}
      </button>
    );
  },
);

ModalCloseButton.displayName = "ModalCloseButton";
