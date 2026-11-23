import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, TurnInput } from "../domain/types";
import { TurnEngine } from "../engine/TurnEngine";
import { GeminiClient } from "../llm/GeminiClient";
import { isConfigured, loadSettings } from "../persistence/settings";
import { syncBeforeOpen } from "../sync/openGame";
import { createGameRepo, getSyncRuntime } from "../sync/runtime";
import type { FailureNotice } from "./failureNotice";

export type Screen =
  | { status: "loading" }
  | { status: "no_game" }
  | { status: "load_error" }
  /** `loadedTurns`: how many turns the save had when it was opened. */
  | { status: "playing"; engine: TurnEngine; state: GameState; loadedTurns: number };

/** A turn that was sent and hasn't produced a saved result yet. */
export interface InFlight {
  input: TurnInput;
  narration: string;
  /** What the player typed, before slash commands were expanded. */
  draft?: string;
}

export type PauseReason = "renewing" | "replacing" | "opening";

export const SAVE_WARNING = "El turno se jugó pero no se pudo guardar. Si recargás, lo perdés.";
const DRIVE_NEWER_NOTICE = "Se cargó la versión más reciente de Drive";
const DRIVE_NOTICE_MS = 4000;

export type GameSession = ReturnType<typeof useGameSession>;

/** Opens the game (local save, reconciled with Drive when sync is on) and
    holds what every action on the screen shares: the shown state, the turn in
    flight and its outcome, and the guards that keep Drive's copy and this
    session's work from overwriting each other. */
