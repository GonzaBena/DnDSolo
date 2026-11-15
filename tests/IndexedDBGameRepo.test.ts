import "fake-indexeddb/auto";
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

  it("skips saves written by another version of the app", async () => {
    const repo = new IndexedDBGameRepo();
    await repo.save({ ...newGame(), id: "future", version: 999, updatedAt: "2099-01-01T00:00:00.000Z" });
    expect(await repo.load("future")).toBeNull();
    expect((await repo.loadLatest())!.id).not.toBe("future");
  });

  it("a game resumes from disk exactly where it was left, roll included", async () => {
    const llm = new FakeLLMClient();
    const now = () => new Date("2040-01-01T00:00:00Z");
    const first = new TurnEngine({ llm, repo: new IndexedDBGameRepo(), now });
    llm.queueStructured(
      reply({ narration: "Un guardia bloquea el puente." }),
      reply({ rollRequest: { die: "d20", reason: "Persuasión", difficulty: 10 } }),
      reply({ narration: "El guardia te deja pasar." }),
    );
    let outcome = await first.playTurn({ ...newGame(), id: "resume" }, { type: "start" });
    if (!outcome.ok) throw new Error("start failed");
    outcome = await first.playTurn(outcome.state, { type: "action", text: "Lo convenzo" });
    if (!outcome.ok) throw new Error("action failed");

    // "Reload": new repo and engine instances, nothing kept in memory.
    const repo = new IndexedDBGameRepo();
    const resumed = (await repo.loadLatest())!;
    expect(resumed).toEqual(outcome.state);
    expect(resumed.pendingRoll).not.toBeNull();

    const second = new TurnEngine({ llm, repo, random: () => 0.95, now });
    const after = await second.playTurn(resumed, {
      type: "roll",
      result: second.rollPending(resumed),
    });
    expect(after.ok).toBe(true);
    expect(after.state.turns).toHaveLength(3);
    expect(llm.structuredRequests.at(-1)!.prompt).toContain("Un guardia bloquea el puente.");
  });
});
