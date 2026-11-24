import { describe, expect, it } from "vitest";
import type { GameState } from "../src/domain/types";
import { levelUpOf } from "../src/game/levelUp";
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
    expect(levelUpOf(fighter(4), fighter(5))).toEqual({
      name: "Lira",
      level: 5,
      features: [],
      proficiencyBonus: null,
      subclass: null,
    }));

  it("an unknown class still levels up", () =>
    expect(levelUpOf(withClass(null, "Inventor", 1), withClass(null, "Inventor", 2))).toMatchObject({
      level: 2,
      features: [],
    }));
});
