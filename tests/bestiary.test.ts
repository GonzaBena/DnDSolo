import { describe, expect, it } from "vitest";
import { bestiaryOf, monsterAlbum } from "../src/domain/bestiary";
import { portraitUrl } from "../src/domain/portraits";
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

describe("monsterAlbum", () => {
  const kinds = (state: GameState) => monsterAlbum(state).slots.map((slot) => slot.kind);

  it("with no monsters met, every kind has its empty slot, named after the kind", () => {
    const album = monsterAlbum(withNpcs([]));
    expect(album).toMatchObject({ found: 0, total: 7 });
    expect(kinds(withNpcs([]))).toEqual(["goblin", "kobold", "wolf", "skeleton", "zombie", "drowned", "dragon"]);
    expect(album.slots.every((slot) => slot.entry === null)).toBe(true);
    expect(album.slots[0]).toMatchObject({ name: "Goblin", image: portraitUrl("goblin", "goblin") });
  });

  it("numbered goblins fill the goblin slot", () => {
    const album = monsterAlbum(withNpcs([goblin("Goblin 1", 0), goblin("Goblin 2", 0)]));
    expect(album.found).toBe(1);
    expect(album.slots[0]!.entry).toMatchObject({ name: "Goblin", status: "Derrotado" });
  });

  it("a named goblin gets its own slot after the goblins and doesn't count as a kind", () => {
    const album = monsterAlbum(withNpcs([goblin("Grishnak", 7), goblin("Goblin 2", 0)]));
    expect(album.found).toBe(1);
    expect(album.slots.slice(0, 2).map((slot) => slot.entry?.name)).toEqual(["Goblin", "Grishnak"]);
    expect(album.slots).toHaveLength(8);
  });

  it("when only a named one of a kind was met, it takes the kind's slot", () => {
    const album = monsterAlbum(withNpcs([goblin("Grishnak", 7)]));
    expect(album.found).toBe(1);
    expect(album.slots[0]!.entry?.name).toBe("Grishnak");
    expect(album.slots).toHaveLength(7);
  });

  it("keeps the catalog order whatever the order they were met in", () => {
    const state = withNpcs([npc("Escamagris", { portrait: "dragon" }), npc("Lobo 1", { portrait: "wolf" })]);
    expect(kinds(state)).toEqual(["goblin", "kobold", "wolf", "skeleton", "zombie", "drowned", "dragon"]);
    expect(monsterAlbum(state).found).toBe(2);
  });

  it("a monster only mentioned doesn't count as found", () => {
    expect(monsterAlbum(withNpcs([npc("Lobo", { portrait: "wolf", seen: false })])).found).toBe(0);
  });
});
