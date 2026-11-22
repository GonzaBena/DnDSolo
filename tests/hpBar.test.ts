import { describe, expect, it } from "vitest";
import { hpTone } from "../src/game/hpBar";

describe("hpTone", () => {
  it("is healthy above half", () => {
    expect(hpTone(11, 20)).toBe("healthy");
    expect(hpTone(20, 20)).toBe("healthy");
  });
  it("is hurt above a quarter, up to and including half", () => {
    expect(hpTone(10, 20)).toBe("hurt");
    expect(hpTone(6, 20)).toBe("hurt");
  });
  it("is critical at a quarter or below", () => {
    expect(hpTone(5, 20)).toBe("critical");
    expect(hpTone(0, 20)).toBe("critical");
  });
  it("is critical without a usable max", () => {
    expect(hpTone(0, 0)).toBe("critical");
  });
});
