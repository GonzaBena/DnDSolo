import { describe, expect, it } from "vitest";
import { initials } from "../src/game/NpcAvatar";

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Mateo Valen")).toBe("MV");
    expect(initials("ana de la cruz")).toBe("AD");
  });

  it("uses two letters of a single-word name", () => {
    expect(initials("Lira")).toBe("LI");
    expect(initials("DM")).toBe("DM");
  });

  it("copes with extra spaces and empty names", () => {
    expect(initials("  Mateo   Valen ")).toBe("MV");
    expect(initials("")).toBe("");
  });
});
