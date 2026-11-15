import { describe, expect, it } from "vitest";
import type { GameState } from "../src/domain/types";
import { TurnEngine } from "../src/engine/TurnEngine";
import { FakeLLMClient } from "../src/llm/FakeLLMClient";
import { InMemoryGameRepo } from "../src/persistence/InMemoryGameRepo";
import { newGame, reply } from "./helpers";

function setup() {
  const llm = new FakeLLMClient();
  const repo = new InMemoryGameRepo();
  return { llm, repo, engine: new TurnEngine({ llm, repo }) };
}

/** Plays turns until the game has `total`; turn n narrates "escena-n". */
async function playUntil(ctx: ReturnType<typeof setup>, game: GameState, total: number) {
  let state = game;
  while (state.turns.length < total) {
    const n = state.turns.length + 1;
    ctx.llm.queueStructured(reply({ narration: `escena-${n}.` }));
    const outcome = await ctx.engine.playTurn(
      state,
      n === 1 ? { type: "start" } : { type: "action", text: `accion-${n}` },
    );
    if (!outcome.ok) throw new Error(`turn ${n} failed`);
    state = outcome.state;
  }
  return state;
}

const lastPrompt = (ctx: ReturnType<typeof setup>) => ctx.llm.structuredRequests.at(-1)!.prompt;

describe("three-layer memory", () => {
  it("sends state, summary and recent turns in every call", async () => {
    const ctx = setup();
    await playUntil(ctx, newGame(), 1);
    const prompt = lastPrompt(ctx);
    expect(prompt).toContain("ESTADO");
    expect(prompt).toContain('"name": "Lira"');
    expect(prompt).toContain("RESUMEN");
    expect(prompt).toContain("TURNOS RECIENTES");
  });

  it("regenerates the summary every 10 turns", async () => {
    const ctx = setup();
    ctx.llm.queueText("Lira llegó a Valdecuervo y conoció a Berta.");
    const state = await playUntil(ctx, newGame(), 10);

    expect(ctx.llm.textRequests).toHaveLength(1);
    expect(state.summary).toBe("Lira llegó a Valdecuervo y conoció a Berta.");
    expect(state.summarizedThroughTurn).toBe(10);
    // The summariser saw all ten turns.
    expect(ctx.llm.textRequests[0]!.prompt).toContain("escena-1.");
    expect(ctx.llm.textRequests[0]!.prompt).toContain("escena-10.");
    // And the summary was saved along with the turn.
    expect((await ctx.repo.load(state.id))!.summary).toBe(state.summary);
  });

  it("after a summary, sends the summary plus only the last 6 turns", async () => {
    const ctx = setup();
    ctx.llm.queueText("RESUMEN-UNO");
    await playUntil(ctx, newGame(), 11);

    const prompt = lastPrompt(ctx); // the call that produced turn 11
    expect(prompt).toContain("RESUMEN-UNO");
    expect(prompt).toContain("escena-5.");
    expect(prompt).toContain("escena-10.");
    expect(prompt).not.toContain("escena-4.");
    expect(prompt).not.toContain("escena-1.");
  });

  it("never leaves a turn outside both the summary and the recent window", async () => {
    const ctx = setup();
    await playUntil(ctx, newGame(), 9); // no summary yet
    ctx.llm.queueText("RESUMEN-UNO");
    await playUntil(ctx, (await ctx.repo.loadLatest())!, 10);

    // The call for turn 10 had no summary to lean on, so it carried all 9.
    const prompt = lastPrompt(ctx);
    expect(prompt).toContain("escena-1.");
    expect(prompt).toContain("escena-9.");
  });

  it("folds the previous summary into the next one", async () => {
    const ctx = setup();
    ctx.llm.queueText("RESUMEN-UNO", "RESUMEN-DOS");
    const state = await playUntil(ctx, newGame(), 20);

    expect(state.summary).toBe("RESUMEN-DOS");
    expect(state.summarizedThroughTurn).toBe(20);
    const second = ctx.llm.textRequests[1]!.prompt;
    expect(second).toContain("RESUMEN-UNO");
    expect(second).toContain("escena-11.");
    expect(second).not.toContain("escena-10.");
  });

  it("keeps the turn when the summary call fails, and retries next turn", async () => {
    const ctx = setup();
    ctx.llm.queueText(new Error("boom"), "RESUMEN-TARDE");
    const atTen = await playUntil(ctx, newGame(), 10);
    expect(atTen.turns).toHaveLength(10);
    expect(atTen.summary).toBe("");
    expect(atTen.summarizedThroughTurn).toBe(0);

    const atEleven = await playUntil(ctx, atTen, 11);
    expect(atEleven.summary).toBe("RESUMEN-TARDE");
    expect(atEleven.summarizedThroughTurn).toBe(11);
  });

  it("keeps prompts bounded over a 30-turn game", async () => {
    const ctx = setup();
    ctx.llm.queueText("R1", "R2", "R3");
    await playUntil(ctx, newGame(), 30);

    for (const request of ctx.llm.structuredRequests) {
      const turnsSent = request.prompt.match(/\[Turno \d+\]/g)?.length ?? 0;
      expect(turnsSent).toBeLessThanOrEqual(9);
    }
    expect(lastPrompt(ctx)).toContain("R2");
    expect(lastPrompt(ctx)).not.toContain("escena-1.");
  });
});
