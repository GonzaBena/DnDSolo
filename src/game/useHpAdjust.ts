import { useState, type Dispatch, type SetStateAction } from "react";
import type { GameState } from "../domain/types";
import type { TurnEngine } from "../engine/TurnEngine";
import type { ToastItem } from "./EventToasts";
import { buildTurnToasts } from "./turnToasts";
import { SAVE_WARNING, type GameSession } from "./useGameSession";

/** The player's manual HP fixes (the -/+ buttons). `hpPending` counts the ones
    still saving: no turn may start on the screen's older state meanwhile. */
export function useHpAdjust(session: GameSession, setToasts: Dispatch<SetStateAction<ToastItem[]>>) {
  const [hpPending, setHpPending] = useState(0);
  const { setScreen, setWarning, latestStateRef, changedRef, generationRef, track } = session;

  const adjustHp = async (engine: TurnEngine, state: GameState, delta: number) => {
    const held = latestStateRef.current ?? state;
    const playerId = held.players[0]?.id;
    if (!playerId) return;
    changedRef.current = true;
    setHpPending((count) => count + 1);
    const generation = generationRef.current;
    let applied: Awaited<ReturnType<TurnEngine["adjustHp"]>>;
    try {
      applied = await track(engine.adjustHp(held, playerId, delta));
    } finally {
      setHpPending((count) => count - 1);
    }
    if (generationRef.current !== generation) return;
    // The toast diffs the exact step, even if clicks overlapped.
    const before = applied.before;
    const current = latestStateRef.current;
    if (!current || (current.id === applied.state.id && current.turns.length <= applied.state.turns.length)) {
      latestStateRef.current = applied.state;
    }
    setScreen((previous) =>
      previous.status === "playing" &&
      previous.state.id === applied.state.id &&
      previous.state.turns.length <= applied.state.turns.length
        ? { ...previous, state: applied.state }
        : previous,
    );
    const hpToasts = buildTurnToasts(before, applied.state, [], Date.now());
    if (hpToasts.length > 0) setToasts((prev) => [...prev, ...hpToasts]);
    // No shake or flash: the player made this correction themselves.
    if (applied.saveError) setWarning(SAVE_WARNING);
  };

  return { hpPending, adjustHp };
}
