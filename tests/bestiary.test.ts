import { describe, expect, it } from "vitest";
import { bestiaryOf } from "../src/domain/bestiary";
import type { GameState, Npc } from "../src/domain/types";
import { newGame } from "./helpers";

function npc(name: string, extra: Partial<Npc> = {}): Npc {
  return {
    name,
    description: `${name} es alguien. Tiene más detalles.`,
    attitude: "neutral",
    present: false,
    voice: "",
    portrait: null,
    hp: null,
    maxHp: null,
    seen: true,
    ...extra,
  };
}
const withNpcs = (npcs: Npc[]): GameState => ({ ...newGame(), npcs });
const goblin = (name: string, hp: number | null, maxHp: number | null = 7) =>
  npc(name, { portrait: "goblin", attitude: "hostile", hp, maxHp: hp === null ? null : maxHp });

describe("bestiaryOf", () => {
  it("leaves out NPCs never seen and keeps the order of npcs; old saves without seen count", () => {
    const { seen: _drop, ...oldSave } = npc("Berta");
    const result = bestiaryOf(withNpcs([npc("Orvin"), npc("Rumor", { seen: false }), oldSave as Npc]));
    expect(result.people.map((e) => e.name)).toEqual(["Orvin", "Berta"]);
  });

  it("blurb is the first sentence; attitude and npc are kept", () => {
    const orvin = npc("Orvin", { attitude: "friendly" });
    const [entry] = bestiaryOf(withNpcs([orvin])).people;
    expect(entry).toMatchObject({ blurb: "Orvin es alguien.", attitude: "friendly", npc: orvin });
  });

  it("status is the health label, Derrotado at 0 HP, null without HP", () => {
    const result = bestiaryOf(
      withNpcs([npc("A", { hp: 10, maxHp: 10 }), npc("B", { hp: 3, maxHp: 10 }), npc("C", { hp: 0, maxHp: 10 }), npc("D")]),
    );
    expect(result.people.map((e) => e.status)).toEqual(["Ileso", "Malherido", "Derrotado", null]);
  });

  it("monsters without a proper name become one entry named after their kind", () => {
    const { monsters } = bestiaryOf(withNpcs([goblin("Goblin", 0), goblin("Goblin 2", 0), goblin("Goblin 3", 0)]));
    expect(monsters).toHaveLength(1);
    expect(monsters[0]).toMatchObject({ name: "Goblin", status: "Derrotado" });
  });

  it("a group not all defeated shows the best-off one's status", () => {
    const { monsters } = bestiaryOf(withNpcs([goblin("Goblin 1", 0), goblin("Goblin 2", 2), goblin("Goblin 3", 5)]));
    expect(monsters).toEqual([expect.objectContaining({ name: "Goblin", status: "Herido" })]);
  });

  it("a group with no HP tracked has no status", () => {
    const { monsters } = bestiaryOf(withNpcs([goblin("Lobo 1", null), goblin("Lobo 2", null)]));
    expect(monsters).toEqual([expect.objectContaining({ name: "Lobo", status: null })]);
  });

  it("a monster with a proper name is its own entry", () => {
    const { monsters } = bestiaryOf(withNpcs([goblin("Goblin", 0), goblin("Grishnak", 7), goblin("Goblin 2", 0)]));
    expect(monsters.map((e) => e.name)).toEqual(["Goblin", "Grishnak"]);
  });

  it("people are never grouped, and old portraits null go to people", () => {
    const result = bestiaryOf(withNpcs([npc("Guardia 1"), npc("Guardia 2")]));
    expect(result.people.map((e) => e.name)).toEqual(["Guardia 1", "Guardia 2"]);
    expect(result.monsters).toEqual([]);
  });
});
