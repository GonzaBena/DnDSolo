import { useCallback, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { shakeScreen } from "../animations/motion";
import type { GameState, TurnInput } from "../domain/types";
import type { TurnEngine, TurnOutcome } from "../engine/TurnEngine";
import { describeLLMError } from "../llm/errorMessages";
import { sendAfterRenewal, shouldDropSend } from "../sync/openGame";
import { turnBanners, type Banner } from "./bannerQueue";
import type { ToastItem } from "./EventToasts";
import { describeFailure } from "./failureNotice";
import { freshest } from "./freshest";
import { buildTurnToasts, tookDamage } from "./turnToasts";
import { createTypewriter } from "./typewriter";
import { SAVE_WARNING, type GameSession } from "./useGameSession";

interface Ui {
  setDraft: Dispatch<SetStateAction<string>>;
  setToasts: Dispatch<SetStateAction<ToastItem[]>>;
  scrollToBottom: () => void;
  /** The game section, shaken and flashed red when the hero takes damage. */
  gameRef: RefObject<HTMLElement | null>;
  /** Queues the banners a live turn raises (new place, ambush). */
  showBanners: (banners: Banner[]) => void;
}

/** Plays turns: streams the DM's narration, then shows, saves and summarizes
    the result. `send` is for turns the app takes on its own; `sendFromPlayer`
    for the player's, which may first have to renew the Google session. */
export function useSendTurn(session: GameSession, { setDraft, setToasts, scrollToBottom, gameRef, showBanners }: Ui) {
  const [busy, setBusy] = useState(false);
  const {
    setScreen,
    setInFlight,
    setError,
    setWarning,
    sync,
    abortRef,
    latestStateRef,
    changedRef,
    generationRef,
    pauseRef,
    setPause,
    track,
  } = session;

  const send = useCallback(
    async (
      engine: TurnEngine,
      shownState: GameState,
      input: TurnInput,
      typed?: string,
      // Read by the click itself, before any Google window: the engine and
      // state it passes belong to that screen.
      generation = generationRef.current,
    ) => {
      const replacing = pauseRef.current.replacing || pauseRef.current.opening;
      if (shouldDropSend(generation, generationRef.current, replacing)) {
        // Nothing was sent: give the typed text back instead of losing it.
        const text = typed ?? (input.type === "action" ? input.text : "");
        if (text !== "") setDraft((current) => (current === "" ? text : current));
        return;
      }
      // A manual HP fix may be newer than the rendered state: start from it,
      // so the model sees it and the toasts don't announce it again.
      const state = freshest(shownState, latestStateRef.current);
      changedRef.current = true;
      setBusy(true);
      // Whoever sends wants to see the reply, even if they had scrolled up.
      scrollToBottom();
      setError(null);
      setWarning(null);
      setInFlight({ input, narration: "", draft: typed });
      const typewriter = createTypewriter((narration) =>
        setInFlight({ input, narration, draft: typed }),
      );
      const controller = new AbortController();
      abortRef.current = controller;
      const aborted = new Promise<void>((resolve) =>
        controller.signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      let outcome: TurnOutcome | null = null;
      try {
        outcome = await track(engine.playTurn(
          state,
          input,
          (narration) => typewriter.setTarget(narration),
          controller.signal,
          // The turn is committed only after the text is fully shown, and a
          // Stop meanwhile doesn't wait for the typewriter.
          () => Promise.race([typewriter.finish(), aborted]),
        ));
      } catch (error) {
        // Not a failure playTurn reports; keep the input so the player can retry.
        console.error(error);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        typewriter.cancel();
        setBusy(false);
      }
      // Drive's copy replaced the screen meanwhile: this turn belongs to the old one.
      if (generationRef.current !== generation) return;
      if (outcome === null) {
        setInFlight({ input, narration: "", draft: typed });
        setError({ message: describeLLMError(null), suggestSettings: false });
        return;
      }
      // Set right away so a summary that resolves meanwhile is applied on top
      // of this turn.
      if (outcome.ok) {
        const held = latestStateRef.current;
        const heldIsNewer =
          held !== null &&
          held.id === outcome.state.id &&
          (held.turns.length > outcome.state.turns.length ||
            (held.turns.length === outcome.state.turns.length &&
              held.summarizedThroughTurn > outcome.state.summarizedThroughTurn));
        if (!heldIsNewer) {
          latestStateRef.current =
            held !== null &&
            held.id === outcome.state.id &&
            held.summarizedThroughTurn > outcome.state.summarizedThroughTurn
              ? {
                  ...outcome.state,
                  summary: held.summary,
                  summarizedThroughTurn: held.summarizedThroughTurn,
                }
              : outcome.state;
        }
      }
      if (
        !outcome.ok &&
        outcome.failure.kind === "aborted" &&
        input.type === "action" &&
        !input.roll
      ) {
        // Nothing happened: the text goes back to the box to edit or resend.
        setInFlight(null);
        setDraft(typed ?? input.text);
        return;
      }
      if (!outcome.ok) {
        // Keep the input on screen so "Reintentar" resends exactly this:
        // enemy dice that were already rolled must not be rolled again.
        setInFlight({ input, narration: "", draft: typed });
        setError(describeFailure(outcome.failure));
        return;
      }
      setInFlight(null);
      const turnToasts = buildTurnToasts(state, outcome.state, outcome.response.events, Date.now());
      if (turnToasts.length > 0) setToasts((prev) => [...prev, ...turnToasts]);
      const lastTurn = outcome.state.turns.at(-1);
      if (lastTurn) {
        const raised = turnBanners(lastTurn, outcome.response.events);
        if (raised.length > 0) showBanners(raised);
      }
      if (tookDamage(outcome.response.events, state, outcome.state) && gameRef.current) {
        const el = gameRef.current;
        shakeScreen(el);
        el.classList.add("game--damage-flash");
        setTimeout(() => el.classList.remove("game--damage-flash"), 400);
      }
      // The ref was just reconciled with any summary that landed meanwhile.
      const shown = latestStateRef.current ?? outcome.state;
      setScreen((previous) => ({
        status: "playing",
        engine,
        state: shown,
        loadedTurns: previous.status === "playing" ? previous.loadedTurns : 0,
      }));
      if (outcome.saveError) {
        setWarning(SAVE_WARNING);
      }
      // The summary is written in the background; failures stay silent.
      void engine.summarizeIfDue(shown).then(async (patch) => {
        const latest = latestStateRef.current;
        if (!patch || !latest || latest.id !== shown.id) return;
        // Not over Drive's copy, nor while it is being written.
        if (generationRef.current !== generation || pauseRef.current.replacing) return;
        const applied = await track(engine.applySummary(latest, patch));
        if (generationRef.current !== generation) return;
        const appliedState = applied.state;
        // Nothing new to show when the ref already holds this summary.
        if (
          appliedState.summarizedThroughTurn <=
          (latestStateRef.current?.summarizedThroughTurn ?? 0)
        ) {
          if (applied.saveError) setWarning(SAVE_WARNING);
          return;
        }
        if (appliedState.turns.length >= (latestStateRef.current?.turns.length ?? 0)) {
          latestStateRef.current = appliedState;
        }
        setScreen((previous) =>
          previous.status === "playing" &&
          previous.state.id === appliedState.id &&
          appliedState.turns.length === previous.state.turns.length
            ? { ...previous, state: appliedState }
            : previous,
        );
        if (applied.saveError) setWarning(SAVE_WARNING);
      });
    },
    [
      scrollToBottom,
      track,
      setDraft,
      setToasts,
      showBanners,
      gameRef,
      setScreen,
      setInFlight,
      setError,
      setWarning,
      abortRef,
      latestStateRef,
      changedRef,
      generationRef,
      pauseRef,
    ],
  );

  /** A turn the player started. The Google window (if due) opens before any
      await, inside the player's gesture. */
  const sendFromPlayer = (engine: TurnEngine, state: GameState, input: TurnInput, typed?: string) => {
    changedRef.current = true;
    const generation = generationRef.current;
    void sendAfterRenewal(sync, (on) => setPause("renewing", on), () =>
      send(engine, state, input, typed, generation),
    );
  };

  return { busy, send, sendFromPlayer };
}
