import { describe, expect, it } from "vitest";
import { sameName, samePlace } from "../src/domain/names";

describe("sameName", () => {
  it("ignores case and surrounding spaces", () => {
    expect(sameName(" Goblin ", "goblin")).toBe(true);
    expect(sameName("Goblin", "Goblin 2")).toBe(false);
  });
});

describe("samePlace", () => {
  it("also ignores repeated spaces and accents", () => {
    expect(samePlace("La  Posada", "la posada")).toBe(true);
    expect(samePlace("Cienaga", "Ciénaga ")).toBe(true);
    expect(samePlace("Taberna", "Calle")).toBe(false);
  });
});
