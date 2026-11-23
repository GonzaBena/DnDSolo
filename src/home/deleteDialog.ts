// Delete asks in a centred dialog; Cancel, Escape or the backdrop keep the campaign.
import type { GameState } from "../domain/types";
import { summarizeCampaign } from "./campaignSummary";
import type { HomeContext } from "./context";
import { byId } from "./dom";

export function deleteWarning(synced: boolean): string {
  return synced
    ? "Se borra en este dispositivo y en tu Google Drive."
    : "No se puede deshacer. Exportala antes si querés guardar una copia.";
}

/** Returns the function that asks; `onDeleted` runs after the list was redrawn. */
export function setUpDeleteDialog(ctx: HomeContext, onDeleted: () => void): (game: GameState) => void {
  const dialog = byId<HTMLDialogElement>("delete-dialog");
  const confirm = byId<HTMLButtonElement>("delete-confirm");
  const error = byId("delete-error");
  let deleting: GameState | null = null;

  byId("delete-cancel").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close(); // backdrop
  });
  dialog.addEventListener("close", () => (deleting = null));
  confirm.addEventListener("click", async () => {
    if (!deleting) return;
    confirm.disabled = true;
    try {
      await ctx.repo.delete(deleting.id);
      await ctx.refresh();
      dialog.close();
      onDeleted();
    } catch {
      error.hidden = false;
      confirm.disabled = false;
    }
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
