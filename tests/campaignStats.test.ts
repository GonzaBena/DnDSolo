import { describe, expect, it } from "vitest";
import { campaignStats, timelineOf } from "../src/domain/campaignStats";
import type { GameState, Npc, Turn, TurnInput } from "../src/domain/types";
import { newGame, PLAYER_ID } from "./helpers";

function turn(number: number, extra: Partial<Turn> = {}, input: TurnInput = { type: "action", text: "Sigo" }): Turn {
  return { number, input, narration: "…", events: [], ...extra };
}
const chapter = (name: string, firstVisit = true) => ({ name, description: "", firstVisit });
function npc(name: string, extra: Partial<Npc> = {}): Npc {
  return { name, description: "", attitude: "neutral", present: false, voice: "", portrait: null, hp: null, maxHp: null, seen: true, ...extra };
}
const roll = (die: "d20" | "d6", value: number, count?: number): TurnInput => ({
  type: "action",
  text: "",
  roll: { die, value, modifier: 2, ...(count !== undefined ? { count } : {}) },
});
const game = (extra: Partial<GameState>): GameState => ({ ...newGame(), ...extra });

describe("campaignStats", () => {
  it("places are the distinct chapter names", () => {
    const state = game({
      turns: [turn(1, { chapter: chapter("Cripta") }), turn(2, { chapter: chapter("Bosque") }), turn(3, { chapter: chapter("cripta ", false) })],
    });
    expect(campaignStats(state).places).toBe(2);
  });

  it("without chapters, the current place counts as one, or none when it has no name", () => {
    expect(campaignStats(game({ location: { name: "Posada", description: "" }, turns: [turn(1)] })).places).toBe(1);
    expect(campaignStats(game({ location: { name: "", description: "" }, turns: [] })).places).toBe(0);
  });

  it("people and monsters count the NPCs seen, split by portrait; old saves without seen count", () => {
    const { seen: _drop, ...old } = npc("Berta");
    const state = game({
      npcs: [
        npc("Orvin"),
        old as Npc,
        npc("Rumor", { seen: false }),
        npc("Goblin 1", { portrait: "goblin", hp: 0, maxHp: 7 }),
        npc("Goblin 2", { portrait: "goblin", hp: 3, maxHp: 7 }),
        npc("Lobo", { portrait: "wolf" }),
      ],
    });
    expect(campaignStats(state)).toMatchObject({ people: 2, monsters: 3, monstersDefeated: 1 });
  });

  it("quests by status, and only threads the player can see", () => {
    const state = game({
      quests: [
        { title: "A", description: "", status: "completed" },
        { title: "B", description: "", status: "failed" },
        { title: "C", description: "", status: "active" },
        { title: "D", description: "", status: "active" },
      ],
      threads: [
        { title: "X", kind: "goal", description: "", status: "resolved", secret: false },
        { title: "Y", kind: "threat", description: "", status: "resolved", secret: true },
        { title: "Z", kind: "mystery", description: "", status: "open", secret: false },
      ],
    });
    expect(campaignStats(state)).toMatchObject({ questsCompleted: 1, questsFailed: 1, questsActive: 2, threadsResolved: 1 });
  });

  it("rolls and naturals: single d20s and death saves; 2d6 summing 1 is not a natural", () => {
    const state = game({
      turns: [
        turn(1, {}, roll("d20", 20)),
        turn(2, {}, roll("d20", 1, 1)),
        turn(3, {}, roll("d6", 1, 2)),
        turn(4, {}, roll("d20", 20, 2)),
        turn(5, {}, { type: "death_save", playerId: PLAYER_ID, natural: 20 }),
        turn(6, {}, { type: "death_save", playerId: PLAYER_ID, natural: 1 }),
        turn(7),
      ],
    });
    expect(campaignStats(state)).toMatchObject({ turns: 7, rolls: 6, natural20s: 2, natural1s: 2 });
  });

  it("with advantage, the kept die counts", () => {
    const input: TurnInput = { type: "action", text: "", roll: { die: "d20", value: 20, modifier: 0, mode: "advantage", rolls: [20, 4] } };
    expect(campaignStats(game({ turns: [turn(1, {}, input)] })).natural20s).toBe(1);
  });
});

describe("timelineOf", () => {
  it("first visits and moments in turn order, place before moments in the same turn", () => {
    const state = game({
      turns: [
        turn(1, { chapter: chapter("Posada") }),
        turn(2, { moments: [{ kind: "quest", title: "Ruta", status: "active" }] }),
        turn(3, { chapter: chapter("Cripta"), moments: [{ kind: "level", level: 4 }] }),
        turn(4, { chapter: chapter("Posada", false) }),
        turn(5, { moments: [{ kind: "death" }] }),
      ],
    });
    expect(timelineOf(state)).toEqual([
      { turn: 1, kind: "place", name: "Posada" },
      { turn: 2, kind: "quest", title: "Ruta", status: "active" },
      { turn: 3, kind: "place", name: "Cripta" },
      { turn: 3, kind: "level", level: 4 },
      { turn: 5, kind: "death" },
    ]);
  });

  it("old turns without chapters or moments add nothing", () => {
    expect(timelineOf(game({ turns: [turn(1), turn(2)] }))).toEqual([]);
  });
});
