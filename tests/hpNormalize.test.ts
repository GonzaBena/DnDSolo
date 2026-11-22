import { describe, expect, it } from "vitest";
import { migrateSave } from "../src/persistence/migrations";
import { statsFromForm } from "../src/domain/stats";
import { newGame } from "./helpers";

const stats = statsFromForm(20, 14)!;
const withPlayer = (patch: Record<string, unknown>) => {
  const game = newGame();
  return { ...game, players: game.players.map((p) => ({ ...p, ...patch })) };
};

describe("save load hp normalization", () => {
  it("fills a missing current HP with the maximum", () => {
    expect(migrateSave(withPlayer({ stats, currentHp: null }))?.players[0]?.currentHp).toBe(20);
  });
  it("clamps current HP to 0..maxHp", () => {
    expect(migrateSave(withPlayer({ stats, currentHp: 99 }))?.players[0]?.currentHp).toBe(20);
    expect(migrateSave(withPlayer({ stats, currentHp: -5 }))?.players[0]?.currentHp).toBe(0);
  });
  it("drops current HP when there are no stats", () => {
    expect(migrateSave(withPlayer({ stats: null, currentHp: 7 }))?.players[0]?.currentHp).toBeNull();
  });
  it("leaves a consistent save untouched", () => {
    expect(migrateSave(withPlayer({ stats, currentHp: 13 }))?.players[0]?.currentHp).toBe(13);
  });
});