export function useGameSession() {
  const [screen, setScreen] = useState<Screen>({ status: "loading" });
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const [error, setError] = useState<FailureNotice | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  // The Drive notice is informational: it fades on its own. The save warning
  // stays, since it tells the player something they must act on.
  useEffect(() => {
    if (warning !== DRIVE_NEWER_NOTICE) return;
    const timer = setTimeout(
      () => setWarning((current) => (current === DRIVE_NEWER_NOTICE ? null : current)),
      DRIVE_NOTICE_MS,
    );
    return () => clearTimeout(timer);
  }, [warning]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  // The newest playing state, so a summary that resolves late is applied to
  // the game as it is now and not to the one the turn started from.
  const latestStateRef = useRef<GameState | null>(null);
  // Null when sync is off: then nothing below talks to Google.
  const [sync] = useState(getSyncRuntime);
  // Set once this session changed the game (a turn, even one still waiting
  // on the Google window, or an HP fix): from then on the sync engine keeps
  // the local copy, so a newer Drive copy becomes a conflict for the dialog.
  const changedRef = useRef(false);
  // Nothing may be sent while the Google window is open (a turn is already
  // waiting on it), while Drive's copy is being written under the screen, or
  // while a newer game from Drive is being opened in its place.
  // The ref answers handlers at once; the state re-renders the controls.
  const pauseRef = useRef<Record<PauseReason, boolean>>({ renewing: false, replacing: false, opening: false });
  const [paused, setPaused] = useState(false);
  const isPaused = useCallback(() => Object.values(pauseRef.current).some(Boolean), []);
  const setPause = useCallback((key: PauseReason, on: boolean) => {
    pauseRef.current[key] = on;
    setPaused(Object.values(pauseRef.current).some(Boolean));
  }, []);
  // Bumped when Drive's copy replaces the screen: work started before it
  // (a turn, a summary, an HP fix) must not touch the new state.
  const generationRef = useRef(0);
  // Turns and saves still running, so "use Drive's copy" can wait for them.
  const workRef = useRef(new Set<Promise<unknown>>());
  const track = useCallback(<T,>(work: Promise<T>): Promise<T> => {
    workRef.current.add(work);
    const done = () => void workRef.current.delete(work);
    work.then(done, done);
    return work;
  }, []);

  useEffect(() => {
    const settings = loadSettings();
    // Without a key there is nothing to play: send the player to settings,
    // which explains why they landed there (Spec, MVP scope 2).
    if (!isConfigured(settings)) {
      location.replace("/settings?missing=1");
      return;
    }
    setShowSuggestions(settings.showSuggestions);
    const repo = createGameRepo();
    const createEngine = () =>
      new TurnEngine({
        llm: new GeminiClient(settings.apiKey, settings.model, {
          fastNarration: settings.fastNarration,
        }),
        repo,
      });
    // /play?id=... opens a specific campaign; without it, the latest one.
    const id = new URLSearchParams(location.search).get("id");
    const load = () => (id ? repo.load(id) : repo.loadLatest());
    // Drive's copy replaced the shown game (a late reconcile, a background
    // sync, or the player chose it in the dialog). TurnEngine caches the
    // latest state per game: a fresh one forgets it.
    let shownId: string | null = null;
    const showFromDrive = (fresh: GameState) => {
      generationRef.current += 1;
      abortRef.current?.abort();
      changedRef.current = false;
      shownId = fresh.id;
      latestStateRef.current = fresh;
      setInFlight(null);
      setError(null);
      setScreen({ status: "playing", engine: createEngine(), state: fresh, loadedTurns: fresh.turns.length });
      setWarning(DRIVE_NEWER_NOTICE);
    };
    // Drive's copies written before their game was on screen: newer than
    // whatever the open's read returned.
    const written = new Map<string, GameState>();
    // The engine asks before writing Drive's copy of a game. For the shown
    // one, once this session changed it, the answer is no: the base stays
    // put and the next save is a conflict for the dialog.
    const unprotects: (() => void)[] = [];
    const protect = (gameId: string) => {
      const stop = sync?.engine.protectLocal(gameId, {
        mayReplace: () => {
          if (gameId !== shownId) return true; // nothing can be playing it yet
          if (changedRef.current) return false;
          setPause("replacing", true);
          return true;
        },
        hold: async () => {
          if (gameId !== shownId) return;
          setPause("replacing", true);
          abortRef.current?.abort();
          // The turn in flight may be past its last abort check: wait for it
          // and its save, so the engine sees it and asks again.
          while (workRef.current.size > 0) await Promise.allSettled([...workRef.current]);
        },
        replaced: (fresh) => {
          setPause("replacing", false);
          if (!fresh) return;
          if (gameId === shownId) showFromDrive(fresh);
          else written.set(gameId, fresh);
        },
      });
      if (stop) unprotects.push(stop);
    };
    /** Shows `opened`, or Drive's copy if one was written since `protect`. */
    const show = (opened: GameState, notice: boolean) => {
      const fresh = written.get(opened.id);
      if (fresh || notice) return showFromDrive(fresh ?? opened);
      shownId = opened.id;
      latestStateRef.current = opened;
      setScreen({ status: "playing", engine: createEngine(), state: opened, loadedTurns: opened.turns.length });
    };
    /** Registers the guard, then re-reads: covers a write before it existed. */
    const guardAndReread = async (state: GameState) => {
      protect(state.id);
      return (await repo.load(state.id).catch(() => null)) ?? state;
    };
    // With a known id the guard exists before any read, so nothing slips by.
    if (id) protect(id);
    void syncBeforeOpen(sync, id).then(({ late }) =>
      load().then(
        async (loaded) => {
          if (!loaded) {
            latestStateRef.current = null;
            setScreen({ status: "no_game" });
          } else {
            // Nothing is on screen yet, so no turn can start during the re-read.
            show(id || !sync ? loaded : await guardAndReread(loaded), false);
          }
          // "Continuar" after a slow syncAll: Drive may have brought a newer
          // game (another id). Same-id downloads already went through protect.
          if (!late || id) return;
          await late;
          const newest = await repo.loadLatest().catch(() => null);
          if (!newest || changedRef.current || newest.id === shownId) return;
          // Hold the old screen while the new game is guarded and re-read.
          setPause("opening", true);
          const fresh = await guardAndReread(newest);
          setPause("opening", false);
          if (!changedRef.current) show(fresh, true);
        },
        () => setScreen({ status: "load_error" }),
      ),
    );
    return () => unprotects.forEach((stop) => stop());
  }, [sync, setPause]);

  return {
    screen,
    setScreen,
    inFlight,
    setInFlight,
    error,
    setError,
    warning,
    setWarning,
    showSuggestions,
    sync,
    abortRef,
    latestStateRef,
    changedRef,
    generationRef,
    pauseRef,
    paused,
    isPaused,
    setPause,
    track,
  };
}
