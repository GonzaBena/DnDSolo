import { describe, expect, it } from "vitest";
import { applyStateChanges } from "../src/domain/applyChanges";
import { createGame } from "../src/domain/character";
import { resourceStatusFor } from "../src/domain/resources";

function wizardAtLevel(level: number) {
  return createGame({
    name: "Nyx",
    speciesId: "elf",
    classId: "wizard",
    subclassId: null,
    srdBackgroundId: "sage",
    level,
    background: "",
  });
}

function fighterAtLevel(level: number) {
  return createGame({
    name: "Brann",
    speciesId: "human",
    classId: "fighter",
    subclassId: null,
    srdBackgroundId: "soldier",
    level,
    background: "",
  });
}

describe("resource and condition tracking", () => {
  it("spends and recovers spell slots clamped to the class level max", () => {
    const game = wizardAtLevel(3); // 4 level-1, 2 level-2 slots
    const pid = game.players[0]!.id;

    const afterCast = applyStateChanges(game, [
      { type: "resource", playerId: pid, kind: "slot", name: "Nivel 1", delta: -2 },
      { type: "resource", playerId: pid, kind: "slot", name: "2", delta: -5 }, // clamped to 2
    ]);
    expect(afterCast.rejected).toEqual([]);
    expect(afterCast.state.players[0]!.spentSlots).toEqual({ "1": 2, "2": 2 });
    expect(resourceStatusFor(afterCast.state.players[0]!).slots).toEqual([
      { key: "1", label: "Nivel 1", available: 2, max: 4 },
      { key: "2", label: "Nivel 2", available: 0, max: 2 },
    ]);

    const afterLong = applyStateChanges(afterCast.state, [{ type: "rest", kind: "long" }]);
    expect(afterLong.state.players[0]!.spentSlots).toEqual({});
  });

  it("recovers warlock pact slots and short-rest fighter features on a short rest", () => {
    const warlock = createGame({
      name: "Vex",
      speciesId: "tiefling",
      classId: "warlock",
      subclassId: null,
      srdBackgroundId: null,
      level: 2,
      background: "",
    });
    const wid = warlock.players[0]!.id;
    const spentWarlock = applyStateChanges(warlock, [
      { type: "resource", playerId: wid, kind: "slot", name: "pacto", delta: -2 },
    ]).state;
    expect(spentWarlock.players[0]!.spentSlots).toEqual({ pact: 2 });
    const restedWarlock = applyStateChanges(spentWarlock, [{ type: "rest", kind: "short" }]).state;
    expect(restedWarlock.players[0]!.spentSlots).toEqual({});

    const fighter = fighterAtLevel(2); // Tomar aliento (2), Acción súbita (1)
    const fid = fighter.players[0]!.id;
    const spentFighter = applyStateChanges(fighter, [
      { type: "resource", playerId: fid, kind: "feature", name: "Tomar aliento", delta: -2 },
      { type: "resource", playerId: fid, kind: "feature", name: "Acción súbita", delta: -1 },
    ]).state;
    const restedFighter = applyStateChanges(spentFighter, [{ type: "rest", kind: "short" }]).state;
    // Tomar aliento recovers 1 use on short rest; Acción súbita recovers all.
    expect(restedFighter.players[0]!.spentResources).toEqual({ "Tomar aliento": 1 });
  });

  it("tracks active conditions and replaces previous concentration spells", () => {
    const game = wizardAtLevel(3);
    const pid = game.players[0]!.id;
    const step1 = applyStateChanges(game, [
      { type: "condition", playerId: pid, condition: "Envenenado", active: true },
      { type: "condition", playerId: pid, condition: "Concentración: Armadura de mago", active: true },
    ]).state;
    expect(step1.players[0]!.activeConditions).toEqual(["Envenenado", "Concentración: Armadura de mago"]);

    const step2 = applyStateChanges(step1, [
      { type: "condition", playerId: pid, condition: "Concentración: Invisibilidad", active: true },
      { type: "condition", playerId: pid, condition: "Envenenado", active: false },
    ]).state;
    expect(step2.players[0]!.activeConditions).toEqual(["Concentración: Invisibilidad"]);

    const step3 = applyStateChanges(step2, [
      { type: "condition", playerId: pid, condition: "Concentración", active: false },
    ]).state;
    expect(step3.players[0]!.activeConditions).toEqual([]);
  });

  it("tracks hit dice spending and restores them on long rest", () => {
    const fighter = fighterAtLevel(3); // 3d10
    const fid = fighter.players[0]!.id;
    expect(resourceStatusFor(fighter.players[0]!).hitDice).toEqual({ available: 3, max: 3, die: "d10" });

    const spent = applyStateChanges(fighter, [
      { type: "resource", playerId: fid, kind: "hit_dice", name: "Dados de golpe", delta: -2 },
      { type: "rest", kind: "short" },
    ]).state;
    expect(spent.players[0]!.spentHitDice).toBe(2);
    expect(resourceStatusFor(spent.players[0]!).hitDice).toEqual({ available: 1, max: 3, die: "d10" });

    // Clamps to available max (3)
    const overspent = applyStateChanges(spent, [
      { type: "resource", playerId: fid, kind: "hit_dice", name: "Dados de golpe", delta: -5 },
    ]).state;
    expect(overspent.players[0]!.spentHitDice).toBe(3);

    const afterLong = applyStateChanges(overspent, [{ type: "rest", kind: "long" }]).state;
    expect(afterLong.players[0]!.spentHitDice).toBeUndefined();
    expect(resourceStatusFor(afterLong.players[0]!).hitDice).toEqual({ available: 3, max: 3, die: "d10" });
  });
});
