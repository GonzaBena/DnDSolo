import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { shakeScreen } from "../animations/motion";
import { castOf, speakingNow } from "../domain/dialogue";
import { formatDice } from "../domain/dice";
import type { GameState, PlayerRoll, TurnInput } from "../domain/types";
import { TurnEngine, type TurnFailure, type TurnOutcome } from "../engine/TurnEngine";
import { GeminiClient } from "../llm/GeminiClient";
import { describeLLMError } from "../llm/errorMessages";
import { IndexedDBGameRepo } from "../persistence/IndexedDBGameRepo";
import { isConfigured, loadSettings } from "../persistence/settings";
import { CharacterPanel } from "./CharacterPanel";
import { EventToasts, type ToastItem } from "./EventToasts";
import { DieShape } from "./DieShape";
import { InfoDrawer } from "./InfoDrawer";
import { RollDialog } from "./RollDialog";
import { SceneDrawer } from "./SceneDrawer";
import { ScenePanel } from "./ScenePanel";
import { expandSlashCommands } from "./slashCommands";
import { buildTurnToasts, tookDamage } from "./turnToasts";
import { InputEntry, Narration, TurnLog } from "./TurnLog";
import { useStickToBottom } from "./useStickToBottom";
import { createTypewriter } from "./typewriter";
import { isEditable, shouldRedirectKey } from "./keyRedirect";
import "./game.css";

type Screen =
  | { status: "loading" }
  | { status: "no_game" }
  | { status: "load_error" }
  /** `loadedTurns`: how many turns the save had when it was opened. */
  | { status: "playing"; engine: TurnEngine; state: GameState; loadedTurns: number };

/** A turn that was sent and hasn't produced a saved result yet. */
interface InFlight {
  input: TurnInput;
  narration: string;
  /** What the player typed, before slash commands were expanded. */
  draft?: string;
}

const SAVE_WARNING = "El turno se jugó pero no se pudo guardar. Si recargás, lo perdés.";

function describeFailure(failure: TurnFailure): string {
  switch (failure.kind) {
    case "llm":
      return describeLLMError(failure.cause);
    case "invalid_response":
      return "El DM respondió algo que no se pudo interpretar. Tu partida está intacta: probá de nuevo.";
    case "invalid_input":
      return "Esa acción no se puede hacer en este momento.";
    case "aborted":
      return "Cortaste la respuesta del DM.";
  }
}

