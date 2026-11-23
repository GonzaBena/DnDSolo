// First connection to Drive: which local campaigns to keep, and the toast with what the sync moved.
import type { GameState } from "../domain/types";
import { enterToast, leaveToast } from "../animations/motion";
import { describeVersion } from "./conflictDialog";
import type { SyncSummary } from "./SyncEngine";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Se cargaron 3 campañas de tu Drive · se subieron 2". Pure, for the toast. */
export function describeSummary({ downloaded, uploaded }: SyncSummary): string {
  if (downloaded === 0 && uploaded === 0) return "Todo al día: no había campañas nuevas para cargar.";
  const parts: string[] = [];
  if (downloaded > 0) {
    parts.push(`${downloaded === 1 ? "Se cargó" : "Se cargaron"} ${plural(downloaded, "campaña", "campañas")} de tu Drive`);
  }
  if (uploaded > 0) {
    const verb = uploaded === 1 ? "se subió" : "se subieron";
    parts.push(downloaded > 0 ? `${verb} ${uploaded}` : `${verb[0]!.toUpperCase()}${verb.slice(1)} ${plural(uploaded, "campaña", "campañas")} a tu Drive`);
  }
  return parts.join(" · ") + ".";
}

/** "Aria, Mago nivel 3". Pure. */
export function describeHero(game: GameState): string {
  const player = game.players[0];
  return player ? `${player.name}, ${player.characterClass} nivel ${player.level}` : "Sin personaje";
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Lists this device's campaigns with a checkbox each (all checked). Resolves
 * with the ids to keep. Closing it any other way (Escape, backdrop) keeps
 * everything: nothing is deleted unless the player says so.
 */
export function askWhichToKeep(games: GameState[]): Promise<Set<string>> {
  const all = new Set(games.map((g) => g.id));
  if (games.length === 0) return Promise.resolve(all);
  return new Promise((resolve) => {
    const now = Date.now();
    const dialog = el("dialog", "sync-dialog");
    const form = el("form", "sync-dialog__panel");
    form.method = "dialog";
    const title = el("h2", "sync-dialog__title", "¿Qué campañas de este dispositivo querés conservar?");
    title.id = "sync-keep-title";
    dialog.setAttribute("aria-labelledby", title.id);
    form.append(title, el("p", "sync-dialog__footer", "Las marcadas se suben a tu Drive. Las que desmarques se borran de este dispositivo."));

    const list = el("div", "sync-keep__list");
    const boxes = games
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((game) => {
        const label = el("label", "sync-keep__item");
        const box = el("input");
        box.type = "checkbox";
        box.checked = true;
        box.value = game.id;
        const text = el("span", "sync-keep__text");
        text.append(el("strong", undefined, describeHero(game)), el("small", undefined, describeVersion(game, now)));
        label.append(box, text);
        list.append(label);
        return box;
      });
    form.append(list);

    const confirm = el("button", "button button--primary", "Continuar");
    confirm.type = "submit";
    const warning = el("p", "sync-dialog__footer");
    const refresh = () => {
      const dropped = boxes.filter((b) => !b.checked).length;
      warning.textContent = dropped ? `Se van a borrar ${plural(dropped, "campaña", "campañas")} de este dispositivo.` : "";
      confirm.textContent = dropped ? "Borrar las desmarcadas y continuar" : "Continuar";
    };
    list.addEventListener("change", refresh);
    const actions = el("div", "sync-dialog__row");
    actions.append(warning, confirm);
    form.append(actions);

    let settled = false;
    const finish = (keep: Set<string>) => {
      if (settled) return;
      settled = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(keep);
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      finish(new Set(boxes.filter((b) => b.checked).map((b) => b.value)));
    });
    dialog.addEventListener("cancel", () => finish(all));
    dialog.addEventListener("close", () => finish(all));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) finish(all);
    });

    dialog.append(form);
    document.body.append(dialog);
    dialog.showModal();
    confirm.focus();
  });
}

/** A small toast in the corner that goes away by itself. */
export function showSyncToast(text: string): void {
  let container = document.querySelector<HTMLElement>(".sync-toasts");
  if (!container) {
    container = el("div", "sync-toasts");
    document.body.append(container);
  }
  const toast = el("div", "sync-toast");
  toast.setAttribute("role", "status");
  toast.append(el("span", "sync-toast__icon", "☁️"), el("span", undefined, text));
  toast.querySelector(".sync-toast__icon")!.setAttribute("aria-hidden", "true");
  container.append(toast);
  enterToast(toast);
  setTimeout(() => leaveToast(toast, () => toast.remove()), 4800);
}
