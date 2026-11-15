import { describe, expect, it } from "vitest";
import type { GameState } from "../src/domain/types";
import { TurnEngine } from "../src/engine/TurnEngine";
import { FakeLLMClient } from "../src/llm/FakeLLMClient";
import { LLMError } from "../src/llm/LLMClient";
import { InMemoryGameRepo } from "../src/persistence/InMemoryGameRepo";
import { newGame, PLAYER_ID, reply } from "./helpers";

function setup(random: () => number = () => 0.5) {
  const llm = new FakeLLMClient();
  const repo = new InMemoryGameRepo();
  const engine = new TurnEngine({
    llm,
    repo,
    random,
    now: () => new Date("2026-01-02T00:00:00Z"),
  });
  return { llm, repo, engine };
}

async function started(ctx: ReturnType<typeof setup>): Promise<GameState> {
  ctx.llm.queueStructured(
    reply({ stateChanges: [{ type: "location", name: "Ciervo Blanco", description: "Posada" }] }),
  );
  const outcome = await ctx.engine.playTurn(newGame(), { type: "start" });
  if (!outcome.ok) throw new Error("setup failed");
  return outcome.state;
}

describe("TurnEngine.playTurn", () => {
  it("applies the proposed changes, records the turn and saves", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({
        narration: "La posadera te da una llave.",
        stateChanges: [
          { type: "inventory_add", playerId: PLAYER_ID, item: "Llave", quantity: 1 },
        ],
        events: ["item_gained"],
      }),
    );

    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Pido una pieza" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.state.players[0]!.inventory).toEqual([{ name: "Llave", quantity: 1 }]);
    expect(outcome.state.turns).toHaveLength(2);
    expect(outcome.state.turns[1]).toMatchObject({ number: 2, events: ["item_gained"] });
    expect(outcome.state.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(await ctx.repo.load(game.id)).toEqual(outcome.state);
  });

  it("streams the narration as it arrives", async () => {
    const ctx = setup();
    ctx.llm.queueStructured(reply({ narration: "Una niebla espesa cubre el camino." }));
    const seen: string[] = [];

    await ctx.engine.playTurn(newGame(), { type: "start" }, (text) => seen.push(text));

    expect(seen.at(-1)).toBe("Una niebla espesa cubre el camino.");
    expect(seen.length).toBeGreaterThan(1);
  });

  it("runs a roll end to end: request, code rolls, result goes back to the DM", async () => {
    const ctx = setup(() => 0.5); // d20 -> 11
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({ rollRequest: { die: "d20", reason: "Sigilo", difficulty: 12 } }),
      reply({ narration: "El guardia te escucha." }),
    );

    const asked = await ctx.engine.playTurn(game, { type: "action", text: "Me escabullo" });
    if (!asked.ok) throw new Error("expected ok");
    expect(asked.state.pendingRoll).toEqual({ die: "d20", reason: "Sigilo", difficulty: 12 });

    const result = ctx.engine.rollPending(asked.state);
    expect(result).toMatchObject({ value: 11, success: false });

    const resolved = await ctx.engine.playTurn(asked.state, { type: "roll", result });
    if (!resolved.ok) throw new Error("expected ok");
    expect(resolved.state.pendingRoll).toBeNull();
    expect(ctx.llm.structuredRequests.at(-1)!.prompt).toContain("d20 = 11");
    expect(ctx.llm.structuredRequests.at(-1)!.prompt).toContain("FALLO");
  });

  it("refuses a free-text action while a roll is pending", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(reply({ rollRequest: { die: "d20", reason: "Sigilo", difficulty: 12 } }));
    const asked = await ctx.engine.playTurn(game, { type: "action", text: "Me escabullo" });
    const calls = ctx.llm.structuredRequests.length;

    const outcome = await ctx.engine.playTurn(asked.state, { type: "action", text: "Mejor corro" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("invalid_input");
    expect(ctx.llm.structuredRequests).toHaveLength(calls);
  });

  it("refuses a roll result that doesn't match the pending request", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(reply({ rollRequest: { die: "d20", reason: "Sigilo", difficulty: 12 } }));
    const asked = await ctx.engine.playTurn(game, { type: "action", text: "Me escabullo" });

    const forged = { die: "d20", reason: "Sigilo", difficulty: 5, value: 20, success: true } as const;
    const outcome = await ctx.engine.playTurn(asked.state, { type: "roll", result: forged });

    expect(outcome.ok).toBe(false);
  });

  it("retries once when the response is invalid", async () => {
    const ctx = setup();
    ctx.llm.queueStructured("{ not json", reply({ narration: "Segundo intento." }));
    const seen: string[] = [];

    const outcome = await ctx.engine.playTurn(newGame(), { type: "start" }, (t) => seen.push(t));

    expect(outcome.ok).toBe(true);
    expect(ctx.llm.structuredRequests).toHaveLength(2);
    expect(seen).toContain(""); // the UI was told to start over
  });

  it("fails cleanly after two invalid responses, leaving the game untouched", async () => {
    const ctx = setup();
    const game = await started(ctx);
    const saves = ctx.repo.saveCount;
    ctx.llm.queueStructured("{ not json", { narration: "Falta todo lo demás" });

    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Miro alrededor" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("invalid_response");
    expect(outcome.state).toBe(game);
    expect(ctx.repo.saveCount).toBe(saves);
    expect(ctx.llm.structuredRequests).toHaveLength(3); // start + 2 attempts, no third
  });

  it("reports a failed call without retrying", async () => {
    const ctx = setup();
    ctx.llm.queueStructured(new LLMError("rate_limit", "quota"));

    const outcome = await ctx.engine.playTurn(newGame(), { type: "start" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("llm");
    expect(ctx.llm.structuredRequests).toHaveLength(1);
  });

  it("still returns the turn when saving fails, and says so", async () => {
    const ctx = setup();
    ctx.repo.save = async () => {
      throw new Error("disk full");
    };
    ctx.llm.queueStructured(reply());

    const outcome = await ctx.engine.playTurn(newGame(), { type: "start" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.saveError).toBeInstanceOf(Error);
  });

  it("reports rejected changes without failing the turn", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({
        stateChanges: [{ type: "inventory_remove", playerId: PLAYER_ID, item: "Dragón", quantity: 1 }],
      }),
    );

    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Vendo mi dragón" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.rejectedChanges).toHaveLength(1);
  });
});
