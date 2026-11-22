import { describe, expect, it } from "vitest";
import { migrateSave } from "../src/persistence/migrations";
import { statsFromForm } from "../src/domain/stats";
import { newGame } from "./helpers";

const stats = statsFromForm(20, 14, "human")!;
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
  it("treats a non-positive maximum as untracked instead of loading negative HP", () => {
    const bad = { ...stats, maxHp: 0 };
    const player = migrateSave(withPlayer({ stats: bad, currentHp: 0 }))?.players[0];
    expect(player?.stats).toBeNull();
    expect(player?.currentHp).toBeNull();
    expect(migrateSave(withPlayer({ stats: { ...stats, maxHp: -4 }, currentHp: null }))?.players[0]?.currentHp).toBeNull();
  });
  it("leaves a consistent save untouched", () => {
    expect(migrateSave(withPlayer({ stats, currentHp: 13 }))?.players[0]?.currentHp).toBe(13);
  });
});

describe("condition on load", () => {
  const stats = {
    maxHp: 20, armorClass: 14, initiative: 3, speed: 30, hitDice: "3d8",
    attacks: [], spellSaveDc: null, spellAttackBonus: null,
  };
  const load = (player: Record<string, unknown>) => {
    const game = newGame();
    return migrateSave({ ...game, players: [{ ...game.players[0]!, ...player }] })?.players[0];
  };

  it("a character with HP is up, whatever the save says", () => {
    expect(load({ stats, currentHp: 15, condition: "dying", deathSaves: { successes: 1, failures: 2 } })).toMatchObject({
      condition: "ok", deathSaves: { successes: 0, failures: 0 },
    });
  });

  it("an untracked character can't be dying", () => {
    expect(load({ stats: null, currentHp: 0, condition: "dying" })).toMatchObject({ currentHp: null, condition: "ok" });
  });

  it("a v10 save with HP below zero comes back dying", () => {
    const game = newGame();
    const { condition: _c, deathSaves: _d, milestonesSinceLevel: _m, ...legacy } = game.players[0]!;
    const migrated = migrateSave({ ...game, version: 10, players: [{ ...legacy, stats, currentHp: -3 }] });
    expect(migrated?.players[0]).toMatchObject({ currentHp: 0, condition: "dying" });
  });

  it("keeps the dead dead", () => {
    expect(load({ stats, currentHp: 0, condition: "dead", deathSaves: { successes: 0, failures: 3 } })?.condition).toBe("dead");
  });
});