// The whole game screen is this single React island; every other page is
// plain Astro.
export default function Game() {
  const [screen, setScreen] = useState<Screen>({ status: "loading" });
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // True only while the model call can still be cut; after that the
  // typewriter is just finishing the reveal.
  const [abortable, setAbortable] = useState(false);
  useEffect(() => () => abortRef.current?.abort(), []);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sceneOpen, setSceneOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [rollOpen, setRollOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [zenMode, setZenMode] = useState(false);
  const { atBottom, scrollToBottom, follow } = useStickToBottom();
  const startedRef = useRef(false);
  // The newest playing state, so a summary that resolves late is applied to
  // the game as it is now and not to the one the turn started from.
  const latestStateRef = useRef<GameState | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const gameRef = useRef<HTMLElement>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Grow the textarea with its content: one line when empty, capped by CSS max-height.
  useLayoutEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    // scrollHeight leaves out the border; add it back so a border-box
    // textarea fits its text without overflowing.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [draft]);

  useEffect(() => {
    const settings = loadSettings();
    // Without a key there is nothing to play: send the player to settings,
    // which explains why they landed there (Spec, MVP scope 2).
    if (!isConfigured(settings)) {
      location.replace("/settings?missing=1");
      return;
    }
    const repo = new IndexedDBGameRepo();
    const engine = new TurnEngine({
      llm: new GeminiClient(settings.apiKey, settings.model),
      repo,
    });
    // /play?id=... opens a specific campaign; without it, the latest one.
    const id = new URLSearchParams(location.search).get("id");
    (id ? repo.load(id) : repo.loadLatest()).then(
      (state) => {
        latestStateRef.current = state;
        setScreen(
          state
            ? { status: "playing", engine, state, loadedTurns: state.turns.length }
            : { status: "no_game" },
        );
      },
      () => setScreen({ status: "load_error" }),
    );
  }, []);

  const send = useCallback(
    async (engine: TurnEngine, state: GameState, input: TurnInput, typed?: string) => {
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
      setAbortable(true);
      const aborted = new Promise<void>((resolve) =>
        controller.signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      let outcome: TurnOutcome | null = null;
      try {
        outcome = await engine.playTurn(
          state,
          input,
          (narration) => typewriter.setTarget(narration),
          controller.signal,
          // The turn is committed only after the text is fully shown, and a
          // Stop meanwhile doesn't wait for the typewriter.
          () => Promise.race([typewriter.finish(), aborted]),
        );
      } catch (error) {
        // Not a failure playTurn reports; keep the input so the player can retry.
        console.error(error);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        typewriter.cancel();
        setAbortable(false);
        setBusy(false);
      }
      if (outcome === null) {
        setInFlight({ input, narration: "", draft: typed });
        setError(describeLLMError(null));
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
      if (tookDamage(outcome.response.events) && gameRef.current) {
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
        const applied = await engine.applySummary(latest, patch);
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
    [scrollToBottom],
  );

  // Turns the app takes on its own, with no player input:
  // - a brand-new game has no turns, so ask the DM for the opening scene;
  // - when the DM asked for enemy rolls, roll them (code, never the model)
  //   and send the results straight back so the DM can narrate the outcome.
  // `inFlight` being set also blocks this after a failure, so a failed
  // send waits for "Reintentar" instead of re-rolling in a loop.
  useEffect(() => {
    if (screen.status !== "playing" || busy || inFlight) return;
    const { engine, state } = screen;
    if (state.turns.length === 0) {
      if (startedRef.current) return;
      startedRef.current = true;
      void send(engine, state, { type: "start" });
    } else if (state.pendingEnemyRolls.length > 0) {
      void send(engine, state, { type: "enemy_rolls", results: engine.rollEnemyDice(state) });
    }
  }, [screen, busy, inFlight, send]);

  const turnCount = screen.status === "playing" ? screen.state.turns.length : 0;
  const streamed = inFlight?.narration ?? "";
  const playing = screen.status === "playing";
  // Opening the game lands at the latest turn; after that, new text keeps
  // the view at the bottom unless the player scrolled up to reread.
  useEffect(() => {
    follow();
  }, [playing, turnCount, streamed, error, busy, follow]);

  const playerRoll = screen.status === "playing" ? screen.state.pendingPlayerRoll : null;
  const enemyRollsPending =
    screen.status === "playing" && screen.state.pendingEnemyRolls.length > 0;
  const canAct = useMemo(
    () => screen.status === "playing" && !busy && !inFlight && !enemyRollsPending,
    [screen.status, busy, inFlight, enemyRollsPending],
  );

  // Focus the composer whenever it is the player's turn, unless they are
  // already in another field. Skipped on touch screens, where focusing
  // would pop the on-screen keyboard over the story.
  useEffect(() => {
    if (!canAct || !matchMedia("(pointer: fine)").matches) return;
    if (isEditable(document.activeElement)) return;
    draftRef.current?.focus();
  }, [canAct]);

  // Typing anywhere on the page goes into the composer: focusing it on
  // keydown makes the browser deliver that same keystroke to it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = draftRef.current;
      if (!el || el.disabled) return;
      if (!shouldRedirectKey(event, event.target as Element | null)) return;
      if (document.querySelector("dialog[open]")) return;
      el.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (screen.status === "loading") return <p>Cargando partida…</p>;

  if (screen.status === "load_error") {
    return <p className="notice">No se pudo leer la partida guardada en este navegador.</p>;
  }

  if (screen.status === "no_game") {
    return (
      <section>
        <h1>Todavía no hay ninguna partida</h1>
        <p>Creá un personaje para empezar tu primera campaña.</p>
        <div className="actions">
          <a className="button button--primary" href="/character">
            Nueva campaña
          </a>
        </div>
      </section>
    );
  }

  const { engine, state } = screen;
  const cast = castOf(state);
  // Whose line the typewriter is writing: their face swings in the panel.
  // A retry restarts the narration, which brings it back to null.
  const speaking = busy && inFlight ? speakingNow(inFlight.narration, cast) : null;

  const submitAction = (event: { preventDefault(): void }) => {
    event.preventDefault();
    const raw = draft.trim();
    if (!canAct || raw === "") return;

    const text = expandSlashCommands(raw);
    setDraft("");
    // Solo game: the one player is always the author.
    void send(engine, state, { type: "action", text, playerId: state.players[0]?.id }, raw);
  };

  // Whatever was already typed goes first, so "Ataco al orco" + roll
  // becomes a single turn.
  const submitRoll = (roll: Omit<PlayerRoll, "reason">) => {
    setRollOpen(false);
    if (!canAct) return;
    const raw = draft.trim();
    setDraft("");
    void send(engine, state, {
      type: "action",
      text: raw === "" ? "" : expandSlashCommands(raw),
      playerId: state.players[0]?.id,
      roll: { ...roll, reason: playerRoll?.reason },
    });
  };

  return (
    <section ref={gameRef} className={`game${zenMode ? " game--zen" : ""}`}>
      <div className="game__main">
        <EventToasts toasts={toasts} onDismiss={dismissToast} />
        <CharacterPanel
          state={state}
          zenMode={zenMode}
          onToggleZen={() => setZenMode((prev) => !prev)}
          onOpenScene={() => setSceneOpen(true)}
          onOpenInfo={() => setInfoOpen(true)}
        />
        <InfoDrawer state={state} open={infoOpen} onClose={() => setInfoOpen(false)} />
        <SceneDrawer
          state={state}
          dmActing={busy}
          open={sceneOpen}
          onClose={() => setSceneOpen(false)}
        />

        <div className="log" aria-live="polite">
          <TurnLog turns={state.turns} players={state.players} cast={cast} enterCount={screen.loadedTurns} />
          {inFlight && (
            <div className="turn">
              <InputEntry input={inFlight.input} players={state.players} animated />
              {streamed !== "" && <Narration text={streamed} cast={cast} animated />}
              {busy && streamed === "" && (
                <div className="thinking-indicator" role="status" aria-live="polite">
                  <span className="thinking-indicator__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19l7-7 3 3-7 7-3-3z" />
                      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                      <path d="M2 2l7.586 7.586" />
                      <circle cx="11" cy="11" r="2" />
                    </svg>
                  </span>
                  <span className="thinking-indicator__text">El DM está pensando</span>
                  <span className="thinking-indicator__dots" aria-hidden="true">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="notice notice--error" role="alert">
            <p>{error}</p>
            <div className="actions">
              {inFlight && (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void send(engine, state, inFlight.input, inFlight.draft)}
                >
                  Reintentar
                </button>
              )}
              <a className="button" href="/settings">
                Revisar configuración
              </a>
            </div>
          </div>
        )}
        {warning && <p className="notice">{warning}</p>}

        {playerRoll && !inFlight && (
          <div className="roll-request">
            <p>
              <strong>El DM te pide una tirada: {formatDice(playerRoll)}</strong>
              {playerRoll.difficulty !== null && ` (CD ${playerRoll.difficulty})`}
            </p>
            <p>{playerRoll.reason}</p>
            <p className="roll-request__hint">
              Tirá tus dados y cargá el resultado con el botón del dado, o escribilo en el chat.
            </p>
          </div>
        )}

        <RollDialog
          open={rollOpen}
          request={playerRoll}
          onClose={() => setRollOpen(false)}
          onSubmit={submitRoll}
        />

        <form className="action-form" onSubmit={submitAction}>
          {!atBottom && (
            <button
              type="button"
              className="button scroll-bottom"
              aria-label="Ir al final"
              title="Ir al final"
              onClick={() => scrollToBottom("smooth")}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  d="M12 4v15m-6-6 6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <div className="field">
            <label htmlFor="action-input">¿Qué hacés?</label>
            <div className="action-row">
              <textarea
                id="action-input"
                ref={draftRef}
                className="action-input"
                rows={1}
                value={draft}
                disabled={!canAct}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Enter sends, Shift+Enter makes a new line.
                  if (event.key === "Enter" && !event.shiftKey) submitAction(event);
                }}
                placeholder={
                  playerRoll ? "Escribí el total de tu tirada…" : "Describí la acción de tu personaje…"
                }
              />
              <button
                type="button"
                className={`button action-roll${playerRoll ? " action-roll--requested" : ""}`}
                aria-label="Cargar tirada"
                title="Cargar tirada"
                disabled={!canAct}
                onClick={() => setRollOpen(true)}
              >
                <DieShape die="d20" className="action-roll__die" />
              </button>
              {busy && abortable ? (
                <button
                  type="button"
                  className="button button--primary action-send"
                  aria-label="Detener respuesta"
                  title="Detener"
                  onClick={() => abortRef.current?.abort()}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  className="button button--primary action-send"
                  aria-label="Enviar"
                  title="Enviar"
                  disabled={!canAct || draft.trim() === ""}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path
                      d="M21 3 3 10.5l7 2.5 2.5 7L21 3Zm0 0L10 13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
      <ScenePanel state={state} dmActing={busy} speaking={speaking} />
    </section>
  );
}
