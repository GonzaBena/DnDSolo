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

  it("records who arrived in the turn", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({
        stateChanges: [
          {
            type: "npc",
            name: "Goblin 1",
            description: "Flaco.",
            attitude: "hostile",
            present: true,
            voice: "",
            portrait: null,
            maxHp: 7,
          },
        ],
      }),
    );
    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Miro" });
    if (!outcome.ok) throw new Error("turn failed");
    expect(outcome.state.turns[1]!.arrivals).toEqual([
      { name: "Goblin 1", attitude: "hostile", portrait: null, blurb: "Flaco.", returning: false, health: null },
    ]);
  });

  it("leaves arrivals out when nobody arrived", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(reply());
    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Miro" });
    if (!outcome.ok) throw new Error("turn failed");
    expect("arrivals" in outcome.state.turns[1]!).toBe(false);
  });

  it("records the chapter when the location changes", async () => {
    const ctx = setup();
    const game = await started(ctx);
    expect(game.turns[0]!.chapter).toEqual({ name: "Ciervo Blanco", description: "Posada", firstVisit: true });
    ctx.llm.queueStructured(
      reply({ stateChanges: [{ type: "location", name: "La Cripta de Vel", description: "Piedra húmeda." }] }),
    );
    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Bajo" });
    if (!outcome.ok) throw new Error("turn failed");
    expect(outcome.state.turns[1]!.chapter).toEqual({
      name: "La Cripta de Vel",
      description: "Piedra húmeda.",
      firstVisit: true,
    });
  });

  it("leaves chapter out when the place stays", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(reply());
    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Miro" });
    if (!outcome.ok) throw new Error("turn failed");
    expect("chapter" in outcome.state.turns[1]!).toBe(false);
  });

  it("a turn records its moments, and none when nothing changed", async () => {
    const ctx = setup();
    const game = await started(ctx);
    expect("moments" in game.turns[0]!).toBe(false);
    ctx.llm.queueStructured(
      reply({ stateChanges: [{ type: "quest", title: "Ruta", description: "Llegar al paso", status: "active" }] }),
    );
    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Acepto" });
    if (!outcome.ok) throw new Error("turn failed");
    expect(outcome.state.turns[1]!.moments).toEqual([{ kind: "quest", title: "Ruta", status: "active" }]);
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
      stateChanges: [{ type: "scene", inCombat: true, turnOf: "Lira", order: [] }],
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
      present: true, voice: "", portrait: null, maxHp: null,
    };
    const fight = reply({
      enemyRolls: [{ die: "d20", count: 1, modifier: 0, reason: "Otro", mode: "normal" }],
      stateChanges: [npc, { type: "scene", inCombat: true, turnOf: "Goblin", order: [] }],
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
      expect(state.scene).toEqual({ inCombat: true, turnOf: "Goblin", order: [] });
    });

    it("on the dropping turn only turnOf is reset; inCombat stays true", async () => {
      const state = await chain(3);
      expect(state.pendingEnemyRolls).toEqual([]);
      expect(state.scene).toEqual({ inCombat: true, turnOf: null, order: [] });
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

describe("TurnEngine abort", () => {
  it("returns an aborted failure with the state untouched and nothing saved", async () => {
    const ctx = setup();
    const game = newGame();
    ctx.llm.queueStructured(reply({}));
    const controller = new AbortController();
    controller.abort();

    const outcome = await ctx.engine.playTurn(game, { type: "start" }, undefined, controller.signal);

    expect(outcome).toEqual({ ok: false, state: game, failure: { kind: "aborted" } });
    expect(await ctx.repo.load(game.id)).toBeNull();
    // Already aborted: the model is never called.
    expect(ctx.llm.structuredRequests).toHaveLength(0);
  });

  it("does not retry when the abort happens mid-stream", async () => {
    const ctx = setup();
    const game = newGame();
    ctx.llm.queueStructured(reply({}), reply({}));
    const controller = new AbortController();

    const outcome = await ctx.engine.playTurn(
      game,
      { type: "start" },
      () => controller.abort(),
      controller.signal,
    );

    expect(outcome).toEqual({ ok: false, state: game, failure: { kind: "aborted" } });
    expect(ctx.llm.structuredRequests).toHaveLength(1);
    expect(await ctx.repo.load(game.id)).toBeNull();
  });

  it("an aborted enemy_rolls turn can be resent with the same dice, without rerolling", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({
        enemyRolls: [
          { die: "d20", count: 1, modifier: 4, reason: "Ataque del goblin", mode: "normal" },
        ],
      }),
    );
    const asked = await ctx.engine.playTurn(game, { type: "action", text: "Avanzo" });
    if (!asked.ok) throw new Error("expected ok");

    let rolls = 0;
    const original = ctx.engine.rollEnemyDice.bind(ctx.engine);
    ctx.engine.rollEnemyDice = (state) => {
      rolls += 1;
      return original(state);
    };
    const results = ctx.engine.rollEnemyDice(asked.state);
    const sentValues = results.map((r) => [...r.values]);
    const input = { type: "enemy_rolls" as const, results };

    const controller = new AbortController();
    controller.abort();
    const aborted = await ctx.engine.playTurn(asked.state, input, undefined, controller.signal);
    expect(aborted.ok).toBe(false);
    if (aborted.ok) return;
    expect(aborted.failure.kind).toBe("aborted");
    expect(aborted.state).toBe(asked.state);

    // Retry resends the very same input.
    ctx.llm.queueStructured(reply({ narration: "El goblin acierta." }));
    const retried = await ctx.engine.playTurn(asked.state, input);
    expect(retried.ok).toBe(true);
    if (!retried.ok) return;
    // Guards against playTurn rolling dice itself or mutating the results.
    expect(rolls).toBe(1);
    expect(input.results.map((r) => [...r.values])).toEqual(sentValues);
    expect(retried.state.turns.at(-1)!.input).toEqual(input);
    expect(ctx.llm.structuredRequests.at(-1)!.prompt).toContain(
      `Ataque del goblin: 1d20+4 = ${results[0]!.total}`,
    );
  });

  it("classifies as aborted whatever error the SDK throws once the signal fired", async () => {
    const ctx = setup();
    const game = newGame();
    const controller = new AbortController();
    // The SDK wrapped the abort in an error that is not an AbortError.
    ctx.llm.generateStructured = async () => {
      controller.abort();
      throw new Error("exception sending request");
    };

    const outcome = await ctx.engine.playTurn(game, { type: "start" }, undefined, controller.signal);

    expect(outcome).toEqual({ ok: false, state: game, failure: { kind: "aborted" } });
  });
});

describe("TurnEngine abort when the SDK stream ends without throwing", () => {
  it("does not retry when an abort mid-stream returns truncated text", async () => {
    const ctx = setup();
    const game = newGame();
    const controller = new AbortController();
    let calls = 0;
    ctx.llm.generateStructured = async (request) => {
      calls += 1;
      expect(request.signal).toBe(controller.signal);
      request.onChunk?.('{"narration":"El goblin se');
      controller.abort();
      return '{"narration":"El goblin se';
    };
    const narrations: string[] = [];

    const outcome = await ctx.engine.playTurn(
      game,
      { type: "start" },
      (text) => narrations.push(text),
      controller.signal,
    );

    expect(outcome).toEqual({ ok: false, state: game, failure: { kind: "aborted" } });
    expect(calls).toBe(1);
    expect(narrations).not.toContain("");
    expect(ctx.repo.saveCount).toBe(0);
  });

  it("does not make a second attempt when the signal fires after an unparseable first reply", async () => {
    const ctx = setup();
    const game = newGame();
    const controller = new AbortController();
    let calls = 0;
    ctx.llm.generateStructured = async () => {
      calls += 1;
      controller.abort();
      return "no es json";
    };

    const outcome = await ctx.engine.playTurn(game, { type: "start" }, undefined, controller.signal);

    expect(outcome).toEqual({ ok: false, state: game, failure: { kind: "aborted" } });
    expect(calls).toBe(1);
  });
});

describe("TurnEngine beforeCommit", () => {
  it("saves only after beforeCommit resolves", async () => {
    const ctx = setup();
    const game = newGame();
    ctx.llm.queueStructured(reply({}));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let called = 0;

    const pending = ctx.engine.playTurn(game, { type: "start" }, undefined, undefined, async () => {
      called += 1;
      await gate;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(called).toBe(1);
    expect(ctx.repo.saveCount).toBe(0);

    release();
    const outcome = await pending;
    expect(outcome.ok).toBe(true);
    expect(ctx.repo.saveCount).toBe(1);
  });

  it("discards the turn when aborted during beforeCommit", async () => {
    const ctx = setup();
    const game = newGame();
    ctx.llm.queueStructured(reply({}), reply({}));
    const controller = new AbortController();

    const outcome = await ctx.engine.playTurn(
      game,
      { type: "start" },
      undefined,
      controller.signal,
      async () => controller.abort(),
    );

    expect(outcome).toEqual({ ok: false, state: game, failure: { kind: "aborted" } });
    expect(ctx.repo.saveCount).toBe(0);
    const again = await ctx.engine.playTurn(game, { type: "start" });
    if (!again.ok) throw new Error("expected ok");
    expect(again.state.turns).toHaveLength(1);
    expect(again.state.turns[0]!.number).toBe(1);
  });

  it("treats a throwing beforeCommit as aborted only when the signal fired", async () => {
    const ctx = setup();
    const game = newGame();
    ctx.llm.queueStructured(reply({}), reply({}));
    const controller = new AbortController();
    const aborted = await ctx.engine.playTurn(game, { type: "start" }, undefined, controller.signal, async () => {
      controller.abort();
      throw new Error("boom");
    });
    expect(aborted).toEqual({ ok: false, state: game, failure: { kind: "aborted" } });
    await expect(
      ctx.engine.playTurn(game, { type: "start" }, undefined, undefined, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("calls beforeCommit once, after the valid reply, when the first is invalid", async () => {
    const ctx = setup();
    ctx.llm.queueStructured("no es json", reply({}));
    let calls = 0;
    let requestsAtCall = 0;
    const outcome = await ctx.engine.playTurn(newGame(), { type: "start" }, undefined, undefined, async () => {
      calls += 1;
      requestsAtCall = ctx.llm.structuredRequests.length;
    });
    expect(outcome.ok).toBe(true);
    expect(calls).toBe(1);
    expect(requestsAtCall).toBe(2);
  });

  it("does not call beforeCommit when generation is aborted", async () => {
    const ctx = setup();
    ctx.llm.queueStructured(reply({}));
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await ctx.engine.playTurn(newGame(), { type: "start" }, undefined, controller.signal, async () => {
      calls += 1;
    });
    expect(calls).toBe(0);
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

  it("applySummary ignores a patch that covers turns the game doesn't have", async () => {
    const ctx = setup();
    const latest = gameWithTurns(5);
    const result = await ctx.engine.applySummary(latest, { summary: "R", summarizedThroughTurn: 10 });
    expect(result.state).toBe(latest);
    expect(result.saveError).toBeNull();
    expect(ctx.repo.saveCount).toBe(0);
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

describe("TurnEngine.adjustHp", () => {
  const stats = {
    maxHp: 20,
    armorClass: 16,
    initiative: 2,
    speed: 30,
    hitDice: "3d8",
    attacks: [],
    spellSaveDc: null,
    spellAttackBonus: null,
  };
  const tracked = (): GameState => {
    const game = newGame();
    return { ...game, players: [{ ...game.players[0]!, stats, currentHp: 15 }] };
  };

  it("a manual correction at 0 HP never counts as a failed death save", async () => {
    const ctx = setup();
    const down: GameState = {
      ...tracked(),
      players: [{ ...tracked().players[0]!, currentHp: 0, condition: "dying", deathSaves: { successes: 0, failures: 2 } }],
    };
    const out = await ctx.engine.adjustHp(down, PLAYER_ID, -5);
    expect(out.state.players[0]).toMatchObject({ condition: "dying", deathSaves: { failures: 2 } });
  });

  it("a manual correction that drops to 0 still leaves the character dying", async () => {
    const out = await setup().engine.adjustHp(tracked(), PLAYER_ID, -15);
    expect(out.state.players[0]).toMatchObject({ currentHp: 0, condition: "dying" });
  });

  it("changes the hit points without adding a turn, and saves", async () => {
    const ctx = setup();
    const state = tracked();
    const out = await ctx.engine.adjustHp(state, PLAYER_ID, -3);
    expect(out.state.players[0]!.currentHp).toBe(12);
    expect(out.state.turns).toHaveLength(state.turns.length);
    expect(out.saveError).toBeNull();
    expect((await ctx.repo.load(state.id))!.players[0]!.currentHp).toBe(12);
    expect(ctx.llm.structuredRequests).toHaveLength(0);
  });

  it("clamps at the maximum", async () => {
    const out = await setup().engine.adjustHp(tracked(), PLAYER_ID, 99);
    expect(out.state.players[0]!.currentHp).toBe(20);
  });

  it("leaves a sheet without stats alone and saves nothing", async () => {
    const ctx = setup();
    const state = newGame();
    const out = await ctx.engine.adjustHp(state, PLAYER_ID, -3);
    expect(out.state).toBe(state);
    expect(await ctx.repo.load(state.id)).toBeNull();
  });

  it("reports a save failure", async () => {
    const ctx = setup();
    ctx.repo.save = async () => {
      throw new Error("disk");
    };
    const out = await ctx.engine.adjustHp(tracked(), PLAYER_ID, -1);
    expect(out.saveError).toBeInstanceOf(Error);
  });

  it("two quick fixes on the same state add up in memory and in the repo", async () => {
    const ctx = setup();
    const state = tracked();
    const first = ctx.engine.adjustHp(state, PLAYER_ID, -1);
    const second = await ctx.engine.adjustHp(state, PLAYER_ID, -1);
    await first;
    expect(second.state.players[0]!.currentHp).toBe(13);
    expect((await ctx.repo.load(state.id))!.players[0]!.currentHp).toBe(13);
  });

  it("returns the state it applied on, so a toast can diff exactly that step", async () => {
    const ctx = setup();
    const state = tracked();
    void ctx.engine.adjustHp(state, PLAYER_ID, -1);
    const second = await ctx.engine.adjustHp(state, PLAYER_ID, -1);
    expect(second.before.players[0]!.currentHp).toBe(14);
    expect(second.state.players[0]!.currentHp).toBe(13);
  });

  it("a turn played on the pre-fix state keeps a fix whose save is still pending", async () => {
    const ctx = setup();
    const state = started0(tracked());
    void ctx.engine.adjustHp(state, PLAYER_ID, -5);
    ctx.llm.queueStructured(reply({}));
    const outcome = await ctx.engine.playTurn(state, { type: "action", text: "Miro", playerId: PLAYER_ID });
    if (!outcome.ok) throw new Error("turn failed");
    expect(outcome.state.players[0]!.currentHp).toBe(10);
    expect((await ctx.repo.load(state.id))!.players[0]!.currentHp).toBe(10);
  });

  it("a turn played on an older state is not applied onto a tracked state with more turns", async () => {
    const ctx = setup();
    const older = started0(tracked());
    ctx.llm.queueStructured(
      reply({ stateChanges: [{ type: "inventory_add", playerId: PLAYER_ID, item: "Llave", quantity: 1 }] }),
      reply({ stateChanges: [{ type: "inventory_add", playerId: PLAYER_ID, item: "Daga", quantity: 1 }] }),
    );
    const first = await ctx.engine.playTurn(older, { type: "action", text: "Miro", playerId: PLAYER_ID });
    if (!first.ok) throw new Error("first turn failed");
    expect(first.state.turns).toHaveLength(2);
    // The caller still holds the state from before the first turn.
    const second = await ctx.engine.playTurn(older, { type: "action", text: "Busco", playerId: PLAYER_ID });
    if (!second.ok) throw new Error("second turn failed");
    expect(second.state.players[0]!.inventory.map((i) => i.name)).toEqual(["Daga"]);
  });

  it("a later summary keeps the manual fix", async () => {
    const ctx = setup();
    const state = tracked();
    const fixed = await ctx.engine.adjustHp(state, PLAYER_ID, -5);
    const next = await ctx.engine.applySummary(state, { summary: "R", summarizedThroughTurn: 0 });
    expect(next.state.players[0]!.currentHp).toBe(fixed.state.players[0]!.currentHp);
  });
});

/** A tracked game that already has its opening turn, so actions are legal. */
function started0(state: GameState): GameState {
  return { ...state, turns: [{ number: 1, input: { type: "start" }, narration: "Hola", events: [] }] };
}

describe("death saves", () => {
  const withCondition = (state: GameState, condition: "ok" | "dying" | "stable" | "dead", failures = 0): GameState => ({
    ...state,
    players: state.players.map((p) => ({ ...p, currentHp: 0, condition, deathSaves: { successes: 0, failures } })),
  });
  const save = (natural: number) => ({ type: "death_save" as const, playerId: PLAYER_ID, natural });

  it("rejects a death save from a player who is not dying", async () => {
    const ctx = setup();
    const game = await started(ctx);
    const outcome = await ctx.engine.playTurn(game, save(8));
    expect(outcome).toMatchObject({ ok: false, failure: { kind: "invalid_input" } });
  });

  it("rejects a natural outside 1-20", async () => {
    const ctx = setup();
    const game = withCondition(await started(setup()), "dying");
    for (const natural of [0, 21]) {
      const outcome = await ctx.engine.playTurn(game, save(natural));
      expect(outcome).toMatchObject({ ok: false, failure: { kind: "invalid_input" } });
    }
  });

  it("rejects any action from a dead player", async () => {
    const ctx = setup();
    const game = withCondition(await started(setup()), "dead", 3);
    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Me levanto" });
    expect(outcome).toMatchObject({ ok: false, failure: { kind: "invalid_input" } });
  });

  it("resolves the save before the prompt and keeps it even if the DM proposes nothing", async () => {
    const ctx = setup();
    const game = withCondition(await started(setup()), "dying");
    ctx.llm.queueStructured(reply({ narration: "La oscuridad te tira hacia abajo." }));
    const outcome = await ctx.engine.playTurn(game, save(8));
    expect(ctx.llm.structuredRequests.at(-1)!.prompt).toContain(
      "SALVACIÓN CONTRA LA MUERTE (resuelta por el sistema): 8, fallo. Van 0 éxitos y 1 fallo.",
    );
    if (!outcome.ok) throw new Error("turn failed");
    expect(outcome.state.players[0]!.deathSaves).toEqual({ successes: 0, failures: 1 });
    expect((await ctx.repo.load(game.id))?.players[0]!.deathSaves.failures).toBe(1);
  });

  it("tells the DM about a natural 20 and a third failure", async () => {
    const ctx = setup();
    const game = withCondition(await started(setup()), "dying", 2);
    ctx.llm.queueStructured(reply({}));
    await ctx.engine.playTurn(game, save(20));
    expect(ctx.llm.structuredRequests.at(-1)!.prompt).toContain("20 natural: recupera 1 PG y se levanta.");
    ctx.llm.queueStructured(reply({}));
    const outcome = await ctx.engine.playTurn(game, save(4));
    expect(ctx.llm.structuredRequests.at(-1)!.prompt).toContain("Tercer fallo: el personaje muere.");
    expect(outcome.ok && outcome.state.players[0]!.condition).toBe("dead");
  });

  it("a failed turn leaves the save unresolved", async () => {
    const ctx = setup();
    const game = withCondition(await started(setup()), "dying");
    ctx.llm.queueStructured("no es json");
    ctx.llm.queueStructured("tampoco");
    const outcome = await ctx.engine.playTurn(game, save(8));
    expect(outcome.ok).toBe(false);
    expect(outcome.state.players[0]!.deathSaves.failures).toBe(0);
  });
});

describe("a roll asked while the player can't act", () => {
  it("is dropped when the reply leaves the player dying", async () => {
    const ctx = setup();
    const game = await started(setup());
    const stats = {
      maxHp: 20, armorClass: 14, initiative: 3, speed: 30, hitDice: "3d8",
      attacks: [], spellSaveDc: null, spellAttackBonus: null,
    };
    const up = { ...game, players: game.players.map((p) => ({ ...p, stats, currentHp: 3 })) };
    ctx.llm.queueStructured(
      reply({
        stateChanges: [{ type: "hp", target: PLAYER_ID, delta: -10 }],
        playerRoll: { die: "d20", count: 1, reason: "Salvación de Constitución", difficulty: 12, mode: "normal" },
      }),
    );
    const outcome = await ctx.engine.playTurn(up, { type: "action", text: "Resisto" });
    if (!outcome.ok) throw new Error("turn failed");
    expect(outcome.state.players[0]!.condition).toBe("dying");
    expect(outcome.state.pendingPlayerRoll).toBeNull();
  });
});

describe("suggested actions", () => {
  it("are saved with the turn", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(reply({ suggestions: ["Interrogo al guardia", "Reviso la puerta"] }));
    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Miro" });
    expect(outcome.ok && outcome.state.suggestedActions).toEqual(["Interrogo al guardia", "Reviso la puerta"]);
  });

  it("are dropped when the DM asks for a roll", async () => {
    const ctx = setup();
    const game = await started(ctx);
    ctx.llm.queueStructured(
      reply({
        suggestions: ["Corro"],
        playerRoll: { die: "d20", count: 1, reason: "Sigilo", difficulty: 12, mode: "normal" },
      }),
    );
    const outcome = await ctx.engine.playTurn(game, { type: "action", text: "Me escondo" });
    expect(outcome.ok && outcome.state.suggestedActions).toEqual([]);
  });
});

describe("suggestFor", () => {
  it("asks only for suggestions, about the turns so far, and saves nothing", async () => {
    const ctx = setup();
    const state = await started(ctx);
    const saved = await ctx.repo.load(state.id);
    ctx.llm.queueStructured({ suggestions: ["Interrogo al guardia", "  Interrogo  al guardia ", "Reviso la puerta"] });
    expect(await ctx.engine.suggestFor(state)).toEqual(["Interrogo al guardia", "Reviso la puerta"]);
    const request = ctx.llm.structuredRequests.at(-1)!;
    expect(request.prompt).toContain("TURNOS RECIENTES");
    expect(request.prompt).toContain(state.turns[0]!.narration);
    expect(await ctx.repo.load(state.id)).toEqual(saved);
  });

  it("returns none for a game not started or when the model fails", async () => {
    const ctx = setup();
    expect(await ctx.engine.suggestFor(newGame())).toEqual([]);
    const state = await started(ctx);
    ctx.llm.queueStructured(new Error("boom"), "not json");
    expect(await ctx.engine.suggestFor(state)).toEqual([]);
    expect(await ctx.engine.suggestFor(state)).toEqual([]);
  });
});

describe("TurnEngine.updatePlayer", () => {
  it("replaces the player and saves without adding a turn", async () => {
    const ctx = setup();
    const state = newGame();
    const out = await ctx.engine.updatePlayer(state, state.players[0]!.id, (p) => ({ ...p, level: 4 }));
    expect(out.state.players[0]!.level).toBe(4);
    expect(out.state.turns).toHaveLength(state.turns.length);
    expect(out.saveError).toBeNull();
    expect((await ctx.repo.load(state.id))!.players[0]!.level).toBe(4);
  });

  it("an unknown player leaves the state as it was and saves nothing", async () => {
    const ctx = setup();
    const state = newGame();
    const out = await ctx.engine.updatePlayer(state, "nobody", (p) => ({ ...p, level: 4 }));
    expect(out.state).toBe(state);
    expect(await ctx.repo.load(state.id)).toBeNull();
  });
});
