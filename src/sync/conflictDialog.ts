import type { GameState } from "../domain/types";
import { downloadGame } from "../persistence/exportGame";
import { ConflictPendingError } from "./errors";
import type { ConflictChoice, SyncConflict } from "./SyncEngine";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "hace 2 h". Pure: `now` is passed in; a future time reads as "hace un momento". */
export function describeAgo(iso: string, now: number): string {
  const age = Math.max(0, now - new Date(iso).getTime());
  if (age < MINUTE) return "hace un momento";
  if (age < HOUR) return `hace ${Math.floor(age / MINUTE)} min`;
  if (age < DAY) return `hace ${Math.floor(age / HOUR)} h`;
  const days = Math.floor(age / DAY);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

/** "turno 42 · hace 2 h". Pure: `now` is passed in. */
export function describeVersion(state: GameState, now: number): string {
  return `turno ${state.turns.length} · ${describeAgo(state.updatedAt, now)}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Ids whose dialog was dismissed this page session: they are not asked again until an explicit user action. */
const dismissed = new Set<string>();

/** Call on an explicit user action (indicator click, "Sincronizar ahora") so dismissed conflicts ask again. */
export function clearDismissedConflicts(): void {
  dismissed.clear();
}

/** Wraps a resolver so a dismissed conflict is rejected at once instead of reopening on every sync. */
export function rememberDismissals(
  show: (c: SyncConflict) => Promise<ConflictChoice>,
): (c: SyncConflict) => Promise<ConflictChoice> {
  return async (conflict) => {
    if (dismissed.has(conflict.id)) throw new ConflictPendingError(`Conflict on ${conflict.id} left for later`);
    try {
      return await show(conflict);
    } catch (error) {
      if (error instanceof ConflictPendingError) dismissed.add(conflict.id);
      throw error;
    }
  };
}

/**
 * Asks which copy to keep. Always settles: a choice resolves, and any other
 * way of closing it (Escape, backdrop) rejects with ConflictPendingError, so
 * nothing is overwritten and the engine asks again on the next sync.
 */
export const showConflictDialog = rememberDismissals(askConflict);

function askConflict(conflict: SyncConflict): Promise<ConflictChoice> {
  return new Promise<ConflictChoice>((resolve, reject) => {
    const now = Date.now();
    const dialog = el("dialog", "sync-dialog");
    const panel = el("div", "sync-dialog__panel");
    const bothChanged = conflict.kind === "both_changed";
    const title = el(
      "h2",
      "sync-dialog__title",
      bothChanged ? "Esta campaña cambió en dos lugares" : "Esta campaña se borró en otro dispositivo",
    );
    dialog.setAttribute("aria-labelledby", "sync-dialog-title");
    title.id = "sync-dialog-title";
    panel.append(title);

    let settled = false;
    const choose = (choice: ConflictChoice | null) => {
      if (settled) return;
      settled = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      if (choice) resolve(choice);
      else reject(new ConflictPendingError(`Conflict on ${conflict.id} left for later`));
    };

    const row = (label: string, detail: string | null, button: string, choice: ConflictChoice, primary: boolean) => {
      const line = el("div", "sync-dialog__row");
      line.append(el("span", "sync-dialog__version", detail ? `${label} · ${detail}` : label));
      const action = el("button", primary ? "button button--primary" : "button", button);
      action.type = "button";
      action.addEventListener("click", () => choose(choice));
      line.append(action);
      panel.append(line);
    };

    if (bothChanged) {
      row("Este dispositivo", conflict.local && describeVersion(conflict.local, now), "Quedarme con esta", "local", true);
      row("Google Drive", conflict.remote && describeVersion(conflict.remote, now), "Usar la de Drive", "remote", false);
      panel.append(el("p", "sync-dialog__footer", "La otra versión se descarta."));
    } else {
      row("Este dispositivo", conflict.local && describeVersion(conflict.local, now), "Restaurarla", "local", true);
      row("Otro dispositivo", null, "Borrarla acá también", "remote", false);
    }

    const exports = el("p", "sync-dialog__footer");
    const exportLink = (text: string, game: GameState | null) => {
      if (!game) return;
      const link = el("button", "sync-dialog__link", text);
      link.type = "button";
      link.addEventListener("click", () => downloadGame(game));
      exports.append(link, " ");
    };
    exportLink("Exportar la de este dispositivo", conflict.local);
    if (bothChanged) exportLink("Exportar la de Drive", conflict.remote);
    if (exports.childNodes.length) panel.append(exports);

    dialog.append(panel);
    dialog.addEventListener("cancel", () => choose(null));
    dialog.addEventListener("close", () => choose(null));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) choose(null);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
