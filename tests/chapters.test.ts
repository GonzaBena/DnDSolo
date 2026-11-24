import { describe, expect, it } from "vitest";
import { chapterOf } from "../src/domain/chapters";
import type { Chapter, GameState, Turn } from "../src/domain/types";
import { newGame } from "./helpers";

const turn = (chapter?: Chapter): Turn => ({
  number: 1,
  input: { type: "start" },
  narration: "",
  events: [],
  ...(chapter ? { chapter } : {}),
});

const at = (name: string, turns: Turn[], description = ""): GameState => ({
  ...newGame(),
  location: { name, description },
  turns,
});

describe("chapterOf", () => {
  it("opens a chapter when the location name changes", () => {
    expect(chapterOf(at("Camino", [turn()]), at("La Cripta de Vel", [turn()], "Piedra húmeda."))).toEqual({
      name: "La Cripta de Vel",
      description: "Piedra húmeda.",
      firstVisit: true,
    });
  });

  it("no chapter when the name is the same ignoring case and spaces", () => {
    expect(chapterOf(at("Taberna", [turn()]), at(" taberna ", [turn()]))).toBeNull();
  });

  it("no chapter for an empty name", () => {
    expect(chapterOf(at("Camino", [turn()]), at("  ", [turn()]))).toBeNull();
  });

  it("the first turn opens chapter 1 even if the location was set at creation", () => {
    expect(chapterOf(at("Pico Quebrado", []), at("Pico Quebrado", []))).toMatchObject({
      name: "Pico Quebrado",
      firstVisit: true,
    });
  });

  it("the first turn with no location yet opens no chapter", () => {
    expect(chapterOf(at("", []), at("", []))).toBeNull();
  });

  it("a place with an earlier chapter is a revisit", () => {
    const before = at("Calle", [
      turn({ name: "Taberna", description: "", firstVisit: true }),
      turn({ name: "Calle", description: "", firstVisit: true }),
    ]);
    expect(chapterOf(before, at("TABERNA", before.turns))).toMatchObject({ name: "TABERNA", firstVisit: false });
  });

  it("a different spelling of the same place opens no chapter", () => {
    const before = at("La Posada", [turn({ name: "La Posada", description: "", firstVisit: true })]);
    expect(chapterOf(before, at("la  posada", before.turns))).toBeNull();
  });

  it("a turn where the DM left the place blank doesn't open a chapter when it comes back", () => {
    const before = at("  ", [turn({ name: "Taberna", description: "", firstVisit: true }), turn()]);
    expect(chapterOf(before, at("Taberna", before.turns))).toBeNull();
  });
});
