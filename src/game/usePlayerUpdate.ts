import type { Character, GameState } from "../domain/types";
import type { TurnEngine } from "../engine/TurnEngine";
import { SAVE_WARNING, type GameSession } from "./useGameSession";

/** The shown state with the saved players: what only lives on screen (an
    old save's suggestions) stays. */
export function withPlayersFrom(shown: GameState, saved: GameState): GameState {
  return { ...shown, players: saved.players, updatedAt: saved.updatedAt };
}

/** Replaces one player outside a turn (a level up's choices, an upgraded
    sheet), saves, and shows the result, as the HP buttons do. */
export function usePlayerUpdate(session: GameSession) {
  const { setScreen, setWarning, latestStateRef, changedRef, track } = session;

  return async (engine: TurnEngine, state: GameState, playerId: string, update: (p: Character) => Character) => {
    const held = latestStateRef.current ?? state;
    changedRef.current = true;
    const applied = await track(engine.updatePlayer(held, playerId, update));
    const current = latestStateRef.current;
    if (!current || (current.id === applied.state.id && current.turns.length <= applied.state.turns.length)) {
      latestStateRef.current = applied.state;
    }
    setScreen((previous) =>
      previous.status === "playing" &&
      previous.state.id === applied.state.id &&
      previous.state.turns.length <= applied.state.turns.length
        ? { ...previous, state: withPlayersFrom(previous.state, applied.state) }
        : previous,
    );
    if (applied.saveError) setWarning(SAVE_WARNING);
  };
}
