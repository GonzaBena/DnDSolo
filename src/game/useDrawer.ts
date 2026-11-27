import { useEffect, useRef } from "react";
import { enterDrawer, leaveDrawer } from "../animations/motion";

/** Shared open/close behaviour of the side drawers: a native modal <dialog>
    that slides in, and slides out before it actually closes. */
export function useDrawer(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (panelRef.current) enterDrawer(panelRef.current);
    } else if (!open && dialog.open) {
      if (!panelRef.current) {
        dialog.close();
        return;
      }
      return leaveDrawer(panelRef.current, () => dialog.close());
    }
  }, [open]);

  const dialogProps = {
    ref: dialogRef,
    className: "drawer",
    // React passes a nested dialog's close and cancel (a picker opened from
    // the drawer) up to this one: only its own count.
    onClose: (event: { target: unknown; currentTarget: unknown }) => {
      if (event.target === event.currentTarget) onClose();
    },
    // Escape would close the dialog at once; let the parent close it so
    // the panel can slide out first.
    onCancel: (event: { target: unknown; currentTarget: unknown; preventDefault(): void }) => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      onClose();
    },
    // The dialog fills the screen; a click that lands on it rather than
    // on the panel is a click on the backdrop.
    onClick: (event: { target: unknown; currentTarget: unknown }) => {
      if (event.target === event.currentTarget) onClose();
    },
  };
  return { dialogProps, panelRef };
}
