import { describe, expect, it } from "vitest";
import { healthLabel } from "../src/domain/health";

describe("healthLabel", () => {
  it("cuts by the share of hit points left", () => {
    expect(healthLabel({ hp: 11, maxHp: 11 })).toBe("Ileso");
    expect(healthLabel({ hp: 6, maxHp: 11 })).toBe("Herido");
    expect(healthLabel({ hp: 5, maxHp: 11 })).toBe("Malherido");
    expect(healthLabel({ hp: 1, maxHp: 11 })).toBe("Malherido");
    expect(healthLabel({ hp: 0, maxHp: 11 })).toBe("Fuera de combate");
  });

  it("has nothing to say without hit points", () => {
    expect(healthLabel({ hp: null, maxHp: null })).toBeNull();
  });
});
