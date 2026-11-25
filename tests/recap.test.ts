import { describe, expect, it } from "vitest";
import { RECAP_AFTER_MS, recapOf, shouldShowRecap } from "../src/domain/recap";
import type { GameState, Turn } from "../src/domain/types";
import { newGame } from "./helpers";

const turn = (narration: string): Turn => ({ number: 1, input: { type: "start" }, narration, events: [] });
const game = (extra: Partial<GameState> = {}): GameState => ({
  ...newGame(),
  updatedAt: "2026-01-01T00:00:00.000Z",
  turns: [turn("Llegás a la posada.")],
  ...extra,
});
const at = (ms: number) => new Date(Date.parse("2026-01-01T00:00:00.000Z") + ms);

describe("shouldShowRecap", () => {
  it("is 12 hours", () => {
    expect(RECAP_AFTER_MS).toBe(12 * 60 * 60 * 1000);
  });

  it("not before 12 hours, yes from 12 hours on", () => {
    expect(shouldShowRecap(game(), at(RECAP_AFTER_MS - 60_000))).toBe(false);
    expect(shouldShowRecap(game(), at(RECAP_AFTER_MS))).toBe(true);
  });

  it("never for a game with no turns or a dead hero", () => {
    expect(shouldShowRecap(game({ turns: [] }), at(RECAP_AFTER_MS * 2))).toBe(false);
    const dead = game();
    dead.players = dead.players.map((p) => ({ ...p, condition: "dead" }));
    expect(shouldShowRecap(dead, at(RECAP_AFTER_MS * 2))).toBe(false);
  });
});

describe("recapOf", () => {
  it("summary paragraphs, or none when there is no summary", () => {
    expect(recapOf(game({ summary: "Uno.\n\nDos.\n" })).summary).toEqual(["Uno.", "Dos."]);
    expect(recapOf(game({ summary: "  " })).summary).toEqual([]);
  });

  it("only active quests", () => {
    const recap = recapOf(
      game({
        quests: [
          { title: "Ruta", description: "Llegar al paso", status: "active" },
          { title: "Vieja", description: "", status: "completed" },
        ],
      }),
    );
    expect(recap.quests).toEqual([{ title: "Ruta", description: "Llegar al paso" }]);
  });

  it("where you are: place, combat, pending roll and dying", () => {
    const roll = { die: "d20" as const, count: 1, reason: "Sigilo", difficulty: 14, mode: "normal" as const };
    const base = game({
      location: { name: "Cripta de Vel", description: "" },
      scene: { inCombat: true, turnOf: null, order: [] },
      pendingPlayerRoll: roll,
    });
    expect(recapOf(base)).toMatchObject({ place: "Cripta de Vel", inCombat: true, pendingRoll: roll, dying: false });
    base.players = base.players.map((p) => ({ ...p, condition: "dying" }));
    expect(recapOf(base).dying).toBe(true);
  });

  it("last words: the last paragraph of the last narration", () => {
    expect(recapOf(game({ turns: [turn("Primero.\n\nAl final, la puerta cruje.")] })).lastWords).toEqual({
      speaker: null,
      text: "Al final, la puerta cruje.",
    });
  });

  it("last words of an NPC carry who speaks, without the marker", () => {
    expect(recapOf(game({ turns: [turn("Orvin te mira.\n\n[[Orvin]] —Vení.")] })).lastWords).toEqual({
      speaker: "Orvin",
      text: "—Vení.",
    });
  });

  it("a long paragraph keeps its last whole sentences that fit in 300 characters", () => {
    const sentence = "Esta es una oración de relleno que mide unos cincuenta. ";
    const text = (sentence.repeat(8) + "Y el esqueleto levanta la espada.").trim();
    const words = recapOf(game({ turns: [turn(text)] })).lastWords!.text;
    expect(words.startsWith("…")).toBe(true);
    expect(words.endsWith("Y el esqueleto levanta la espada.")).toBe(true);
    expect(words.length).toBeLessThanOrEqual(301);
    expect(words.slice(1)).toMatch(/^Esta es/);
  });

  it("one sentence longer than 300 characters keeps its last 300", () => {
    const text = "a".repeat(400);
    expect(recapOf(game({ turns: [turn(text)] })).lastWords!.text).toBe("…" + "a".repeat(300));
  });

  it("no turns, no last words", () => {
    expect(recapOf(game({ turns: [] })).lastWords).toBeNull();
  });
});
