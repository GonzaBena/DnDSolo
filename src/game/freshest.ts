import type { GameState } from "../domain/types";

/** The state a turn should start from: the newest one the screen knows of
    the same game and turn count (it carries manual HP fixes the rendered
    state may lag behind), else the one the caller holds. */
export function freshest(state: GameState, held: GameState | null): GameState {
  return held !== null && held.id === state.id && held.turns.length === state.turns.length ? held : state;
}
