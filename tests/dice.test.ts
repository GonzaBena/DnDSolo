import { describe, expect, it } from "vitest";
import { describePlayerRoll, formatDice, naturalResult, resolveRollMode, rollDie, rollForEnemy } from "../src/domain/dice";
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
      { die: "d6", count: 3, modifier: 2, reason: "Daño de la garra", mode: "normal" },
      () => sequence[i++]!,
    );
    expect(result.values).toEqual([1, 4, 6]);
    expect(result.total).toBe(13);
    expect(result.reason).toBe("Daño de la garra");
  });

  it("rolls two d20 for an enemy with advantage and keeps the higher", () => {
    const seq = [0.1, 0.9]; // -> 3 and 19
    const result = rollForEnemy(
      { die: "d20", count: 1, modifier: 4, reason: "Ataque del goblin", mode: "advantage" },
      () => seq.shift()!,
    );
    expect(result.values).toEqual([3, 19]);
    expect(result.total).toBe(23);
  });

  it("keeps the lower die with disadvantage", () => {
    const seq = [0.1, 0.9];
    const result = rollForEnemy(
      { die: "d20", count: 1, modifier: 4, reason: "x", mode: "disadvantage" },
      () => seq.shift()!,
    );
    expect(result.total).toBe(7);
  });

  it("handles negative modifiers", () => {
    const result = rollForEnemy({ die: "d20", count: 1, modifier: -1, reason: "x", mode: "normal" }, () => 0.5);
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

describe("describePlayerRoll", () => {
  it("states the die, the modifier and the total", () => {
    expect(describePlayerRoll({ die: "d20", value: 14, modifier: 3 })).toBe("1d20: 14 + 3 = 17");
  });

  it("writes negative modifiers with a minus sign", () => {
    expect(describePlayerRoll({ die: "d8", value: 8, modifier: -1 })).toBe("1d8: 8 - 1 = 7");
  });

  it("counts several dice of the same kind", () => {
    expect(describePlayerRoll({ die: "d6", count: 2, value: 9, modifier: 2 })).toBe("2d6: 9 + 2 = 11");
  });

  it("omits a zero modifier", () => {
    expect(describePlayerRoll({ die: "d20", value: 17, modifier: 0 })).toBe("1d20: 17");
  });
});

describe("naturalResult", () => {
  it("spots a natural 20 and a natural 1 on a single d20", () => {
    expect(naturalResult({ die: "d20", value: 20 })).toBe("critical");
    expect(naturalResult({ die: "d20", value: 1 })).toBe("fumble");
    expect(naturalResult({ die: "d20", value: 12 })).toBeNull();
  });

  it("ignores other dice and several d20s", () => {
    expect(naturalResult({ die: "d12", value: 1 })).toBeNull();
    expect(naturalResult({ die: "d20", count: 2, value: 20 })).toBeNull();
  });

  it("tells the DM in the roll description", () => {
    expect(describePlayerRoll({ die: "d20", value: 20, modifier: 3 })).toBe(
      "1d20: 20 + 3 = 23 (20 natural: crítico)",
    );
    expect(describePlayerRoll({ die: "d20", value: 1, modifier: 0 })).toBe(
      "1d20: 1 (1 natural: pifia)",
    );
  });
});

describe("advantage and disadvantage", () => {
  it("advantage keeps the higher die, disadvantage the lower", () => {
    expect(resolveRollMode([7, 15], "advantage")).toBe(15);
    expect(resolveRollMode([7, 15], "disadvantage")).toBe(7);
  });

  it("a natural 20 counts only on the die that was kept", () => {
    expect(naturalResult({ die: "d20", count: 1, value: 20, mode: "advantage", rolls: [20, 3] })).toBe("critical");
    expect(naturalResult({ die: "d20", count: 1, value: 3, mode: "disadvantage", rolls: [20, 3] })).toBeNull();
  });

  it("describes both dice of an advantage roll", () => {
    expect(describePlayerRoll({ die: "d20", count: 1, value: 17, modifier: 3, mode: "advantage", rolls: [12, 17] })).toBe(
      "1d20 con ventaja (12 y 17, queda 17): 17 + 3 = 20",
    );
    expect(describePlayerRoll({ die: "d20", count: 1, value: 4, modifier: 0, mode: "disadvantage", rolls: [4, 18] })).toBe(
      "1d20 con desventaja (4 y 18, queda 4): 4",
    );
  });
});
