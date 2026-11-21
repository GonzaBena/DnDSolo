import { describe, expect, it } from "vitest";
import { applyStateChanges } from "../src/domain/applyChanges";
import { newGame, PLAYER_ID } from "./helpers";

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

  it("records an NPC's portrait and keeps it when a later change sends null", () => {
    const berta = { type: "npc", name: "Berta", description: "Posadera", attitude: "neutral", present: true, voice: "" } as const;
    const first = applyStateChanges(newGame(), [{ ...berta, portrait: "guard-male" }]).state;
    expect(first.npcs[0]!.portrait).toBe("guard-male");
    const later = applyStateChanges(first, [{ ...berta, present: false, portrait: null }]).state;
    expect(later.npcs[0]).toMatchObject({ present: false, portrait: "guard-male" });
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
    const game = newGame();
    const result = applyStateChanges(game, [{ type: "level", playerId: PLAYER_ID, level: 4 }]);
    expect(result.state.players[0]!.level).toBe(4);
    expect(result.rejected).toEqual([]);
  });

  it("rejects level jumps, repeats and levels above 20", () => {
    const game = newGame();
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
    const game = newGame(); // level 3
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
      const game = newGame();
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
