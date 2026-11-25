import { describe, expect, it } from "vitest";
import type { GameState } from "../src/domain/types";
import { enqueueLevelUp, levelUpFromPlayer, levelUpOf, viewForSubclass } from "../src/game/levelUp";
import { newGame } from "./helpers";

function withClass(classId: string | null, characterClass: string, level: number): GameState {
  const state = newGame();
  const [player, ...rest] = state.players;
  return { ...state, players: [{ ...player!, classId, characterClass, level }, ...rest] };
}
const fighter = (level: number) => withClass("fighter", "Guerrero", level);

describe("levelUpOf", () => {
  it("no level change, no level up", () => expect(levelUpOf(fighter(1), fighter(1))).toBeNull());

  it("level 2 fighter: the row's features, no bonus change, no subclass", () =>
    expect(levelUpOf(fighter(1), fighter(2))).toMatchObject({
      name: "Lira",
      level: 2,
      proficiencyBonus: null,
      subclass: null,
      features: [{ name: "Acción súbita" }, { name: "Mente táctica" }],
    }));

  it("level 3 names the subclass and adds its level-3 features", () => {
    const up = levelUpOf(fighter(2), fighter(3))!;
    expect(up.subclass).toBe("Campeón");
    expect(up.features.length).toBeGreaterThan(1);
  });

  it("a level with no data: just the level and the name", () =>
    expect(levelUpOf(fighter(10), fighter(11))).toEqual({
      playerId: fighter(11).players[0]!.id,
      name: "Lira",
      level: 11,
      features: [],
      proficiencyBonus: null,
      subclass: null,
      customSubclass: null,
    }));

  it("level 5 fighter: Extra Attack and the new proficiency bonus", () =>
    expect(levelUpOf(fighter(4), fighter(5))).toMatchObject({
      level: 5,
      proficiencyBonus: 3,
      features: [{ name: "Ataque adicional" }, { name: "Desplazamiento táctico" }],
    }));

  it("an unknown class still levels up", () =>
    expect(levelUpOf(withClass(null, "Inventor", 1), withClass(null, "Inventor", 2))).toMatchObject({
      level: 2,
      features: [],
    }));
});

describe("levelUpFromPlayer", () => {
  it("is what levelUpOf shows, from the player alone", () => {
    const player = fighter(4).players[0]!;
    expect(levelUpFromPlayer(player)).toEqual(levelUpOf(fighter(3), fighter(4)));
    expect(levelUpFromPlayer(player).playerId).toBe(player.id);
  });
});

describe("levelUpFromPlayer with a subclass from the manual", () => {
  it("no SRD subclass name or features, and the manual's name", () => {
    const player = { ...fighter(3).players[0]!, outsideSrd: { note: "", subclass: "Maestro de armas" } };
    const up = levelUpFromPlayer(player);
    expect(up.subclass).toBeNull();
    expect(up.customSubclass).toBe("Maestro de armas");
    expect(up.features.some((f) => f.name === "Crítico mejorado")).toBe(false);
    expect(up.features.some((f) => f.name.startsWith("Subclase de "))).toBe(false);
  });
});

describe("enqueueLevelUp", () => {
  it("two level ups of the same player before the screen opens become one, with both levels' features", () => {
    const three = levelUpOf(fighter(2), fighter(3))!;
    const four = levelUpOf(fighter(3), fighter(4))!;
    const queue = enqueueLevelUp([three], four);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.level).toBe(4);
    expect(queue[0]!.subclass).toBe("Campeón");
    const names = queue[0]!.features.map((f) => f.name);
    expect(names).toContain("Crítico mejorado");
    expect(names).toContain("Mejora de característica");
  });

  it("another player's level up queues apart", () => {
    const three = levelUpOf(fighter(2), fighter(3))!;
    expect(enqueueLevelUp([three], { ...three, playerId: "other" })).toHaveLength(2);
  });
});

describe("viewForSubclass", () => {
  const three = () => levelUpOf(fighter(2), fighter(3))!;

  it("undecided: no 'Subclase: X' line, features kept to help choose", () => {
    const view = viewForSubclass(three(), "fighter", "undecided");
    expect(view.subclass).toBeNull();
    expect(view.features.map((f) => f.name)).toContain("Crítico mejorado");
  });

  it("a subclass from the manual: no SRD subclass features nor the generic trait", () => {
    const view = viewForSubclass(three(), "fighter", { custom: "Maestro de armas" });
    expect(view.customSubclass).toBe("Maestro de armas");
    expect(view.subclass).toBeNull();
    const names = view.features.map((f) => f.name);
    expect(names).not.toContain("Crítico mejorado");
    expect(names.some((n) => n.startsWith("Subclase de "))).toBe(false);
  });

  it("the SRD one: as queued", () => expect(viewForSubclass(three(), "fighter", "srd")).toEqual(three()));
});
