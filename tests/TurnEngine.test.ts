import { describe, expect, it } from "vitest";
import { parseDMResponse } from "../src/domain/schemas";
import type { GameState, Turn } from "../src/domain/types";
import { buildCorrection } from "../src/engine/dmPrompt";
import { SUMMARY_RETRY_AFTER_TURNS, TurnEngine } from "../src/engine/TurnEngine";
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
  it("tells the model why the first reply failed when retrying (invalid JSON)", async () => {
    const ctx = setup();
    ctx.llm.queueStructured("no es json");
    ctx.llm.queueStructured(reply({}));

    const outcome = await ctx.engine.playTurn(newGame(), { type: "start" });

    expect(outcome.ok).toBe(true);
    const [first, second] = ctx.llm.structuredRequests;
    expect(first!.prompt).not.toContain("CORRECCIÓN");
    expect(second!.prompt.endsWith(buildCorrection("The response is not valid JSON."))).toBe(true);
  });

  it("includes the schema reason in the retry prompt", async () => {
    const ctx = setup();
    ctx.llm.queueStructured(JSON.stringify({ narration: "" }));
    ctx.llm.queueStructured(reply({}));

    const outcome = await ctx.engine.playTurn(newGame(), { type: "start" });

    expect(outcome.ok).toBe(true);
    const second = ctx.llm.structuredRequests[1]!.prompt;
    const parsed = parseDMResponse(JSON.stringify({ narration: "" }));
    if (parsed.ok) throw new Error("expected the schema to reject the reply");
    expect(second).toContain(buildCorrection(parsed.reason));
  });

  it("returns an llm failure, untouched state and no save when the retry call throws", async () => {
    const ctx = setup();
    const game = newGame();
    const before = structuredClone(game);
    ctx.llm.queueStructured("no es json", new Error("boom"));

    const outcome = await ctx.engine.playTurn(game, { type: "start" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("llm");
    expect(outcome.state).toEqual(before);
    expect(ctx.repo.saveCount).toBe(0);
  });

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

  it("never rolls for the player: the request is shown and answered in the chat", async () => {
    const ctx = setup();
    const game = await started(ctx);
    const request = { die: "d20", count: 1, reason: "Sigilo", difficulty: 12, mode: "normal" } as const;
    ctx.llm.queueStructured(reply({ playerRoll: request }), reply({ narration: "Pasás sin ruido." }));

    const asked = await ctx.engine.playTurn(game, { type: "action", text: "Me escabullo" });
    if (!asked.ok) throw new Error("expected ok");
    expect(asked.state.pendingPlayerRoll).toEqual(request);
    expect(asked.state.pendingEnemyRolls).toEqual([]);
    expect(ctx.engine.rollEnemyDice(asked.state)).toEqual([]);

    // The player answers with their own total, as free text.
    const answered = await ctx.engine.playTurn(asked.state, {
      type: "action",
      text: "El lanzamiento me dio 17 en total",
    });
    if (!answered.ok) throw new Error("expected ok");
    const prompt = ctx.llm.structuredRequests.at(-1)!.prompt;
    expect(prompt).toContain("TIRADA PEDIDA AL JUGADOR");
    expect(prompt).toContain("1d20 — Sigilo (CD 12)");
    expect(prompt).toContain("El lanzamiento me dio 17 en total");
    expect(answered.state.pendingPlayerRoll).toBeNull();
  });

  it("accepts a roll reported through the dice button, with or without text", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(reply({ narration: "Pasás sin ruido." }));

    const outcome = await ctx.engine.playTurn(game, {
      type: "action",
      text: "",
      roll: { die: "d20", value: 14, modifier: 3, reason: "Sigilo" },
    });

    expect(outcome.ok).toBe(true);
    const prompt = ctx.llm.structuredRequests.at(-1)!.prompt;
    expect(prompt).toContain("TIRADA DEL JUGADOR: Sigilo — 1d20: 14 + 3 = 17");
  });

  it("still rejects an action with neither text nor roll", async () => {
    const ctx = setup();
    const game = await started(ctx);
    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "  " });
    expect(outcome.ok).toBe(false);
  });

  it("rolls enemy dice in code and sends the totals back to the DM", async () => {
    const ctx = setup(() => 0.5); // d20 -> 11, d6 -> 4
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({
        narration: "El goblin te lanza un tajo.",
        enemyRolls: [
          { die: "d20", count: 1, modifier: 4, reason: "Ataque del goblin", mode: "normal" },
          { die: "d6", count: 2, modifier: 1, reason: "Daño de la cimitarra", mode: "normal" },
        ],
      }),
      reply({ narration: "La cimitarra te alcanza: recibís 9 de daño." }),
    );

    const asked = await ctx.engine.playTurn(game, { type: "action", text: "Avanzo" });
    if (!asked.ok) throw new Error("expected ok");
    expect(asked.state.pendingEnemyRolls).toHaveLength(2);

    const results = ctx.engine.rollEnemyDice(asked.state);
    expect(results.map((r) => r.total)).toEqual([15, 9]);
    expect(results[1]!.values).toEqual([4, 4]);

    const resolved = await ctx.engine.playTurn(asked.state, { type: "enemy_rolls", results });
    if (!resolved.ok) throw new Error("expected ok");
    expect(resolved.state.pendingEnemyRolls).toEqual([]);
    const prompt = ctx.llm.structuredRequests.at(-1)!.prompt;
    expect(prompt).toContain("Ataque del goblin: 1d20+4 = 15");
    expect(prompt).toContain("Daño de la cimitarra: 2d6+1 = 9 (dados: 4, 4)");
  });

  it("tells the DM an enemy roll had advantage and shows both dice", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({
        enemyRolls: [
          { die: "d20", count: 1, modifier: 4, reason: "Ataque del goblin", mode: "advantage" },
        ],
      }),
      reply({ narration: "El goblin acierta." }),
    );
    const asked = await ctx.engine.playTurn(game, { type: "action", text: "Avanzo" });
    if (!asked.ok) throw new Error("expected ok");
    const results = ctx.engine.rollEnemyDice(asked.state);
    expect(results[0]!.values).toHaveLength(2);
    await ctx.engine.playTurn(asked.state, { type: "enemy_rolls", results });
    const prompt = ctx.llm.structuredRequests.at(-1)!.prompt;
    expect(prompt).toContain("con ventaja");
    expect(prompt).toContain(`dados: ${results[0]!.values.join(", ")}; queda ${Math.max(...results[0]!.values)}`);
  });

  describe("enemy rolls with advantage", () => {
    const request = {
      die: "d20" as const,
      count: 1,
      modifier: 4,
      reason: "Ataque",
      mode: "advantage" as const,
    };

    async function asked(ctx: ReturnType<typeof setup>) {
      const game = await started(ctx);
      ctx.llm.queueStructured(reply({ enemyRolls: [request] }));
      const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Avanzo" });
      if (!outcome.ok) throw new Error("expected ok");
      return outcome.state;
    }

    async function refused(result: object) {
      const ctx = setup();
      const state = await asked(ctx);
      const calls = ctx.llm.structuredRequests.length;
      const outcome = await ctx.engine.playTurn(state, {
        type: "enemy_rolls",
        results: [result as never],
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.failure.kind).toBe("invalid_input");
      expect(ctx.llm.structuredRequests).toHaveLength(calls);
    }

    it("refuses a result that lost the mode", async () => {
      await refused({ ...request, mode: "normal", values: [3, 19], total: 23 });
    });

    it("refuses a result with a single value", async () => {
      await refused({ ...request, values: [19], total: 23 });
    });

    it("refuses a result with three values", async () => {
      await refused({ ...request, values: [3, 19, 7], total: 23 });
    });

    it("rolls two dice with the injected random and the result passes validation", async () => {
      const seq = [0.1, 0.9];
      const ctx = setup(() => seq.shift() ?? 0.5);
      const state = await asked(ctx);
      const results = ctx.engine.rollEnemyDice(state);
      expect(results[0]!.values).toEqual([3, 19]);
      expect(results[0]!.total).toBe(23);
      ctx.llm.queueStructured(reply({ narration: "Acierta." }));
      const outcome = await ctx.engine.playTurn(state, { type: "enemy_rolls", results });
      expect(outcome.ok).toBe(true);
    });
  });

  it("refuses a player action while enemy rolls are waiting to be sent", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({ enemyRolls: [{ die: "d20", count: 1, modifier: 0, reason: "Ataque", mode: "normal" }] }),
    );
    const asked = await ctx.engine.playTurn(game, { type: "action", text: "Avanzo" });
    const calls = ctx.llm.structuredRequests.length;

    const outcome = await ctx.engine.playTurn(asked.state, { type: "action", text: "Corro" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("invalid_input");
    expect(ctx.llm.structuredRequests).toHaveLength(calls);
  });

  it("refuses enemy roll results that don't match what was requested", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({ enemyRolls: [{ die: "d20", count: 1, modifier: 0, reason: "Ataque", mode: "normal" }] }),
    );
    const asked = await ctx.engine.playTurn(game, { type: "action", text: "Avanzo" });

    const outcome = await ctx.engine.playTurn(asked.state, {
      type: "enemy_rolls",
      results: [{ die: "d20", count: 1, modifier: 10, reason: "Ataque", mode: "normal", values: [20], total: 30 }],
    });

    expect(outcome.ok).toBe(false);
  });

  it("stops a DM that keeps chaining enemy rolls and hands the turn back", async () => {
    const ctx = setup();
    let state = await started(ctx);
    const more = reply({ enemyRolls: [{ die: "d20", count: 1, modifier: 0, reason: "Otro", mode: "normal" }] });
    ctx.llm.queueStructured(more, more, more, more);

    const first = await ctx.engine.playTurn(state, { type: "action", text: "Avanzo" });
    state = first.state;
    let automatic = 0;
    while (state.pendingEnemyRolls.length > 0) {
      const next = await ctx.engine.playTurn(state, {
        type: "enemy_rolls",
        results: ctx.engine.rollEnemyDice(state),
      });
      if (!next.ok) throw new Error("expected ok");
      state = next.state;
      automatic += 1;
    }

    expect(automatic).toBe(3);
  });

  it("tells the DM not to ask for more enemy rolls once the chain is at its limit", async () => {
    const ctx = setup();
    let state = await started(ctx);
    const more = reply({ enemyRolls: [{ die: "d20", count: 1, modifier: 0, reason: "Otro", mode: "normal" }] });
    ctx.llm.queueStructured(more, more, more, more);
    state = (await ctx.engine.playTurn(state, { type: "action", text: "Avanzo" })).state;
    for (let i = 0; i < 3; i += 1) {
      const next = await ctx.engine.playTurn(state, {
        type: "enemy_rolls",
        results: ctx.engine.rollEnemyDice(state),
      });
      state = next.state;
    }

    const prompts = ctx.llm.structuredRequests.map((request) => request.prompt);
    // requests: start, action, enemy_rolls x3 (the third one is at the limit)
    expect(prompts[3]).not.toContain("LÍMITE DE TIRADAS");
    expect(prompts[4]).toContain("LÍMITE DE TIRADAS");
  });

  it("never shows the limit block on a normal action", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(reply({}));
    await ctx.engine.playTurn(game, { type: "action", text: "Miro" });
    expect(ctx.llm.structuredRequests.at(-1)!.prompt).not.toContain("LÍMITE DE TIRADAS");
  });

  it("clears pending rolls and the turn marker when the limit drops the rolls", async () => {
    const ctx = setup();
    let state = await started(ctx);
    const more = reply({
      enemyRolls: [{ die: "d20", count: 1, modifier: 0, reason: "Otro", mode: "normal" }],
      stateChanges: [{ type: "scene", inCombat: true, turnOf: "Lira" }],
    });
    ctx.llm.queueStructured(more, more, more, more);
    state = (await ctx.engine.playTurn(state, { type: "action", text: "Avanzo" })).state;
    for (let i = 0; i < 3; i += 1) {
      state = (
        await ctx.engine.playTurn(state, { type: "enemy_rolls", results: ctx.engine.rollEnemyDice(state) })
      ).state;
    }

    expect(state.pendingEnemyRolls).toEqual([]);
    expect(state.scene.turnOf).toBeNull();
  });

  describe("scene when the enemy-roll chain hits its limit", () => {
    const npc = {
      type: "npc" as const, name: "Goblin", description: "Un goblin", attitude: "hostile" as const,
      present: true, voice: "", portrait: null,
    };
    const fight = reply({
      enemyRolls: [{ die: "d20", count: 1, modifier: 0, reason: "Otro", mode: "normal" }],
      stateChanges: [npc, { type: "scene", inCombat: true, turnOf: "Goblin" }],
    });

    async function chain(turns: number) {
      const ctx = setup();
      let state = await started(ctx);
      ctx.llm.queueStructured(fight, fight, fight, fight);
      state = (await ctx.engine.playTurn(state, { type: "action", text: "Avanzo" })).state;
      for (let i = 0; i < turns; i += 1) {
        state = (
          await ctx.engine.playTurn(state, { type: "enemy_rolls", results: ctx.engine.rollEnemyDice(state) })
        ).state;
      }
      return state;
    }

    it("keeps turnOf and the rolls while rolls are still allowed (2nd chained turn)", async () => {
      const state = await chain(2);
      expect(state.pendingEnemyRolls).toHaveLength(1);
      expect(state.scene).toEqual({ inCombat: true, turnOf: "Goblin" });
    });

    it("on the dropping turn only turnOf is reset; inCombat stays true", async () => {
      const state = await chain(3);
      expect(state.pendingEnemyRolls).toEqual([]);
      expect(state.scene).toEqual({ inCombat: true, turnOf: null });
    });
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

describe("message authorship", () => {
  it("keeps who said each action through save and load", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(reply());

    const outcome = await ctx.engine.playTurn(game, {
      type: "action",
      text: "Saludo",
      playerId: PLAYER_ID,
    });

    const saved = (await ctx.repo.load(game.id))!;
    expect(outcome.ok).toBe(true);
    expect(saved.turns.at(-1)!.input).toEqual({ type: "action", text: "Saludo", playerId: PLAYER_ID });
  });
});

function gameWithTurns(count: number, summarizedThroughTurn = 0): GameState {
  const turns: Turn[] = Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    input: { type: "action", text: `accion-${i + 1}` },
    narration: `escena-${i + 1}.`,
    events: [],
  }));
  return { ...newGame(), turns, summarizedThroughTurn };
}

