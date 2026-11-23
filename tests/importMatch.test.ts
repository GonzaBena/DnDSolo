import { describe, expect, it } from "vitest";
import type { GameState } from "../src/domain/types";
import { matchImport } from "../src/home/importMatch";

const game = (updatedAt: string) => ({ id: "g", updatedAt }) as GameState;

describe("matchImport", () => {
  it("is new when there is no campaign with that id", () => {
    expect(matchImport(game("2026-01-01"), null)).toBe("new");
  });
  it("is same for an identical save", () => {
    expect(matchImport(game("2026-01-01"), game("2026-01-01"))).toBe("same");
  });
  it("says which side is ahead", () => {
    expect(matchImport(game("2026-02-01"), game("2026-01-01"))).toBe("newer");
    expect(matchImport(game("2026-01-01"), game("2026-02-01"))).toBe("older");
  });
});
