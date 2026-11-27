import { useEffect, useRef } from "react";
import type { GameSession } from "./useGameSession";

/** An old save, from before suggestions existed, opens without them: ask
    once, on entering, unless the DM is waiting on a roll. Turns played
    afterwards bring their own. Kept on screen only: the next turn saves its own. */
export function useOldSaveSuggestions(session: GameSession, canAct: boolean) {
  const { screen, setScreen, suggestionsMode, generationRef } = session;
  const askedSuggestionsRef = useRef<string | null>(null);
  useEffect(() => {
    if (screen.status !== "playing" || suggestionsMode !== "auto" || !canAct) return;
    const { engine, state } = screen;
    if (state.turns.length === 0 || state.turns.length !== screen.loadedTurns) return; // only on entering
    if (state.suggestedActions.length > 0 || state.pendingPlayerRoll) return;
    if (!state.players.some((p) => p.condition === "ok")) return;
    if (askedSuggestionsRef.current === state.id) return;
    askedSuggestionsRef.current = state.id;
    const generation = generationRef.current;
    void engine.suggestFor(state).then((actions) => {
      if (actions.length === 0 || generation !== generationRef.current) return;
      setScreen((current) =>
        current.status === "playing" &&
        current.state.id === state.id &&
        current.state.turns.length === state.turns.length &&
        current.state.suggestedActions.length === 0
          ? { ...current, state: { ...current.state, suggestedActions: actions } }
          : current,
      );
    });
  }, [screen, suggestionsMode, canAct, setScreen, generationRef]);
}
