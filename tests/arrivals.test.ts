import { describe, expect, it } from "vitest";
import {
  arrivalsAnnouncement,
  arrivalsOf,
  firstSentence,
  groupArrivals,
  isAmbush,
} from "../src/domain/arrivals";
import type { Arrival, GameState, Npc } from "../src/domain/types";
import { newGame } from "./helpers";

const npc = (name: string, overrides: Partial<Npc> = {}): Npc => ({
  name,
  description: "",
  attitude: "neutral",
  present: true,
  voice: "",
  portrait: null,
  hp: null,
  maxHp: null,
  ...overrides,
});

const withNpcs = (state: GameState, npcs: Npc[]): GameState => ({ ...state, npcs });

const arrival = (name: string, overrides: Partial<Arrival> = {}): Arrival => ({
  name,
  attitude: "hostile",
  portrait: null,
  blurb: "",
  returning: false,
  health: null,
  ...overrides,
});

describe("arrivalsOf", () => {
  const base = newGame();

  it("snapshots a new present NPC", () => {
    const next = withNpcs(base, [
      npc("Goblin 1", {
        attitude: "hostile",
        portrait: "goblin",
        description: "Pequeño y rápido. Huele mal.",
        hp: 7,
        maxHp: 7,
      }),
    ]);
    expect(arrivalsOf(base, next)).toEqual([
      {
        name: "Goblin 1",
        attitude: "hostile",
        portrait: "goblin",
        blurb: "Pequeño y rápido.",
        returning: false,
        health: null,
      },
    ]);
  });

  it("marks an NPC that was absent and is present again as returning, with its health", () => {
    const prev = withNpcs(base, [npc("Mateo", { present: false, hp: 3, maxHp: 10 })]);
    const next = withNpcs(base, [npc("Mateo", { present: true, hp: 3, maxHp: 10 })]);
    expect(arrivalsOf(prev, next)).toMatchObject([{ name: "Mateo", returning: true, health: "Malherido" }]);
  });

  it("ignores NPCs that were already present", () => {
    const state = withNpcs(base, [npc("Mateo")]);
    expect(arrivalsOf(state, state)).toEqual([]);
  });

  it("ignores a new NPC that is not present", () => {
    expect(arrivalsOf(base, withNpcs(base, [npc("Mateo", { present: false })]))).toEqual([]);
  });

  it("matches names ignoring case and spaces", () => {
    const prev = withNpcs(base, [npc("Goblin")]);
    const next = withNpcs(base, [npc(" goblin ")]);
    expect(arrivalsOf(prev, next)).toEqual([]);
  });

  it("keeps the order of the new state", () => {
    expect(arrivalsOf(base, withNpcs(base, [npc("B"), npc("A")])).map((a) => a.name)).toEqual(["B", "A"]);
  });
});

describe("firstSentence", () => {
  it("cuts at the first . ! or ? followed by space or end", () => {
    expect(firstSentence("Herrero del pueblo. Tiene un perro.")).toBe("Herrero del pueblo.");
    expect(firstSentence("¡Cuidado! Muerde.")).toBe("¡Cuidado!");
    expect(firstSentence("Sin punto final")).toBe("Sin punto final");
    expect(firstSentence("  ")).toBe("");
  });

  it("does not cut inside a number", () => {
    expect(firstSentence("Mide 1.80 de alto. Calvo.")).toBe("Mide 1.80 de alto.");
  });
});

describe("groupArrivals", () => {
  it("groups numbered names with the same attitude", () => {
    const a = [arrival("Goblin 1"), arrival("Goblin 2"), arrival("Goblin 3")];
    expect(groupArrivals(a)).toEqual([{ name: "Goblin", count: 3, lead: a[0] }]);
  });

  it("keeps a different attitude apart", () => {
    const a = [arrival("Goblin 1"), arrival("Goblin 2", { attitude: "friendly" })];
    expect(groupArrivals(a).map((g) => [g.name, g.count])).toEqual([
      ["Goblin 1", 1],
      ["Goblin 2", 1],
    ]);
  });

  it("never groups names without a trailing number", () => {
    expect(groupArrivals([arrival("Lobo"), arrival("Lobo gris")])).toHaveLength(2);
  });

  it("a single numbered arrival keeps its full name", () => {
    const goblin1 = arrival("Goblin 1");
    expect(groupArrivals([goblin1])).toEqual([{ name: "Goblin 1", count: 1, lead: goblin1 }]);
  });

  it("ten goblins and one wolf make two groups, in first-appearance order", () => {
    const goblins = Array.from({ length: 10 }, (_, i) => arrival(`Goblin ${i + 1}`));
    const a = [goblins[0]!, arrival("Lobo"), ...goblins.slice(1)];
    expect(groupArrivals(a).map((g) => [g.name, g.count])).toEqual([
      ["Goblin", 10],
      ["Lobo", 1],
    ]);
  });
});

describe("isAmbush", () => {
  const hostile = arrival("Goblin 1");
  const friendly = arrival("Mateo", { attitude: "friendly" });

  it("needs combat_start and a hostile arrival", () => {
    expect(isAmbush(["combat_start"], [hostile])).toBe(true);
    expect(isAmbush(["combat_start"], [friendly])).toBe(false);
    expect(isAmbush([], [hostile])).toBe(false);
    expect(isAmbush(["combat_start"], [])).toBe(false);
  });
});

describe("arrivalsAnnouncement", () => {
  it("names each group with its count and attitude", () => {
    expect(
      arrivalsAnnouncement([
        arrival("Goblin 1"),
        arrival("Goblin 2"),
        arrival("Goblin 3"),
        arrival("Mateo", { attitude: "friendly", returning: true }),
      ]),
    ).toBe("Aparece: Goblin ×3, hostil. Vuelve: Mateo, aliado.");
  });

  it("separates several groups in the same section", () => {
    expect(arrivalsAnnouncement([arrival("Goblin 1"), arrival("Lobo", { attitude: "neutral" })])).toBe(
      "Aparece: Goblin 1, hostil; Lobo, neutral.",
    );
  });

  it("is empty without arrivals", () => {
    expect(arrivalsAnnouncement([])).toBe("");
  });
});
