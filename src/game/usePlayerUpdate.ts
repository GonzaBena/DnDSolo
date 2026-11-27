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

/** Applies a manual scene/inventory state edit outside a turn, saves, and shows it. */
export function useStateEdit(session: GameSession) {
  const { setScreen, setWarning, latestStateRef, changedRef, track } = session;

  return async (engine: TurnEngine, state: GameState, update: (s: GameState) => GameState) => {
    const held = latestStateRef.current ?? state;
    changedRef.current = true;
    const applied = await track(engine.updateState(held, update));
    const current = latestStateRef.current;
    if (!current || (current.id === applied.state.id && current.turns.length <= applied.state.turns.length)) {
      latestStateRef.current = applied.state;
    }
    setScreen((previous) =>
      previous.status === "playing" &&
      previous.state.id === applied.state.id &&
      previous.state.turns.length <= applied.state.turns.length
        ? {
            ...previous,
            state: {
              ...applied.state,
              suggestedActions: previous.state.suggestedActions,
            },
          }
        : previous,
    );
    if (applied.saveError) setWarning(SAVE_WARNING);
  };
}

/** The shown state with the saved NPCs and scene, after a rename. */
export function withNpcsFrom(shown: GameState, saved: GameState): GameState {
  return { ...shown, npcs: saved.npcs, scene: saved.scene, updatedAt: saved.updatedAt };
}

/** Renames an NPC outside a turn, saves, and shows the result. Resolves to
    the reason it couldn't, or null. */
export function useNpcRename(session: GameSession) {
  const { setScreen, setWarning, latestStateRef, changedRef, track } = session;

  return async (engine: TurnEngine, state: GameState, currentName: string, name: string, label: string) => {
    const held = latestStateRef.current ?? state;
    const applied = await track(engine.renameNpc(held, currentName, name, label));
    if ("error" in applied) return applied.error;
    changedRef.current = true;
    const current = latestStateRef.current;
    if (!current || (current.id === applied.state.id && current.turns.length <= applied.state.turns.length)) {
      latestStateRef.current = applied.state;
    }
    setScreen((previous) =>
      previous.status === "playing" &&
      previous.state.id === applied.state.id &&
      previous.state.turns.length <= applied.state.turns.length
        ? { ...previous, state: withNpcsFrom(previous.state, applied.state) }
        : previous,
    );
    if (applied.saveError) setWarning(SAVE_WARNING);
    return null;
  };
}
