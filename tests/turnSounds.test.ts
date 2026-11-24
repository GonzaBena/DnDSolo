import { describe, expect, it } from "vitest";
import type { Condition, GameState } from "../src/domain/types";
import { turnSounds } from "../src/game/turnSounds";
import { newGame } from "./helpers";

/** The hero with these hit points and condition. */
function hero(game: GameState, hp: number, condition: Condition = "ok"): GameState {
  return { ...game, players: game.players.map((p, i) => (i === 0 ? { ...p, currentHp: hp, condition } : p)) };
}

describe("turnSounds", () => {
  const game = newGame();

  it("a hit that leaves the hero standing", () => {
    expect(turnSounds(hero(game, 10), hero(game, 6), ["damage_taken"])).toEqual(["hit"]);
  });

  it("dropping to 0 is a heartbeat, not a hit as well", () => {
    expect(turnSounds(hero(game, 4), hero(game, 0, "dying"), ["damage_taken"])).toEqual(["heartbeat"]);
  });

  it("a death save turn while still dying beats again", () => {
    expect(turnSounds(hero(game, 0, "dying"), hero(game, 0, "dying"), [])).toEqual(["heartbeat"]);
  });

  it("dying is the end of the game", () => {
    expect(turnSounds(hero(game, 0, "dying"), hero(game, 0, "dead"), [])).toEqual(["gameOver"]);
  });

  it("a dead hero stays quiet", () => {
    expect(turnSounds(hero(game, 0, "dead"), hero(game, 0, "dead"), [])).toEqual([]);
  });

  it("a quiet turn plays nothing", () => {
    expect(turnSounds(hero(game, 10), hero(game, 10), [])).toEqual([]);
  });
});