describe("TurnEngine background summary", () => {
  it("playTurn on turn 10 makes no text call", async () => {
    const ctx = setup();
    ctx.llm.queueStructured(reply({ narration: "escena-10." }));
    const outcome = await ctx.engine.playTurn(gameWithTurns(9), { type: "action", text: "x" });
    expect(outcome.ok && outcome.state.turns).toHaveLength(10);
    expect(ctx.llm.textRequests.length).toBe(0);
  });

  it("summarizeIfDue returns a patch for 10 unsummarized turns", async () => {
    const ctx = setup();
    ctx.llm.queueText("  RESUMEN  ");
    const patch = await ctx.engine.summarizeIfDue(gameWithTurns(10));
    expect(patch).toEqual({ summary: "RESUMEN", summarizedThroughTurn: 10 });
  });

  it("summarizeIfDue rebases onto the tracked state before deciding", async () => {
    const ctx = setup();
    ctx.llm.queueStructured(reply({ narration: "escena-10." }), reply({ narration: "escena-11." }));
    ctx.llm.queueText("RESUMEN");
    const turn10 = await ctx.engine.playTurn(gameWithTurns(9), { type: "action", text: "x" });
    if (!turn10.ok) throw new Error("turn 10 failed");
    const patch = await ctx.engine.summarizeIfDue(turn10.state);
    await ctx.engine.applySummary(turn10.state, patch!);
    // Turn 11 starts from the unsummarized state; the carry-over keeps the summary.
    const turn11 = await ctx.engine.playTurn(turn10.state, { type: "action", text: "y" });
    if (!turn11.ok) throw new Error("turn 11 failed");
    expect(turn11.state.summarizedThroughTurn).toBe(10);

    const stale: GameState = { ...turn11.state, summarizedThroughTurn: 0 };
    expect(await ctx.engine.summarizeIfDue(stale)).toBeNull();
    expect(ctx.llm.textRequests.length).toBe(1);
  });

  it("summarizeIfDue returns null when nothing is due", async () => {
    const ctx = setup();
    expect(await ctx.engine.summarizeIfDue(gameWithTurns(9))).toBeNull();
    expect(ctx.llm.textRequests.length).toBe(0);
  });

  it("after a failure waits SUMMARY_RETRY_AFTER_TURNS turns before retrying", async () => {
    const ctx = setup();
    ctx.llm.queueText(new Error("boom"), "RESUMEN-TARDE");
    expect(await ctx.engine.summarizeIfDue(gameWithTurns(10))).toBeNull();
    expect(ctx.llm.textRequests.length).toBe(1);

    expect(await ctx.engine.summarizeIfDue(gameWithTurns(11))).toBeNull();
    expect(ctx.llm.textRequests.length).toBe(1);

    expect(SUMMARY_RETRY_AFTER_TURNS).toBe(3);
    const patch = await ctx.engine.summarizeIfDue(gameWithTurns(13));
    expect(ctx.llm.textRequests.length).toBe(2);
    expect(patch).toEqual({ summary: "RESUMEN-TARDE", summarizedThroughTurn: 13 });
  });

  it("treats an empty summary as a failure", async () => {
    const ctx = setup();
    ctx.llm.queueText("   ");
    expect(await ctx.engine.summarizeIfDue(gameWithTurns(10))).toBeNull();
    expect(await ctx.engine.summarizeIfDue(gameWithTurns(11))).toBeNull();
    expect(ctx.llm.textRequests.length).toBe(1);
  });

  it("ignores a call made while another is pending", async () => {
    const ctx = setup();
    ctx.llm.queueText("RESUMEN");
    const state = gameWithTurns(10);
    const first = ctx.engine.summarizeIfDue(state);
    const second = ctx.engine.summarizeIfDue(state);
    expect(await second).toBeNull();
    expect(await first).not.toBeNull();
    expect(ctx.llm.textRequests.length).toBe(1);
  });

  it("applySummary keeps turns added after the summary started", async () => {
    const ctx = setup();
    const latest = gameWithTurns(11);
    const result = await ctx.engine.applySummary(latest, { summary: "R", summarizedThroughTurn: 10 });
    expect(result.saveError).toBeNull();
    expect(result.state.turns).toHaveLength(11);
    expect(result.state.summary).toBe("R");
    expect(result.state.summarizedThroughTurn).toBe(10);
    expect((await ctx.repo.load(latest.id))!.summarizedThroughTurn).toBe(10);
  });

  it("applySummary ignores a patch older than the state's summary", async () => {
    const ctx = setup();
    const latest = { ...gameWithTurns(12, 12), summary: "NUEVO" };
    const result = await ctx.engine.applySummary(latest, { summary: "R", summarizedThroughTurn: 10 });
    expect(result.state).toBe(latest);
    expect(result.saveError).toBeNull();
  });

  it("applySummary reports a save failure", async () => {
    const ctx = setup();
    const boom = new Error("disk");
    ctx.repo.save = async () => { throw boom; };
    const result = await ctx.engine.applySummary(gameWithTurns(10), { summary: "R", summarizedThroughTurn: 10 });
    expect(result.saveError).toBe(boom);
    expect(result.state.summary).toBe("R");
  });
});

