import { describe, expect, it } from "vitest";
import type { GameState, Turn } from "../src/domain/types";
import { narrationExcerpt, summarizeCampaign } from "../src/home/campaignSummary";
import { loadMockGame } from "../src/persistence/mockGame";

const turn = (number: number, narration: string): Turn => ({
  number,
  input: { type: "start" },
  narration,
  events: [],
});

function gameWith(overrides: Partial<GameState>): GameState {
  const base = loadMockGame(new Date("2026-11-21T15:00:00Z"));
  const player = { ...base.players[0]!, name: "Thalia", characterClass: "Pícara", level: 3 };
  return { ...base, players: [player], ...overrides } as GameState;
}

describe("summarizeCampaign", () => {
  it("describes the player and the progress", () => {
    const turns = Array.from({ length: 42 }, (_, i) => turn(i + 1, "Algo pasa."));
    const summary = summarizeCampaign(gameWith({ turns, updatedAt: "2026-11-21T15:00:00Z" }));
    expect(summary.name).toBe("Thalia");
    expect(summary.subtitle).toBe("Pícara · nivel 3");
    expect(summary.initials).toBe("T");
    expect(summary.detail).toBe("42 turnos · 21/11/2026");
  });

  it("uses the singular for one turn", () => {
    const summary = summarizeCampaign(gameWith({ turns: [turn(1, "Hola.")] }));
    expect(summary.detail.startsWith("1 turno ·")).toBe(true);
  });

  it("copes with a game without a player", () => {
    const summary = summarizeCampaign(gameWith({ players: [] }));
    expect(summary.name).toBe("Sin personaje");
    expect(summary.subtitle).toBe("");
    expect(summary.initials).toBe("?");
  });

  it("keeps a whole emoji as the initial", () => {
    const game = gameWith({});
    const summary = summarizeCampaign({ ...game, players: [{ ...game.players[0]!, name: "🐉 Ignis" }] });
    expect(summary.initials).toBe("🐉");
  });

  it("skips turns without narration for the excerpt", () => {
    const summary = summarizeCampaign(gameWith({ turns: [turn(1, "La puerta cede."), turn(2, "  ")] }));
    expect(summary.excerpt).toBe("La puerta cede.");
  });

  it("has no excerpt without turns", () => {
    expect(summarizeCampaign(gameWith({ turns: [] })).excerpt).toBe("");
  });
});

describe("narrationExcerpt", () => {
  it("keeps the whole trailing sentences that fit", () => {
    const text = "Entrás a la cripta. La puerta cede con un crujido. Abajo, algo respira.";
    expect(narrationExcerpt(text, 60)).toBe("La puerta cede con un crujido. Abajo, algo respira.");
  });

  it("cuts a sentence too long at a word boundary", () => {
    const sentence = `${"palabra ".repeat(25)}final.`;
    const excerpt = narrationExcerpt(sentence, 140);
    expect(excerpt.length).toBeLessThanOrEqual(141);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.slice(0, -1).split(" ").every((word) => word === "palabra")).toBe(true);
  });

  it("fits two lines of a phone card by default", () => {
    const text = "La lluvia golpea las tejas del molino abandonado. La puerta de la cripta cede con un crujido. Abajo, algo respira en la oscuridad.";
    expect(narrationExcerpt(text).length).toBeLessThanOrEqual(90);
    expect(narrationExcerpt(text).endsWith("algo respira en la oscuridad.")).toBe(true);
  });

  it("strips markdown headings, list marks and links", () => {
    expect(narrationExcerpt("## La cripta\n- Ves una [puerta](https://x.y) cerrada.")).toBe("La cripta Ves una puerta cerrada.");
  });

  it("strips markdown marks and collapses whitespace", () => {
    expect(narrationExcerpt("**Cuidado**:  el\n\nsuelo _cruje_.")).toBe("Cuidado: el suelo cruje.");
  });
});
