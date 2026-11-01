import { type ReactNode, useEffect, useRef } from "react";

/**
 * A bottom sheet on the native <dialog>: focus moves in, Escape and the
 * backdrop close it, and focus returns to the opener — the same contract the
 * share dialog already met, now shared by every sheet.
 */
export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    return () => opener?.focus?.();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Backdrop click closes; keyboard users already have Escape (onCancel).
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet-body">
        <div className="sheet-grab" aria-hidden="true" />
        {children}
      </div>
    </dialog>
  );
}