describe("TurnEngine summary ordering", () => {
  const patch10 = { summary: "RESUMEN", summarizedThroughTurn: 10 };

  it("applySummary rebases onto a turn committed after the summary started", async () => {
    const ctx = setup();
    const state10 = gameWithTurns(10);
    ctx.llm.queueStructured(reply({ narration: "escena-11." }));
    const turn = await ctx.engine.playTurn(state10, { type: "action", text: "x" });
    if (!turn.ok) throw new Error("turn failed");

    const result = await ctx.engine.applySummary(state10, patch10);
    expect(result.state.turns).toHaveLength(11);
    expect(result.state.summarizedThroughTurn).toBe(10);
    const saved = (await ctx.repo.load(state10.id))!;
    expect(saved.turns).toHaveLength(11);
    expect(saved.summarizedThroughTurn).toBe(10);
    expect(saved.summary).toBe("RESUMEN");
  });

  it("a turn in flight while the summary is applied keeps the summary", async () => {
    const ctx = setup();
    const state10 = gameWithTurns(10);
    ctx.llm.queueText("RESUMEN");
    const patch = await ctx.engine.summarizeIfDue(state10);
    await ctx.engine.applySummary(state10, patch!);

    ctx.llm.queueStructured(reply({ narration: "escena-11." }));
    const turn = await ctx.engine.playTurn(state10, { type: "action", text: "x" });
    if (!turn.ok) throw new Error("turn failed");
    expect(turn.state.turns).toHaveLength(11);
    expect(turn.state.summarizedThroughTurn).toBe(10);
    expect(turn.state.summary).toBe("RESUMEN");
    // The carried summary means nothing is due, so no further model call.
    expect(await ctx.engine.summarizeIfDue(turn.state)).toBeNull();
    expect(ctx.llm.textRequests).toHaveLength(1);
    expect((await ctx.repo.load(state10.id))!.summary).toBe("RESUMEN");
  });

  it("serializes saves: a slow summary save never lands after the turn save", async () => {
    const ctx = setup();
    const state10 = gameWithTurns(10);
    const stored: GameState[] = [];
    let first = true;
    ctx.repo.save = async (game: GameState) => {
      const slow = first;
      first = false;
      if (slow) await new Promise((resolve) => setTimeout(resolve, 30));
      stored.push(game);
    };
    ctx.llm.queueStructured(reply({ narration: "escena-11." }));

    const summary = ctx.engine.applySummary(state10, patch10);
    const turn = ctx.engine.playTurn(state10, { type: "action", text: "x" });
    await Promise.all([summary, turn]);

    expect(stored).toHaveLength(2);
    expect(stored.at(-1)!.turns).toHaveLength(11);
    expect(stored.at(-1)!.summarizedThroughTurn).toBe(10);
  });

  it("a failed save doesn't break the save chain", async () => {
    const ctx = setup();
    const state10 = gameWithTurns(10);
    const stored: GameState[] = [];
    let calls = 0;
    ctx.repo.save = async (game: GameState) => {
      calls += 1;
      if (calls === 1) throw new Error("disk");
      stored.push(game);
    };
    const first = await ctx.engine.applySummary(state10, patch10);
    expect(first.saveError).toBeInstanceOf(Error);
    const second = await ctx.engine.applySummary(gameWithTurns(20), {
      summary: "R2",
      summarizedThroughTurn: 20,
    });
    expect(second.saveError).toBeNull();
    expect(stored).toHaveLength(1);
  });

  it("a summary failure on one game doesn't block another", async () => {
    const ctx = setup();
    const a = gameWithTurns(10);
    const b = { ...gameWithTurns(10), id: "otra-partida" };
    ctx.llm.queueText(new Error("boom"), "RESUMEN-B");
    expect(await ctx.engine.summarizeIfDue(a)).toBeNull();
    const patch = await ctx.engine.summarizeIfDue(b);
    expect(patch).toEqual({ summary: "RESUMEN-B", summarizedThroughTurn: 10 });
    expect(ctx.llm.textRequests).toHaveLength(2);
  });
});
