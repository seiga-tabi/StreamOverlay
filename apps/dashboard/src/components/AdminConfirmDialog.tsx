import { useEffect, useRef, type ReactNode } from "react";

/* 되돌릴 수 없는 관리자 조작의 확인 단계.
 *
 * 지금까지 승인·거절은 버튼을 누르는 즉시 실행됐습니다. 오조작이 한 번의
 * 클릭이었고 사유도 남지 않았습니다. 확인을 한 단계 두고, 거절에는 사유를
 * 받아 신청자와 감사 기록 양쪽에 남깁니다.
 */

export type AdminConfirmTone = "primary" | "danger";

export function AdminConfirmDialog({
  title,
  description,
  summary,
  children,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel
}: {
  title: string;
  description: string;
  summary?: Array<{ label: string; value: string }>;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: AdminConfirmTone;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    /* 위험한 조작이므로 기본 초점을 "취소"에 둡니다.
       Enter 를 습관적으로 눌러 실행되는 사고를 막습니다. */
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div className="yoro-ac-backdrop">
      <div
        aria-describedby="yoro-ac-desc"
        aria-labelledby="yoro-ac-title"
        aria-modal="true"
        className="yoro-ac"
        ref={panelRef}
        role="dialog"
      >
        <h2 id="yoro-ac-title">{title}</h2>
        <p id="yoro-ac-desc">{description}</p>

        {summary && summary.length > 0 ? (
          <dl className="yoro-ac-summary">
            {summary.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {children}

        <div className="yoro-ac-actions">
          <button
            className="yoro-ac-button"
            disabled={busy}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`yoro-ac-button is-${tone}`}
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
