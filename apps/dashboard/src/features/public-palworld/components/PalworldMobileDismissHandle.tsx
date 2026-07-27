import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

const DISMISS_DURATION_MS = 140;

type DragState = {
  dialog: HTMLElement;
  pointerId: number;
  startTime: number;
  startY: number;
};

function resetDialog(dialog: HTMLElement): void {
  dialog.classList.remove("is-sheet-dragging", "is-sheet-dismissing");
  dialog.style.setProperty("--palworld-sheet-drag-y", "0px");
}

export function PalworldMobileDismissHandle({
  locale,
  onDismiss,
}: {
  locale: PalworldLocale;
  onDismiss: () => void;
}) {
  const dragRef = useRef<DragState | null>(null);
  const distanceRef = useRef(0);
  const draggedRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = palworldI18n[locale].swipeDownToClose;

  useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  function releasePointer(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) return;
    const dialog = event.currentTarget.closest<HTMLElement>(".yoro-modal__dialog");
    if (!dialog) return;

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    resetDialog(dialog);
    dialog.classList.add("is-sheet-dragging");
    dragRef.current = {
      dialog,
      pointerId: event.pointerId,
      startTime: event.timeStamp,
      startY: event.clientY,
    };
    distanceRef.current = 0;
    draggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.max(0, event.clientY - drag.startY);
    distanceRef.current = distance;
    draggedRef.current = distance > 4;
    drag.dialog.style.setProperty("--palworld-sheet-drag-y", `${distance}px`);
    event.preventDefault();
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    releasePointer(event);

    const elapsed = Math.max(1, event.timeStamp - drag.startTime);
    const distance = distanceRef.current;
    const velocity = distance / elapsed;
    const threshold = Math.min(112, Math.max(72, drag.dialog.clientHeight * 0.14));
    const shouldDismiss = distance >= threshold || (distance >= 40 && velocity >= 0.65);
    drag.dialog.classList.remove("is-sheet-dragging");

    if (!shouldDismiss) {
      drag.dialog.style.setProperty("--palworld-sheet-drag-y", "0px");
      return;
    }

    draggedRef.current = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      onDismiss();
      return;
    }

    drag.dialog.classList.add("is-sheet-dismissing");
    drag.dialog.style.setProperty(
      "--palworld-sheet-drag-y",
      `${Math.max(drag.dialog.clientHeight, window.innerHeight)}px`,
    );
    dismissTimerRef.current = setTimeout(() => {
      dismissTimerRef.current = null;
      onDismiss();
    }, DISMISS_DURATION_MS);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    releasePointer(event);
    resetDialog(drag.dialog);
    draggedRef.current = false;
  }

  return (
    <button
      aria-label={label}
      className="palworld-mobile-dismiss-handle"
      data-ja={palworldI18n.ja.swipeDownToClose}
      data-ko={palworldI18n.ko.swipeDownToClose}
      data-testid="palworld-mobile-dismiss-handle"
      onClick={(event) => {
        if (draggedRef.current) {
          draggedRef.current = false;
          event.preventDefault();
          return;
        }
        if (event.detail === 0) onDismiss();
      }}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      title={label}
      type="button"
    >
      <span aria-hidden="true" />
    </button>
  );
}
