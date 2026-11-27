// Delete asks in a centred dialog; Cancel, Escape or the backdrop keep the campaign.
import type { GameState } from "../domain/types";
import type { GameSummary } from "../persistence/GameRepo";
import { summarizeCampaign } from "./campaignSummary";
import type { HomeContext } from "./context";
import { byId } from "./dom";

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Slides the deleted row out and closes the gap it leaves; instant with reduced motion. */
export async function animateRowOut(row: HTMLElement | null): Promise<void> {
  if (!row || reducedMotion() || typeof row.animate !== "function") return;
  const gap = parseFloat(getComputedStyle(row.parentElement ?? row).rowGap) || 0;
  row.style.overflow = "hidden";
  const leave = row.animate(
    [
      { opacity: 1, transform: "translateX(0)" },
      { opacity: 0, transform: "translateX(48px)" },
    ],
    { duration: 260, easing: "cubic-bezier(0.32, 0, 0.67, 0)", fill: "forwards" },
  );
  await leave.finished;
  const collapse = row.animate(
    [
      { height: `${row.offsetHeight}px`, paddingBlock: getComputedStyle(row).paddingBlock, marginBottom: "0px" },
      { height: "0px", paddingBlock: "0px", borderWidth: "0px", marginBottom: `${-gap}px` },
    ],
    { duration: 220, easing: "cubic-bezier(0.33, 1, 0.68, 1)", fill: "forwards" },
  );
  await collapse.finished;
}

export function deleteWarning(synced: boolean): string {
  return synced
    ? "Se borra en este dispositivo y en tu Google Drive."
    : "No se puede deshacer. Exportala antes si querés guardar una copia.";
}

/** Returns the function that asks; `onDeleted` runs after the list was redrawn. */
export function setUpDeleteDialog(
  ctx: HomeContext,
  onDeleted: () => void,
): (game: GameState | GameSummary) => void {
  const dialog = byId<HTMLDialogElement>("delete-dialog");
  const confirm = byId<HTMLButtonElement>("delete-confirm");
  const error = byId("delete-error");
  let deleting: GameState | GameSummary | null = null;

  byId("delete-cancel").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close(); // backdrop
  });
  dialog.addEventListener("close", () => (deleting = null));
  confirm.addEventListener("click", async () => {
    if (!deleting) return;
    confirm.disabled = true;
    const id = deleting.id;
    try {
      await ctx.repo.delete(id);
    } catch {
      error.hidden = false;
      confirm.disabled = false;
      return;
    }
    dialog.close();
    await animateRowOut(document.querySelector<HTMLElement>(`.save[data-id="${CSS.escape(id)}"]`));
    await ctx.refreshSafely();
    onDeleted();
  });

  return (game) => {
    const { name, subtitle, detail } = summarizeCampaign(game);
    deleting = game;
    byId("delete-title").textContent = `¿Borrar «${name}»?`;
    byId("delete-detail").textContent = [subtitle, detail].filter(Boolean).join(" · ");
    byId("delete-warning").textContent = deleteWarning(ctx.sync !== null);
    error.hidden = true;
    confirm.disabled = false;
    dialog.showModal();
    byId("delete-cancel").focus();
  };
}
