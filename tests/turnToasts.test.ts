import { describe, expect, it } from "vitest";
import type { GameState, Npc, Quest } from "../src/domain/types";
import { buildTurnToasts, tookDamage } from "../src/game/turnToasts";
import { newGame } from "./helpers";

function withInventory(state: GameState, inventory: { name: string; quantity: number }[]): GameState {
  const [player, ...rest] = state.players;
  return { ...state, players: [{ ...player, inventory }, ...rest] };
}

function withLevel(state: GameState, level: number): GameState {
  const [player, ...rest] = state.players;
  return { ...state, players: [{ ...player, level }, ...rest] };
}

const quest = (title: string, status: Quest["status"]): Quest => ({ title, description: "", status });
const npc = (name: string): Npc => ({
  name,
  description: "",
  attitude: "neutral",
  present: true,
  voice: "",
}) as Npc;

describe("buildTurnToasts", () => {
  const base = newGame();

  it("announces an item that appears in the inventory", () => {
    const next = withInventory(base, [{ name: "Antorcha", quantity: 2 }]);
    expect(buildTurnToasts(base, next, [], 1)).toMatchObject([
      { kind: "item", title: "Objeto obtenido", detail: "Antorcha ×2" },
    ]);
  });

  it("announces only the gained amount when a stack grows", () => {
    const prev = withInventory(base, [{ name: "Flecha", quantity: 5 }]);
    const next = withInventory(base, [{ name: "flecha", quantity: 8 }]);
    expect(buildTurnToasts(prev, next, [], 1)).toMatchObject([
      { title: "Objeto obtenido", detail: "flecha ×3" },
    ]);
  });

  it("announces an item that drops in quantity or disappears", () => {
    const prev = withInventory(base, [
      { name: "Flecha", quantity: 5 },
      { name: "Soga", quantity: 1 },
    ]);
    const next = withInventory(base, [{ name: "Flecha", quantity: 3 }]);
    expect(buildTurnToasts(prev, next, [], 1)).toMatchObject([
      { kind: "item", title: "Objeto usado o perdido", detail: "Flecha ×2" },
      { kind: "item", title: "Objeto usado o perdido", detail: "Soga" },
    ]);
  });

  it("shows no item toast when a rejected removal left the inventory equal", () => {
    const prev = withInventory(base, [{ name: "Soga", quantity: 1 }]);
    const next = withInventory(base, [{ name: "Soga", quantity: 1 }]);
    expect(buildTurnToasts(prev, next, ["item_gained"], 1)).toEqual([]);
  });

  it("announces a level change, not a level_up event alone", () => {
    expect(buildTurnToasts(withLevel(base, 3), withLevel(base, 4), [], 1)).toMatchObject([
      { kind: "level", title: "¡Subiste de nivel!" },
    ]);
    expect(buildTurnToasts(base, base, ["level_up"], 1)).toEqual([]);
  });

  it("announces completed and new quests", () => {
    const prev = { ...base, quests: [quest("Ruta", "active")] };
    const next = { ...base, quests: [quest("Ruta", "completed"), quest("Nueva", "active")] };
    expect(buildTurnToasts(prev, next, [], 1)).toMatchObject([
      { kind: "quest", title: "¡Misión completada!", detail: "Ruta" },
      { kind: "quest", title: "Nueva misión", detail: "Nueva" },
    ]);
  });

  it("announces an npc that was not known before", () => {
    const prev = { ...base, npcs: [npc("Bran")] };
    const next = { ...base, npcs: [npc("Bran"), npc("Mara")] };
    expect(buildTurnToasts(prev, next, [], 1)).toMatchObject([
      { kind: "npc", title: "Nuevo personaje", detail: "Mara está presente en la historia." },
    ]);
  });

  it("toasts damage taken but not damage dealt", () => {
    expect(buildTurnToasts(base, base, ["damage_taken"], 1).map((t) => t.kind)).toEqual(["damage"]);
    expect(buildTurnToasts(base, base, ["damage_dealt"], 1)).toEqual([]);
  });

  it("keeps healing and combat toasts from events", () => {
    const kinds = buildTurnToasts(base, base, ["healing", "combat_start"], 1).map((t) => t.kind);
    expect(kinds).toEqual(["healing", "combat"]);
    expect(buildTurnToasts(base, base, ["combat_end"], 1).map((t) => t.title)).toEqual(["Fin del combate"]);
  });

  it("gives distinct ids to same-named items in one turn", () => {
    const next = withInventory(base, [
      { name: "Antorcha", quantity: 1 },
      { name: "antorcha", quantity: 1 },
    ]);
    const ids = buildTurnToasts(base, next, ["damage_taken"], 7).map((t) => t.id);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("tookDamage", () => {
  it("is true only for damage_taken", () => {
    expect(tookDamage(["damage_taken"])).toBe(true);
    expect(tookDamage(["damage_dealt", "healing"])).toBe(false);
  });
});
