// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { GameState } from "../src/domain/types";
import { campaignRow, driveRow, playHref, saveRow } from "../src/home/campaignRows";
import { deleteWarning } from "../src/home/deleteDialog";
import { markMissing } from "../src/settings/apiSection";
import { newGame } from "./helpers";

const hostile = (): GameState => {
  const game = newGame();
  return { ...game, id: "a b&c", players: game.players.map((p) => ({ ...p, name: '<img src=x onerror="alert(1)">' })) };
};

describe("campaign rows", () => {
  it("put names in as text, never as HTML", () => {
    for (const row of [campaignRow(hostile()), saveRow(hostile(), { onExport() {}, onDelete() {} })]) {
      expect(row.querySelector("img")).toBeNull();
      expect(row.textContent).toContain('<img src=x onerror="alert(1)">');
    }
  });

  it("link to the game with its id encoded", () => {
    expect(playHref("a b&c")).toBe("/play?id=a%20b%26c");
    expect(campaignRow(hostile()).querySelector("a")!.getAttribute("href")).toBe("/play?id=a%20b%26c");
  });

  it("export and delete the row's campaign", () => {
    const game = newGame();
    const actions = { onExport: vi.fn(), onDelete: vi.fn() };
    const buttons = [...saveRow(game, actions).querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["Exportar", "Borrar"]);
    buttons[0]!.click();
    buttons[1]!.click();
    expect(actions.onExport).toHaveBeenCalledWith(game);
    expect(actions.onDelete).toHaveBeenCalledWith(game);
  });

  it("show how a Drive campaign compares with this device", () => {
    const row = driveRow({ id: "1", name: "<b>Lira</b>", status: "newer_remote", updatedAt: "2026-01-02T12:00:00Z" });
    expect(row.dataset.status).toBe("newer_remote");
    expect(row.querySelector("b")).toBeNull();
    expect(row.textContent).toContain("Hay una versión más nueva");
  });
});

describe("deleteWarning", () => {
  it("warns that a synced campaign also leaves Drive", () => {
    expect(deleteWarning(true)).toContain("Google Drive");
    expect(deleteWarning(false)).toContain("No se puede deshacer");
  });
});

describe("markMissing", () => {
  function form() {
    document.body.innerHTML = `
      <input id="key" value="">
      <select id="model"><option value="">Elegí</option><option value="m">M</option></select>
      <button id="load">Cargar modelos</button>`;
    return {
      key: document.querySelector<HTMLInputElement>("#key")!,
      model: document.querySelector<HTMLSelectElement>("#model")!,
      load: document.querySelector<HTMLButtonElement>("#load")!,
    };
  }

  it("marks the empty fields and focuses the first one", () => {
    const { key, model, load } = form();
    expect(markMissing([key, model], load)).toBe(false);
    expect(key.getAttribute("aria-invalid")).toBe("true");
    expect(model.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(key);
  });

  it("focuses the fallback when the first empty field is disabled", () => {
    const { key, model, load } = form();
    key.value = "secret";
    model.disabled = true;
    expect(markMissing([key, model], load)).toBe(false);
    expect(key.hasAttribute("aria-invalid")).toBe(false);
    expect(document.activeElement).toBe(load);
  });

  it("passes when everything is filled", () => {
    const { key, model, load } = form();
    key.value = "secret";
    model.value = "m";
    expect(markMissing([key, model], load)).toBe(true);
  });
});
