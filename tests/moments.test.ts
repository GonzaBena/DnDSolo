import { describe, expect, it } from "vitest";
import { momentsOf } from "../src/domain/moments";
import type { GameState, Quest } from "../src/domain/types";
import { newGame } from "./helpers";

const withQuests = (game: GameState, quests: Quest[]): GameState => ({ ...game, quests });
const quest = (title: string, status: Quest["status"], description = "Algo"): Quest => ({ title, description, status });

describe("momentsOf", () => {
  it("a new quest is a moment with its status", () => {
    const prev = newGame();
    expect(momentsOf(prev, withQuests(prev, [quest("Ruta", "active")]))).toEqual([
      { kind: "quest", title: "Ruta", status: "active" },
    ]);
  });

  it("a quest that changes status is a moment; one that only changes its description is not", () => {
    const prev = withQuests(newGame(), [quest("Ruta", "active"), quest("Sello", "active")]);
    const next = withQuests(prev, [quest("Ruta", "completed"), quest("Sello", "active", "Otra cosa")]);
    expect(momentsOf(prev, next)).toEqual([{ kind: "quest", title: "Ruta", status: "completed" }]);
  });

  it("quest titles match ignoring case and spaces", () => {
    const prev = withQuests(newGame(), [quest("Ruta", "active")]);
    expect(momentsOf(prev, withQuests(prev, [quest("ruta ", "active")]))).toEqual([]);
  });

  it("a level up is a moment with the new level", () => {
    const prev = newGame();
    const next = { ...prev, players: prev.players.map((p) => ({ ...p, level: 4 })) };
    expect(momentsOf(prev, next)).toEqual([{ kind: "level", level: 4 }]);
  });

  it("a player becoming dead is a death moment, once", () => {
    const base = newGame();
    const dying = { ...base, players: base.players.map((p) => ({ ...p, condition: "dying" as const })) };
    const dead = { ...base, players: base.players.map((p) => ({ ...p, condition: "dead" as const })) };
    expect(momentsOf(dying, dead)).toEqual([{ kind: "death" }]);
    expect(momentsOf(dead, dead)).toEqual([]);
  });

  it("order: quests, then level, then death", () => {
    const prev = newGame();
    const next = {
      ...withQuests(prev, [quest("Ruta", "failed")]),
      players: prev.players.map((p) => ({ ...p, level: 4, condition: "dead" as const })),
    };
    expect(momentsOf(prev, next).map((m) => m.kind)).toEqual(["quest", "level", "death"]);
  });
});
