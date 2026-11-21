import "fake-indexeddb/auto";
import { GAME_STATE_VERSION } from "../src/domain/types";
import { describe, expect, it } from "vitest";
import { TurnEngine } from "../src/engine/TurnEngine";
import { FakeLLMClient } from "../src/llm/FakeLLMClient";
import { IndexedDBGameRepo } from "../src/persistence/IndexedDBGameRepo";
import { newGame, reply } from "./helpers";

describe("IndexedDBGameRepo", () => {
  it("round-trips a game and returns null for unknown ids", async () => {
    const repo = new IndexedDBGameRepo();
    const game = { ...newGame(), id: "round-trip" };
    await repo.save(game);
    expect(await repo.load("round-trip")).toEqual(game);
    expect(await repo.load("missing")).toBeNull();
  });

  it("loadLatest returns the most recently updated game", async () => {
    const repo = new IndexedDBGameRepo();
    await repo.save({ ...newGame(), id: "old", updatedAt: "2030-01-01T00:00:00.000Z" });
    await repo.save({ ...newGame(), id: "new", updatedAt: "2030-06-01T00:00:00.000Z" });
    await repo.save({ ...newGame(), id: "mid", updatedAt: "2030-03-01T00:00:00.000Z" });
    expect((await repo.loadLatest())!.id).toBe("new");

    await repo.delete("new");
    expect((await repo.loadLatest())!.id).toBe("mid");
  });

  it("list returns readable games, newest first", async () => {
    const repo = new IndexedDBGameRepo();
    await repo.save({ ...newGame(), id: "list-a", updatedAt: "2000-01-01T00:00:00.000Z" });
    await repo.save({ ...newGame(), id: "list-b", updatedAt: "2000-02-01T00:00:00.000Z" });
    await repo.save({ ...newGame(), id: "list-bad", version: 999, updatedAt: "2000-03-01T00:00:00.000Z" });
    const ids = (await repo.list()).map((game) => game.id);
    expect(ids.indexOf("list-b")).toBeLessThan(ids.indexOf("list-a"));
    expect(ids).not.toContain("list-bad");
  });

  it("skips saves written by another version of the app", async () => {
    const repo = new IndexedDBGameRepo();
    await repo.save({ ...newGame(), id: "future", version: 999, updatedAt: "2099-01-01T00:00:00.000Z" });
    expect(await repo.load("future")).toBeNull();
    expect((await repo.loadLatest())!.id).not.toBe("future");
  });

  it("migrates a save from the version where the app rolled for the player", async () => {
    const v1 = {
      ...newGame(),
      id: "legacy",
      version: 1,
      updatedAt: "2031-01-01T00:00:00.000Z",
      players: [{ ...newGame().players[0]!, hp: 7, maxHp: 10 }],
      pendingRoll: { die: "d20", reason: "Sigilo", difficulty: 12 },
      turns: [
        { number: 1, input: { type: "start" }, narration: "Empieza.", events: [] },
        {
          number: 2,
          input: {
            type: "roll",
            result: { die: "d20", reason: "Trepar", difficulty: 10, value: 14, success: true },
          },
          narration: "Subís.",
          events: [],
        },
      ],
    };
    const { pendingPlayerRoll: _a, pendingEnemyRolls: _b, ...stored } = v1;
    await new IndexedDBGameRepo().save(stored as never);

    const loaded = (await new IndexedDBGameRepo().load("legacy"))!;
    expect(loaded.version).toBe(GAME_STATE_VERSION);
    expect(loaded.players[0]).not.toHaveProperty("hp");
    expect(loaded.pendingPlayerRoll).toEqual({ die: "d20", count: 1, reason: "Sigilo", difficulty: 12, mode: "normal" });
    expect(loaded.pendingEnemyRolls).toEqual([]);
    expect(loaded.turns[1]!.input).toEqual({
      type: "action",
      text: 'Tiré d20 por "Trepar": me dio 14 en total.',
    });
  });

  it("migrates a v2 save, which knew nothing about the scene", async () => {
    const { scene: _scene, ...game } = newGame();
    const v2 = {
      ...game,
      id: "v2",
      version: 2,
      npcs: [{ name: "Berta", description: "Posadera", attitude: "friendly" }],
    };
    await new IndexedDBGameRepo().save(v2 as never);

    const loaded = (await new IndexedDBGameRepo().load("v2"))!;
    expect(loaded.version).toBe(GAME_STATE_VERSION);
    expect(loaded.npcs[0]!.present).toBe(false);
    expect(loaded.scene).toEqual({ inCombat: false, turnOf: null });
  });

  it("a game resumes from disk exactly where it was left, enemy rolls included", async () => {
    const llm = new FakeLLMClient();
    const now = () => new Date("2040-01-01T00:00:00Z");
    const first = new TurnEngine({ llm, repo: new IndexedDBGameRepo(), now });
    llm.queueStructured(
      reply({ narration: "Un guardia bloquea el puente." }),
      reply({ enemyRolls: [{ die: "d20", count: 1, modifier: 2, reason: "Ataque del guardia", mode: "normal" }] }),
      reply({ narration: "La alabarda te pasa rozando." }),
    );
    let outcome = await first.playTurn({ ...newGame(), id: "resume" }, { type: "start" });
    if (!outcome.ok) throw new Error("start failed");
    outcome = await first.playTurn(outcome.state, { type: "action", text: "Lo empujo" });
    if (!outcome.ok) throw new Error("action failed");

    // "Reload": new repo and engine instances, nothing kept in memory.
    const repo = new IndexedDBGameRepo();
    const resumed = (await repo.loadLatest())!;
    expect(resumed).toEqual(outcome.state);
    expect(resumed.pendingEnemyRolls).toHaveLength(1);

    const second = new TurnEngine({ llm, repo, random: () => 0.95, now });
    const after = await second.playTurn(resumed, {
      type: "enemy_rolls",
      results: second.rollEnemyDice(resumed),
    });
    expect(after.ok).toBe(true);
    expect(after.state.turns).toHaveLength(3);
    expect(llm.structuredRequests.at(-1)!.prompt).toContain("Un guardia bloquea el puente.");
    expect(llm.structuredRequests.at(-1)!.prompt).toContain("1d20+2 = 22");
  });
});
