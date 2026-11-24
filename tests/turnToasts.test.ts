import { describe, expect, it } from "vitest";
import type { Arrival, GameState, Npc, Quest } from "../src/domain/types";
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

  it("no longer announces new NPCs with a toast", () => {
    const prev = { ...base, npcs: [npc("Bran")] };
    const next = { ...base, npcs: [npc("Bran"), npc("Mara")] };
    expect(buildTurnToasts(prev, next, [], 1)).toEqual([]);
  });

  const goblinArrival = {
    name: "Goblin 1",
    attitude: "hostile",
    portrait: null,
    blurb: "",
    returning: false,
    health: null,
  } as const;
  /** `state` after a turn whose stored arrivals are `arrivals`. */
  const afterTurn = (state: GameState, arrivals: Arrival[]): GameState => ({
    ...state,
    turns: [
      ...state.turns,
      { number: state.turns.length + 1, input: { type: "start" }, narration: "", events: [], arrivals },
    ],
  });

  it("skips the initiative toast when the new turn records hostile arrivals as combat starts", () => {
    const titles = buildTurnToasts(base, afterTurn(base, [goblinArrival]), ["combat_start"], 1).map((t) => t.title);
    expect(titles).not.toContain("¡Iniciativa!");
  });

  it("decides the ambush from the turn's stored arrivals, not from the npc list", () => {
    const next = { ...base, npcs: [{ ...npc("Goblin 1"), attitude: "hostile" as const }] };
    expect(buildTurnToasts(base, afterTurn(next, []), ["combat_start"], 1)).toMatchObject([{ title: "¡Iniciativa!" }]);
  });

  it("an ambush that ends in the same turn gets no end-of-combat toast", () => {
    const titles = buildTurnToasts(base, afterTurn(base, [goblinArrival]), ["combat_start", "combat_end"], 1).map(
      (t) => t.title,
    );
    expect(titles).not.toContain("Fin del combate");
  });

  it("keeps the initiative toast when combat starts with no one new", () => {
    expect(buildTurnToasts(base, base, ["combat_start"], 1)).toMatchObject([{ title: "¡Iniciativa!" }]);
  });

  it("an hp correction with present NPCs adds nothing about them", () => {
    const withMara = { ...base, npcs: [npc("Mara")] };
    expect(buildTurnToasts(withMara, withMara, [], 1)).toEqual([]);
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

  it("gives distinct, indexed ids to several toasts of the same kind", () => {
    const next = withInventory(base, [
      { name: "Antorcha", quantity: 1 },
      { name: "Cuerda", quantity: 1 },
    ]);
    const toasts = buildTurnToasts(base, next, [], 7);
    expect(toasts).toHaveLength(2);
    expect(toasts.map((t) => t.kind)).toEqual(["item", "item"]);
    expect(toasts.map((t) => t.id)).toEqual(["item-7-0", "item-7-1"]);
    expect(new Set(toasts.map((t) => t.id)).size).toBe(toasts.length);
  });
});

describe("tookDamage", () => {
  it("is true only for damage_taken", () => {
    expect(tookDamage(["damage_taken"])).toBe(true);
    expect(tookDamage(["damage_dealt", "healing"])).toBe(false);
  });
});

const stats = {
  maxHp: 20,
  armorClass: 16,
  initiative: 2,
  speed: 30,
  hitDice: "3d8",
  attacks: [],
  spellSaveDc: null,
  spellAttackBonus: null,
};

function withHp(state: GameState, currentHp: number): GameState {
  const [player, ...rest] = state.players;
  return { ...state, players: [{ ...player!, stats, currentHp }, ...rest] };
}

describe("hit point toasts", () => {
  const base = newGame();

  it("says exactly how many hit points were lost", () => {
    expect(buildTurnToasts(withHp(base, 20), withHp(base, 13), [], 1)).toMatchObject([
      { kind: "damage", title: "¡Daño recibido!", detail: "Perdiste 7 PG (13/20)." },
    ]);
  });

  it("says exactly how many hit points were recovered", () => {
    expect(buildTurnToasts(withHp(base, 13), withHp(base, 18), [], 1)).toMatchObject([
      { kind: "healing", title: "Recuperación", detail: "Recuperaste 5 PG (18/20)." },
    ]);
  });

  it("doesn't also fire the event toast, nor any toast without a change", () => {
    const hurt = buildTurnToasts(withHp(base, 20), withHp(base, 13), ["damage_taken"], 1);
    expect(hurt.map((t) => t.kind)).toEqual(["damage"]);
    expect(buildTurnToasts(withHp(base, 20), withHp(base, 20), ["damage_taken", "healing"], 1)).toEqual([]);
  });

  it("keeps the event toast when the sheet has no stats", () => {
    expect(buildTurnToasts(base, base, ["damage_taken"], 1)[0]).toMatchObject({
      detail: "Hubo un impacto en combate o peligro del entorno.",
    });
  });

  it("shakes on a real hit point drop", () => {
    expect(tookDamage([], withHp(base, 20), withHp(base, 13))).toBe(true);
    expect(tookDamage(["damage_taken"], withHp(base, 20), withHp(base, 20))).toBe(false);
    expect(tookDamage(["damage_taken"], base, base)).toBe(true);
  });
});
