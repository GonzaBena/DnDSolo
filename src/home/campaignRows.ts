// The home's list rows, built as DOM. Names come from the player and the
// model, so they always go in as text, never as HTML.
import { campaignHref, playHref } from "../campaign/links";
import type { GameState } from "../domain/types";
import { STATUS_TEXT, type DriveRow } from "../sync/driveImport";
import { summarizeCampaign } from "./campaignSummary";

export { campaignHref, playHref };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", "button", text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

/** A compact ✕ that still announces itself as "Borrar <name>". */
function deleteButton(name: string, onClick: () => void): HTMLButtonElement {
  const node = button("✕", onClick);
  node.classList.add("button--icon");
  node.setAttribute("aria-label", `Borrar ${name}`);
  node.title = "Borrar";
  return node;
}

/** A row of "Tus campañas" on the returning home: initials, name and a play link. */
export function campaignRow(game: GameState): HTMLLIElement {
  const summary = summarizeCampaign(game);
  const avatar = el("span", "campaign-row__avatar", summary.initials);
  avatar.setAttribute("aria-hidden", "true");
  const text = el("div");
  const sub = [summary.subtitle, summary.detail.split(" · ")[0]].filter(Boolean).join(" · ");
  text.append(el("strong", undefined, summary.name), el("small", undefined, sub));
  const play = el("a", "button button--small", "Jugar");
  play.href = playHref(game.id);
  const item = el("li", "campaign-row");
  item.append(avatar, text, play);
  return item;
}

export interface SaveRowActions {
  onExport(game: GameState): void;
  onDelete(game: GameState): void;
}

/** A row of "Ver todas": play, export and delete. */
export function saveRow(game: GameState, actions: SaveRowActions): HTMLLIElement {
  const { name, subtitle, detail } = summarizeCampaign(game);
  const text = el("div");
  text.append(el("strong", undefined, subtitle ? `${name}, ${subtitle}` : name), el("small", undefined, detail));
  const play = el("a", "button button--primary", "Jugar");
  play.href = playHref(game.id);
  const page = el("a", "button", "Ver campaña");
  page.href = campaignHref(game.id);
  const item = el("li", "save");
  item.dataset.id = game.id;
  item.append(
    text,
    play,
    page,
    button("Exportar", () => actions.onExport(game)),
    deleteButton(name, () => actions.onDelete(game)),
  );
  return item;
}

/** A campaign found in Drive, with how it compares to this device's copy. */
export function driveRow(row: DriveRow): HTMLLIElement {
  const text = el("div");
  text.append(
    el("strong", undefined, row.name),
    el("small", undefined, new Date(row.updatedAt).toLocaleDateString("es-AR")),
  );
  const item = el("li", "drive-row");
  item.dataset.status = row.status;
  item.append(text, el("span", "drive-row__status", STATUS_TEXT[row.status]));
  return item;
}
