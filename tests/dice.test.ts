import { describe, expect, it } from "vitest";
import { formatDice, rollDie, rollForEnemy } from "../src/domain/dice";
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

describe("rollForEnemy", () => {
  it("rolls every die separately and adds the modifier to the total", () => {
    const sequence = [0, 0.5, 0.999];
    let i = 0;
    const result = rollForEnemy(
      { die: "d6", count: 3, modifier: 2, reason: "Daño de la garra" },
      () => sequence[i++]!,
    );
    expect(result.values).toEqual([1, 4, 6]);
    expect(result.total).toBe(13);
    expect(result.reason).toBe("Daño de la garra");
  });

  it("handles negative modifiers", () => {
    const result = rollForEnemy({ die: "d20", count: 1, modifier: -1, reason: "x" }, () => 0.5);
    expect(result.total).toBe(10);
  });
});

describe("formatDice", () => {
  it("writes standard dice notation", () => {
    expect(formatDice({ die: "d20", count: 1 })).toBe("1d20");
    expect(formatDice({ die: "d6", count: 2, modifier: 3 })).toBe("2d6+3");
    expect(formatDice({ die: "d8", count: 1, modifier: -1 })).toBe("1d8-1");
    expect(formatDice({ die: "d8", count: 1, modifier: 0 })).toBe("1d8");
  });
});
