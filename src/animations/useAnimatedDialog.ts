import { useEffect, useRef, type RefObject } from "react";
import { enterRollDialog, leaveRollDialog } from "./motion";

/** Opens and closes a modal <dialog> the way the roll dialog does: it grows
    out of `originRef` (the button that opened it) and drops away on close.
    Escape is turned into `onClose`, so the parent's state stays the source
    of truth and the dialog can animate out before it really closes. */
export function useAnimatedDialog(open: boolean, onClose: () => void, originRef?: RefObject<Element | null>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      enterRollDialog(dialog, originRef?.current ?? null);
    } else if (!open && dialog.open) {
      return leaveRollDialog(dialog, "cancelled", null, () => dialog.close());
    }
  }, [open, originRef]);

  const dialogProps = {
    ref: dialogRef,
    onCancel: (event: { target: unknown; currentTarget: unknown; preventDefault(): void; stopPropagation(): void }) => {
      // React passes it on to an enclosing dialog (the drawer): stop it here.
      event.stopPropagation();
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      onClose();
    },
    onClose: (event: { stopPropagation(): void }) => event.stopPropagation(),
    onClick: (event: { target: unknown; currentTarget: unknown }) => {
      if (event.target === event.currentTarget) onClose();
    },
  };
  return dialogProps;
}
