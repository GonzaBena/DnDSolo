import { describe, expect, it } from "vitest";
import { freshest } from "../src/game/freshest";
import { newGame } from "./helpers";

describe("freshest", () => {
  const state = newGame();
  const held = { ...state, updatedAt: "later" };

  it("prefers the held state of the same game and turn count", () => {
    expect(freshest(state, held)).toBe(held);
  });

  it("keeps the caller's state without a held one, for another game or another turn count", () => {
    expect(freshest(state, null)).toBe(state);
    expect(freshest(state, { ...held, id: "other" })).toBe(state);
    const turn = { number: 1, input: { type: "start" as const }, narration: "n", events: [] };
    expect(freshest(state, { ...held, turns: [turn] })).toBe(state);
  });
});
