import { describe, expect, it } from "vitest";
import { resolveRoll, rollDie } from "../src/domain/dice";
import { DICE } from "../src/domain/types";

describe("rollDie", () => {
  it("maps the random range onto 1..sides for every die", () => {
    const sides = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };
    for (const die of DICE) {
      expect(rollDie(die, () => 0)).toBe(1);
      expect(rollDie(die, () => 0.999999)).toBe(sides[die]);
    }
  });

  it("is deterministic for a given random source", () => {
    expect(rollDie("d20", () => 0.5)).toBe(11);
    expect(rollDie("d6", () => 0.5)).toBe(4);
  });

  it("stays in range with the real random source", () => {
    for (let i = 0; i < 500; i += 1) {
      const value = rollDie("d20");
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(20);
    }
  });
});

describe("resolveRoll", () => {
  const request = { die: "d20", reason: "Sigilo", difficulty: 12 } as const;

  it("succeeds when the value meets the difficulty", () => {
    expect(resolveRoll(request, 12).success).toBe(true);
    expect(resolveRoll(request, 11).success).toBe(false);
  });

  it("has no verdict without a difficulty", () => {
    expect(resolveRoll({ ...request, difficulty: null }, 3).success).toBeNull();
  });
});
