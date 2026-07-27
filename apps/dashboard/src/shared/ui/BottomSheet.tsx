import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "./Modal";
import "./BottomSheet.css";

type BottomSheetPresence = "closed" | "opening" | "open" | "closing";

type BodyStyleSnapshot = {
  left: string;
  overflow: string;
  position: string;
  right: string;
  top: string;
  width: string;
};

let bodyScrollLockCount = 0;
let bodyStyleSnapshot: BodyStyleSnapshot | undefined;
let bodyScrollY = 0;

function lockBodyScroll(): () => void {
  if (bodyScrollLockCount === 0) {
    bodyScrollY = window.scrollY;
    bodyStyleSnapshot = {
      left: document.body.style.left,
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      right: document.body.style.right,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `${bodyScrollY * -1}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
  }
  bodyScrollLockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
    if (bodyScrollLockCount !== 0 || !bodyStyleSnapshot) return;

    const snapshot = bodyStyleSnapshot;
    bodyStyleSnapshot = undefined;
    document.body.style.position = snapshot.position;
    document.body.style.top = snapshot.top;
    document.body.style.left = snapshot.left;
    document.body.style.right = snapshot.right;
    document.body.style.width = snapshot.width;
    document.body.style.overflow = snapshot.overflow;
    window.scrollTo({ left: 0, top: bodyScrollY, behavior: "auto" });
  };
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BottomSheet({
  children,
  className,
  closeLabel,
  id,
  onClose,
  open,
  returnFocusRef,
  title,
}: {
  children: ReactNode;
  className?: string;
  closeLabel: string;
  id: string;
  onClose: () => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement>;
  title: ReactNode;
}) {
  const [presence, setPresence] = useState<BottomSheetPresence>(open ? "opening" : "closed");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fallbackTimerRef = useRef<number | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const rendered = presence !== "closed";

  const clearScheduledWork = useCallback(() => {
    if (fallbackTimerRef.current !== undefined) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = undefined;
    }
    if (frameRef.current !== undefined) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
  }, []);

  const finishPresence = useCallback((nextPresence: "open" | "closed") => {
    clearScheduledWork();
    setPresence(nextPresence);
  }, [clearScheduledWork]);

  useEffect(() => {
    clearScheduledWork();
    if (prefersReducedMotion()) {
      setPresence(open ? "open" : "closed");
      return undefined;
    }

    if (open) {
      setPresence((current) => current === "closed" || current === "closing" ? "opening" : current);
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = window.requestAnimationFrame(() => {
          setPresence((current) => current === "opening" ? "open" : current);
          fallbackTimerRef.current = window.setTimeout(() => finishPresence("open"), 440);
        });
      });
    } else {
      setPresence((current) => current === "closed" ? "closed" : "closing");
      fallbackTimerRef.current = window.setTimeout(() => finishPresence("closed"), 300);
    }

    return clearScheduledWork;
  }, [clearScheduledWork, finishPresence, open]);

  useEffect(() => {
    if (!rendered) return undefined;
    return lockBodyScroll();
  }, [rendered]);

  useEffect(() => {
    if (!rendered) return undefined;
    const handleResize = () => {
      if (window.innerWidth > 768) onClose();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [onClose, rendered]);

  useEffect(() => () => clearScheduledWork(), [clearScheduledWork]);

  if (!rendered) return null;

  const sheet = (
    <Modal
      className={["public-bottom-sheet", className].filter(Boolean).join(" ")}
      closing={presence === "closing"}
      data-sheet-state={presence}
      id={id}
      initialFocusRef={closeButtonRef}
      onClose={onClose}
      open
      returnFocusRef={returnFocusRef}
      size="sm"
    >
      <div
        className="public-bottom-sheet__surface"
        onTransitionEnd={(event) => {
          if (
            event.target !== event.currentTarget
            || event.propertyName !== "transform"
          ) return;
          if (presence === "closing") finishPresence("closed");
          if (presence === "opening") finishPresence("open");
        }}
      >
        <ModalHeader className="public-bottom-sheet__header">
          <ModalTitle>{title}</ModalTitle>
          <ModalCloseButton aria-label={closeLabel} ref={closeButtonRef}>
            ×
          </ModalCloseButton>
        </ModalHeader>
        <ModalContent className="public-bottom-sheet__content">
          {children}
        </ModalContent>
      </div>
    </Modal>
  );

  return typeof document === "undefined"
    ? sheet
    : createPortal(sheet, document.body);
}
