import { describe, expect, it } from "vitest";
import { applyDeathSave } from "../src/domain/deathSaves";
import type { Character } from "../src/domain/types";
import { newGame } from "./helpers";

const dying = (successes = 0, failures = 0): Character => ({
  ...newGame().players[0]!,
  currentHp: 0,
  condition: "dying",
  deathSaves: { successes, failures },
});

describe("applyDeathSave", () => {
  it("leaves a character who is not dying alone", () => {
    const player = { ...dying(), condition: "ok" as const };
    expect(applyDeathSave(player, 5)).toBe(player);
    const stable = { ...dying(), condition: "stable" as const };
    expect(applyDeathSave(stable, 5)).toBe(stable);
  });

  it("a natural 20 brings them back with 1 HP", () => {
    const result = applyDeathSave(dying(1, 2), 20);
    expect(result).toMatchObject({ currentHp: 1, condition: "ok", deathSaves: { successes: 0, failures: 0 } });
  });

  it("a natural 1 counts as two failures", () => {
    expect(applyDeathSave(dying(0, 0), 1).deathSaves).toEqual({ successes: 0, failures: 2 });
  });

  it("10 to 19 is a success", () => {
    expect(applyDeathSave(dying(), 10).deathSaves).toEqual({ successes: 1, failures: 0 });
    expect(applyDeathSave(dying(), 19).deathSaves).toEqual({ successes: 1, failures: 0 });
  });

  it("2 to 9 is a failure", () => {
    expect(applyDeathSave(dying(), 2).deathSaves).toEqual({ successes: 0, failures: 1 });
    expect(applyDeathSave(dying(), 9).deathSaves).toEqual({ successes: 0, failures: 1 });
  });

  it("three successes stabilize and clear the saves", () => {
    const result = applyDeathSave(dying(2, 1), 12);
    expect(result).toMatchObject({ condition: "stable", currentHp: 0, deathSaves: { successes: 0, failures: 0 } });
  });

  it("three failures kill", () => {
    expect(applyDeathSave(dying(0, 2), 5)).toMatchObject({ condition: "dead", deathSaves: { failures: 3 } });
    expect(applyDeathSave(dying(0, 2), 1)).toMatchObject({ condition: "dead", deathSaves: { failures: 3 } });
  });
});
