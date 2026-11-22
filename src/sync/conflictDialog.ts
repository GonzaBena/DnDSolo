import type { GameState } from "../domain/types";
import { downloadGame } from "../persistence/exportGame";
import { ConflictPendingError } from "./errors";
import type { ConflictChoice, SyncConflict } from "./SyncEngine";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "turno 42 · hace 2 h". Pure: `now` is passed in. */
export function describeVersion(state: GameState, now: number): string {
  const age = Math.max(0, now - new Date(state.updatedAt).getTime());
  let when: string;
  if (age < MINUTE) when = "hace un momento";
  else if (age < HOUR) when = `hace ${Math.floor(age / MINUTE)} min`;
  else if (age < DAY) when = `hace ${Math.floor(age / HOUR)} h`;
  else {
    const days = Math.floor(age / DAY);
    when = `hace ${days} ${days === 1 ? "día" : "días"}`;
  }
  return `turno ${state.turns.length} · ${when}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Asks which copy to keep. Always settles: a choice resolves, and any other
 * way of closing it (Escape, backdrop) rejects with ConflictPendingError, so
 * nothing is overwritten and the engine asks again on the next sync.
 */
export function showConflictDialog(conflict: SyncConflict): Promise<ConflictChoice> {
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

    // The export link offers the copy that would be discarded by the side the player is leaning to.
    let leaning: ConflictChoice = "local";
    const row = (label: string, detail: string | null, button: string, choice: ConflictChoice, primary: boolean) => {
      const line = el("div", "sync-dialog__row");
      line.append(el("span", "sync-dialog__version", detail ? `${label} · ${detail}` : label));
      const action = el("button", primary ? "button button--primary" : "button", button);
      action.type = "button";
      action.addEventListener("click", () => choose(choice));
      for (const event of ["pointerenter", "focus"]) action.addEventListener(event, () => (leaning = choice));
      line.append(action);
      panel.append(line);
    };

    if (bothChanged) {
      row("Este dispositivo", conflict.local && describeVersion(conflict.local, now), "Quedarme con esta", "local", true);
      row("Google Drive", conflict.remote && describeVersion(conflict.remote, now), "Usar la de Drive", "remote", false);
      const footer = el("p", "sync-dialog__footer", "La otra versión se descarta. ");
      const link = el("button", "sync-dialog__link", "Exportar la otra versión");
      link.type = "button";
      link.addEventListener("click", () => {
        const discarded = leaning === "local" ? conflict.remote : conflict.local;
        if (discarded) downloadGame(discarded);
      });
      footer.append(link);
      panel.append(footer);
    } else {
      row("Este dispositivo", conflict.local && describeVersion(conflict.local, now), "Restaurarla", "local", true);
      row("Otro dispositivo", null, "Borrarla acá también", "remote", false);
    }

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
