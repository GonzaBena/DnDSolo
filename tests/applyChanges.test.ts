import { describe, expect, it } from "vitest";
import { applyStateChanges } from "../src/domain/applyChanges";
import { newGame, PLAYER_ID } from "./helpers";

/** A new game whose player has earned `count` milestones since their last level. */
function withMilestones(count: number) {
  const game = newGame();
  return { ...game, players: game.players.map((p) => ({ ...p, milestonesSinceLevel: count })) };
}

describe("applyStateChanges", () => {
  it("does not mutate the input state", () => {
    const game = newGame();
    const snapshot = structuredClone(game);
    applyStateChanges(game, [
      { type: "inventory_add", playerId: PLAYER_ID, item: "Daga", quantity: 1 },
      { type: "location", name: "Bosque", description: "Oscuro" },
    ]);
    expect(game).toEqual(snapshot);
  });

  it("stacks items regardless of case and removes them when they run out", () => {
    const game = newGame();
    const added = applyStateChanges(game, [
      { type: "inventory_add", playerId: PLAYER_ID, item: "Poción", quantity: 2 },
      { type: "inventory_add", playerId: PLAYER_ID, item: "poción", quantity: 1 },
    ]).state;
    expect(added.players[0]!.inventory).toEqual([{ name: "Poción", quantity: 3 }]);
    const used = applyStateChanges(added, [
      { type: "inventory_remove", playerId: PLAYER_ID, item: "Poción", quantity: 5 },
    ]);
    expect(used.state.players[0]!.inventory).toEqual([]);
    expect(used.rejected).toEqual([]);
  });

  it("rejects removing an item the player doesn't have and keeps going", () => {
    const result = applyStateChanges(newGame(), [
      { type: "inventory_remove", playerId: PLAYER_ID, item: "Espada", quantity: 1 },
      { type: "location", name: "Cripta", description: "Fría" },
    ]);
    expect(result.rejected).toHaveLength(1);
    expect(result.state.location.name).toBe("Cripta");
  });

  it("falls back to the only player when the id is wrong", () => {
    const result = applyStateChanges(newGame(), [
      { type: "inventory_add", playerId: "nope", item: "Daga", quantity: 1 },
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.state.players[0]!.inventory).toEqual([{ name: "Daga", quantity: 1 }]);
  });

  it("rejects an unknown id when there are several players", () => {
    const game = newGame();
    const two = { ...game, players: [...game.players, { ...game.players[0]!, id: "other" }] };
    const result = applyStateChanges(two, [
      { type: "inventory_add", playerId: "nope", item: "Daga", quantity: 1 },
    ]);
    expect(result.rejected).toHaveLength(1);
  });

  it("keeps the stored quest description when a closed quest is re-sent without one", () => {
    const game = newGame();
    const state = applyStateChanges(game, [
      { type: "quest", title: "El anillo", description: "Encontrarlo", status: "active" },
      { type: "quest", title: "El anillo", description: "  ", status: "completed" },
    ]).state;
    expect(state.quests).toEqual([
      { title: "El anillo", description: "Encontrarlo", status: "completed" },
    ]);
  });

  it("updates NPCs and quests in place instead of duplicating them", () => {
    const state = applyStateChanges(newGame(), [
      { type: "npc", name: "Berta", description: "Posadera", attitude: "neutral", present: true, voice: "", portrait: null },
      { type: "npc", name: "berta", description: "Posadera agradecida", attitude: "friendly", present: true, voice: "", portrait: null },
      { type: "quest", title: "El anillo", description: "Encontrarlo", status: "active" },
      { type: "quest", title: "El anillo", description: "Encontrarlo", status: "completed" },
    ]).state;
    expect(state.npcs).toHaveLength(1);
    expect(state.npcs[0]!.attitude).toBe("friendly");
    expect(state.quests).toEqual([
      { title: "El anillo", description: "Encontrarlo", status: "completed" },
    ]);
  });

  it("records how an NPC speaks and keeps it when a later change leaves it blank", () => {
    const berta = { type: "npc", name: "Berta", description: "Posadera", attitude: "neutral", present: true, portrait: null } as const;
    const first = applyStateChanges(newGame(), [{ ...berta, voice: "Seca, frases cortas" }]).state;
    expect(first.npcs[0]!.voice).toBe("Seca, frases cortas");
    const later = applyStateChanges(first, [{ ...berta, present: false, voice: "" }]).state;
    expect(later.npcs[0]).toMatchObject({ present: false, voice: "Seca, frases cortas" });
  });

  it("keeps the existing description when a later npc change sends it empty", () => {
    const berta = { type: "npc", name: "Berta", description: "Posadera", attitude: "neutral", present: true, voice: "", portrait: null } as const;
    const first = applyStateChanges(newGame(), [berta]).state;
    const back = applyStateChanges(first, [{ ...berta, description: "  " }]).state;
    expect(back.npcs[0]!.description).toBe("Posadera");
    const renewed = applyStateChanges(first, [{ ...berta, description: "Posadera cansada" }]).state;
    expect(renewed.npcs[0]!.description).toBe("Posadera cansada");
  });

  it("records an NPC's portrait and keeps it when a later change sends null", () => {
    const berta = { type: "npc", name: "Berta", description: "Posadera", attitude: "neutral", present: true, voice: "" } as const;
    const first = applyStateChanges(newGame(), [{ ...berta, portrait: "guard-male" }]).state;
    expect(first.npcs[0]!.portrait).toBe("guard-male");
    const later = applyStateChanges(first, [{ ...berta, present: false, portrait: null }]).state;
    expect(later.npcs[0]).toMatchObject({ present: false, portrait: "guard-male" });
  });

  it("keeps an NPC's face when a later change names another portrait", () => {
    const berta = { type: "npc", name: "Berta", description: "Posadera", attitude: "neutral", present: true, voice: "" } as const;
    const first = applyStateChanges(newGame(), [{ ...berta, portrait: "guard-female" }]).state;
    const later = applyStateChanges(first, [{ ...berta, portrait: "soldier-female" }]).state;
    expect(later.npcs[0]!.portrait).toBe("guard-female");
  });

  it("names an NPC called after their portrait archetype in Spanish", () => {
    const change = { type: "npc", name: "innkeeper-male", description: "", attitude: "neutral", present: true, voice: "", portrait: "innkeeper-male" } as const;
    const first = applyStateChanges(newGame(), [change]).state;
    const later = applyStateChanges(first, [{ ...change, present: false }]).state;
    expect(later.npcs).toHaveLength(1);
    expect(later.npcs[0]).toMatchObject({ name: "Tabernero", present: false });
  });

  it("gives a new NPC without a portrait null", () => {
    const change = { type: "npc", name: "Berta", description: "", attitude: "neutral", present: true, voice: "", portrait: null } as const;
    expect(applyStateChanges(newGame(), [change]).state.npcs[0]!.portrait).toBeNull();
  });

  describe("scene", () => {
    const goblin = (present = true) =>
      ({ type: "npc", name: "Goblin 1", description: "Flaco", attitude: "hostile", present, voice: "", portrait: null }) as const;

    it("starts a fight and hands the turn to someone in the scene, matching their name", () => {
      const { state, rejected } = applyStateChanges(newGame(), [
        goblin(),
        { type: "scene", inCombat: true, turnOf: "goblin 1" },
      ]);
      expect(rejected).toEqual([]);
      expect(state.scene).toEqual({ inCombat: true, turnOf: "Goblin 1" });
    });

    it("gives the turn back to the player when it names nobody in the scene", () => {
      const { state, rejected } = applyStateChanges(newGame(), [
        goblin(false),
        { type: "scene", inCombat: true, turnOf: "Goblin 1" },
      ]);
      expect(rejected).toHaveLength(1);
      expect(state.scene).toEqual({ inCombat: true, turnOf: null });
    });

    it("clears the scene on a new location, whatever order the changes come in", () => {
      const before = applyStateChanges(newGame(), [
        { type: "location", name: "Posada", description: "" },
        goblin(),
        { type: "scene", inCombat: false, turnOf: "Goblin 1" },
      ]).state;
      const after = applyStateChanges(before, [
        { type: "npc", name: "Berta", description: "Posadera", attitude: "friendly", present: true, voice: "", portrait: null },
        { type: "location", name: "Bosque", description: "" },
      ]).state;
      expect(after.npcs.map((n) => [n.name, n.present])).toEqual([
        ["Goblin 1", false],
        ["Berta", true],
      ]);
      expect(after.scene.turnOf).toBeNull();
    });

    it("keeps the scene when the location is only redescribed", () => {
      const before = applyStateChanges(newGame(), [
        { type: "location", name: "Posada", description: "" },
        goblin(),
      ]).state;
      const after = applyStateChanges(before, [
        { type: "location", name: "posada", description: "Llena de humo" },
      ]).state;
      expect(after.npcs[0]!.present).toBe(true);
    });
  });

  it("applies a level change of exactly +1", () => {
    const game = withMilestones(2);
    const result = applyStateChanges(game, [{ type: "level", playerId: PLAYER_ID, level: 4 }]);
    expect(result.state.players[0]!.level).toBe(4);
    expect(result.rejected).toEqual([]);
  });

  it("rejects level jumps, repeats and levels above 20", () => {
    const game = withMilestones(2);
    const jump = applyStateChanges(game, [{ type: "level", playerId: PLAYER_ID, level: 5 }]);
    expect(jump.state.players[0]!.level).toBe(3);
    expect(jump.rejected).toHaveLength(1);
    expect(jump.rejected[0]!.reason).toBe("Level changes go one at a time.");
    const same = applyStateChanges(game, [{ type: "level", playerId: PLAYER_ID, level: 3 }]);
    expect(same.rejected).toHaveLength(1);
    const maxed = { ...game, players: [{ ...game.players[0]!, level: 20 }] };
    const over = applyStateChanges(maxed, [{ type: "level", playerId: PLAYER_ID, level: 21 }]);
    expect(over.rejected).toHaveLength(1);
  });

  it("applies at most one level per player in a reply", () => {
    const game = withMilestones(2); // level 3
    const result = applyStateChanges(game, [
      { type: "level", playerId: PLAYER_ID, level: 4 },
      { type: "level", playerId: PLAYER_ID, level: 5 },
    ]);
    expect(result.state.players[0]!.level).toBe(4);
    expect(result.rejected).toEqual([
      { change: { type: "level", playerId: PLAYER_ID, level: 5 }, reason: "Level changes go one at a time." },
    ]);
  });

  describe("subclass", () => {
    // newGame() is a level 3 elf rogue without a subclass; the SRD rogue subclass is the Thief at level 3.
    const subclass = (subclassId: string) => ({ type: "subclass" as const, playerId: PLAYER_ID, subclassId });

    it("sets the SRD subclass of the player's class once its level is reached", () => {
      const result = applyStateChanges(newGame(), [subclass("thief")]);
      expect(result.rejected).toEqual([]);
      expect(result.state.players[0]!.subclassId).toBe("thief");
    });

    it("finds the class by its label when the save has no class id", () => {
      const game = newGame();
      const legacy = { ...game, players: [{ ...game.players[0]!, classId: null, characterClass: "Pícaro" }] };
      expect(applyStateChanges(legacy, [subclass("thief")]).state.players[0]!.subclassId).toBe("thief");
    });

    it("rejects another class's subclass, an unknown one and an unknown class", () => {
      const game = newGame();
      const other = applyStateChanges(game, [subclass("champion")]);
      expect(other.state.players[0]!.subclassId).toBeNull();
      expect(other.rejected[0]!.reason).toBe("That is not the SRD subclass of the player's class.");
      expect(applyStateChanges(game, [subclass("assassin")]).rejected).toHaveLength(1);
      const homebrew = { ...game, players: [{ ...game.players[0]!, classId: null, characterClass: "Artífice" }] };
      expect(applyStateChanges(homebrew, [subclass("thief")]).rejected).toHaveLength(1);
    });

    it("rejects it below the subclass level", () => {
      const game = newGame();
      const low = { ...game, players: [{ ...game.players[0]!, level: 2 }] };
      const result = applyStateChanges(low, [subclass("thief")]);
      expect(result.state.players[0]!.subclassId).toBeNull();
      expect(result.rejected[0]!.reason).toBe("The player hasn't reached the subclass level.");
    });

    it("accepts it right after a level change that reaches the subclass level", () => {
      const game = withMilestones(2);
      const low = { ...game, players: [{ ...game.players[0]!, level: 2 }] };
      const result = applyStateChanges(low, [{ type: "level", playerId: PLAYER_ID, level: 3 }, subclass("thief")]);
      expect(result.rejected).toEqual([]);
      expect(result.state.players[0]).toMatchObject({ level: 3, subclassId: "thief" });
    });

    it("rejects a second subclass and an unknown player", () => {
      const game = newGame();
      const chosen = { ...game, players: [{ ...game.players[0]!, subclassId: "thief" }] };
      expect(applyStateChanges(chosen, [subclass("thief")]).rejected[0]!.reason).toBe("The player already has a subclass.");
      const two = { ...game, players: [game.players[0]!, { ...game.players[0]!, id: "other" }] };
      expect(applyStateChanges(two, [{ ...subclass("thief"), playerId: "nobody" }]).rejected[0]!.reason).toBe("Unknown player.");
    });
  });
});

describe("story items", () => {
  const seen = (name: string, description = "") =>
    ({ type: "item", name, description, status: "available" }) as const;

  it("records an object within reach at the place the party ends up this turn", () => {
    const { state } = applyStateChanges(newGame(), [
      seen("Daga rúnica", "Brilla en la oscuridad"),
      { type: "location", name: "Cripta", description: "Fría" },
    ]);
    expect(state.storyItems).toEqual([
      { name: "Daga rúnica", description: "Brilla en la oscuridad", location: "Cripta", status: "available" },
    ]);
  });

  it("marks it taken when a player picks it up and gone when it runs out", () => {
    const { state: shown } = applyStateChanges(newGame(), [
      { type: "location", name: "Cripta", description: "Fría" },
      seen("Poción", "Roja"),
    ]);
    const { state: taken } = applyStateChanges(shown, [
      { type: "inventory_add", playerId: PLAYER_ID, item: "poción", quantity: 2 },
    ]);
    expect(taken.storyItems).toEqual([{ name: "Poción", description: "Roja", location: "Cripta", status: "taken" }]);
    const { state: used } = applyStateChanges(taken, [
      { type: "inventory_remove", playerId: PLAYER_ID, item: "Poción", quantity: 2 },
    ]);
    expect(used.storyItems[0]!.status).toBe("gone");
  });

  it("records items handed out without being announced first", () => {
    const { state } = applyStateChanges(newGame(), [
      { type: "location", name: "Posada", description: "" },
      { type: "inventory_add", playerId: PLAYER_ID, item: "Llave", quantity: 1 },
    ]);
    expect(state.storyItems).toEqual([{ name: "Llave", description: "", location: "Posada", status: "taken" }]);
  });

  it("keeps a carried item taken even if the DM says it is gone", () => {
    const { state: taken } = applyStateChanges(newGame(), [
      { type: "inventory_add", playerId: PLAYER_ID, item: "Llave", quantity: 1 },
    ]);
    const { state } = applyStateChanges(taken, [{ type: "item", name: "Llave", description: "", status: "gone" }]);
    expect(state.storyItems[0]!.status).toBe("taken");
  });

  it("leaves a dropped item where it was dropped, keeping its description", () => {
    const { state: taken } = applyStateChanges(newGame(), [
      seen("Escudo", "Abollado"),
      { type: "inventory_add", playerId: PLAYER_ID, item: "Escudo", quantity: 1 },
    ]);
    const { state } = applyStateChanges(taken, [
      { type: "location", name: "Puente", description: "" },
      { type: "inventory_remove", playerId: PLAYER_ID, item: "Escudo", quantity: 1 },
      seen("escudo"),
    ]);
    expect(state.storyItems).toEqual([{ name: "Escudo", description: "Abollado", location: "Puente", status: "available" }]);
  });
});

describe("hp changes", () => {
  const stats = {
    maxHp: 20, armorClass: 14, initiative: 3, speed: 30, hitDice: "3d8",
    attacks: [], spellSaveDc: null, spellAttackBonus: null,
  };
  const withHp = () => {
    const game = newGame();
    return { ...game, players: game.players.map((p) => ({ ...p, stats, currentHp: 20 })) };
  };

  it("applies damage by id", () => {
    const result = applyStateChanges(withHp(), [{ type: "hp", target: PLAYER_ID, delta: -7 }]);
    expect(result.state.players[0]!.currentHp).toBe(13);
    expect(result.rejected).toEqual([]);
  });

  it("clamps to 0 and to the maximum", () => {
    const dead = applyStateChanges(withHp(), [{ type: "hp", target: PLAYER_ID, delta: -50 }]).state;
    expect(dead.players[0]!.currentHp).toBe(0);
    const hurt = applyStateChanges(withHp(), [{ type: "hp", target: PLAYER_ID, delta: -7 }]).state;
    const healed = applyStateChanges(hurt, [{ type: "hp", target: PLAYER_ID, delta: 50 }]).state;
    expect(healed.players[0]!.currentHp).toBe(20);
  });

  it("keeps 0 on further damage and the maximum on further healing", () => {
    const dead = applyStateChanges(withHp(), [{ type: "hp", target: PLAYER_ID, delta: -50 }]).state;
    expect(applyStateChanges(dead, [{ type: "hp", target: PLAYER_ID, delta: -3 }]).state.players[0]!.currentHp).toBe(0);
    expect(applyStateChanges(withHp(), [{ type: "hp", target: PLAYER_ID, delta: 5 }]).state.players[0]!.currentHp).toBe(20);
  });

  it("resolves the target by name ignoring case", () => {
    const game = withHp();
    const two = { ...game, players: [...game.players, { ...game.players[0]!, id: "other", name: "Bruno" }] };
    const result = applyStateChanges(two, [{ type: "hp", target: "lIRA", delta: -2 }]);
    expect(result.state.players[0]!.currentHp).toBe(18);
    expect(result.state.players[1]!.currentHp).toBe(20);
  });

  it("falls back to the only player for an unknown target", () => {
    const result = applyStateChanges(withHp(), [{ type: "hp", target: "nadie", delta: -1 }]);
    expect(result.state.players[0]!.currentHp).toBe(19);
  });

  it("rejects an unknown target when there are several players", () => {
    const game = withHp();
    const two = { ...game, players: [...game.players, { ...game.players[0]!, id: "other", name: "Bruno" }] };
    const result = applyStateChanges(two, [{ type: "hp", target: "nadie", delta: -1 }]);
    expect(result.rejected).toHaveLength(1);
    expect(result.state).toEqual(two);
  });

  it("rejects a character without tracked hit points and leaves the state alone", () => {
    const game = newGame();
    const result = applyStateChanges(game, [{ type: "hp", target: PLAYER_ID, delta: -3 }]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.reason).toBe("That character has no hit points tracked.");
    expect(result.state).toEqual(game);
  });
});


describe("hp and the character's condition", () => {
  const stats = {
    maxHp: 20, armorClass: 14, initiative: 3, speed: 30, hitDice: "3d8",
    attacks: [], spellSaveDc: null, spellAttackBonus: null,
  };
  const at = (currentHp: number, condition: "ok" | "dying" | "stable" | "dead" = "ok", failures = 0) => {
    const game = newGame();
    return {
      ...game,
      players: game.players.map((p) => ({
        ...p, stats, currentHp, condition, deathSaves: { successes: 1, failures },
      })),
    };
  };
  const hp = (delta: number) => [{ type: "hp" as const, target: PLAYER_ID, delta }];

  it("drops to dying at 0 HP", () => {
    const player = applyStateChanges(at(5), hp(-20)).state.players[0]!;
    expect(player).toMatchObject({ currentHp: 0, condition: "dying" });
  });

  it("damage while dying is a failed save", () => {
    const player = applyStateChanges(at(0, "dying"), hp(-3)).state.players[0]!;
    expect(player).toMatchObject({ currentHp: 0, condition: "dying", deathSaves: { failures: 1 } });
  });

  it("damage while dying with two failures kills", () => {
    const player = applyStateChanges(at(0, "dying", 2), hp(-3)).state.players[0]!;
    expect(player).toMatchObject({ condition: "dead", deathSaves: { failures: 3 } });
  });

  it("damage while stable puts them back to dying with a failure", () => {
    const player = applyStateChanges(at(0, "stable"), hp(-3)).state.players[0]!;
    expect(player).toMatchObject({ condition: "dying", deathSaves: { failures: 1 } });
  });

  it("healing from 0 brings them back and clears the saves", () => {
    for (const condition of ["dying", "stable"] as const) {
      const player = applyStateChanges(at(0, condition, 2), hp(4)).state.players[0]!;
      expect(player).toMatchObject({ currentHp: 4, condition: "ok", deathSaves: { successes: 0, failures: 0 } });
    }
  });

  it("the dead stay dead", () => {
    const game = at(0, "dead", 3);
    const result = applyStateChanges(game, hp(10));
    expect(result.rejected[0]!.reason).toBe("The character is dead.");
    expect(result.state).toEqual(game);
  });
});

describe("milestones", () => {
  const quest = (status: "active" | "completed") => ({ type: "quest" as const, title: "El faro", description: "", status });
  const milestone = (reason = "Venció al jefe") => ({ type: "milestone" as const, playerId: PLAYER_ID, reason });
  const level = { type: "level" as const, playerId: PLAYER_ID, level: 4 };

  it("completing an active quest earns one, and only once", () => {
    const active = applyStateChanges(newGame(), [quest("active")]).state;
    const done = applyStateChanges(active, [quest("completed")]).state;
    expect(done.players[0]!.milestonesSinceLevel).toBe(1);
    const again = applyStateChanges(done, [quest("completed")]).state;
    expect(again.players[0]!.milestonesSinceLevel).toBe(1);
  });

  it("applies one milestone per reply", () => {
    const result = applyStateChanges(newGame(), [milestone(), milestone("Otro")]);
    expect(result.state.players[0]!.milestonesSinceLevel).toBe(1);
    expect(result.rejected).toEqual([{ change: milestone("Otro"), reason: "One milestone per reply." }]);
  });

  it("a level needs two milestones and spends them", () => {
    const short = applyStateChanges(withMilestones(1), [level]);
    expect(short.state.players[0]!.level).toBe(3);
    expect(short.rejected[0]!.reason).toBe("Not enough milestones for a new level.");
    const ready = applyStateChanges(withMilestones(2), [level]);
    expect(ready.state.players[0]).toMatchObject({ level: 4, milestonesSinceLevel: 0 });
  });

  it("a quest completed in the same reply counts toward the level", () => {
    const game = withMilestones(1);
    const active = { ...game, quests: [{ title: "El faro", description: "Encenderlo", status: "active" as const }] };
    const result = applyStateChanges(active, [quest("completed"), level]);
    expect(result.rejected).toEqual([]);
    expect(result.state.players[0]).toMatchObject({ level: 4, milestonesSinceLevel: 0 });
  });
});
