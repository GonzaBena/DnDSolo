import { describe, expect, it } from "vitest";
import { GAME_STATE_VERSION } from "../src/domain/types";
import { TurnEngine } from "../src/engine/TurnEngine";
import { FakeLLMClient } from "../src/llm/FakeLLMClient";
import { InMemoryGameRepo } from "../src/persistence/InMemoryGameRepo";
import { loadMockGame } from "../src/persistence/mockGame";
import { reply } from "./helpers";

describe("docs/partida-mock.json", () => {
  const now = new Date("2030-01-01T00:00:00Z");

  it("is a valid, loadable save for the current version", () => {
    const game = loadMockGame(now);
    expect(game.version).toBe(GAME_STATE_VERSION);
    expect(game.updatedAt).toBe(now.toISOString());
    expect(game.turns.map((t) => t.number)).toEqual(game.turns.map((_, i) => i + 1));
    expect(game.summarizedThroughTurn).toBeLessThanOrEqual(game.turns.length);
    // The player's rolls are chat messages; the app never rolled them.
    expect(game.turns[3]!.input).toMatchObject({ type: "action" });
  });

  it("has enemy rolls in its log, so their cards show up in a loaded save", () => {
    const results = loadMockGame(now).turns.flatMap((t) =>
      t.input.type === "enemy_rolls" ? t.input.results : [],
    );
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.values).toHaveLength(result.count);
      expect(result.total).toBe(result.values.reduce((a, b) => a + b, 0) + result.modifier);
    }
  });

  it("can be continued by the engine, with its memory intact", async () => {
    const llm = new FakeLLMClient();
    const engine = new TurnEngine({ llm, repo: new InMemoryGameRepo() });
    const game = loadMockGame(now);
    llm.queueStructured(reply({ narration: "Amanece sobre los astilleros." }));
    llm.queueText("Resumen actualizado.");

    const outcome = await engine.playTurn(game, { type: "action", text: "Voy a los astilleros" });

    expect(outcome.ok).toBe(true);
    expect(outcome.state.turns).toHaveLength(game.turns.length + 1);
    const prompt = llm.structuredRequests[0]!.prompt;
    expect(prompt).toContain(game.summary);
    expect(prompt).toContain("Corazón de Ámbar");
    // Everything after the summary is sent verbatim; what it covers is not.
    expect(prompt).toContain(`[Turno ${game.summarizedThroughTurn + 1}]`);
    expect(prompt).not.toContain(`[Turno ${game.summarizedThroughTurn}]`);
  });
});
