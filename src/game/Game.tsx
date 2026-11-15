import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatDice } from "../domain/dice";
import type { GameState, TurnInput } from "../domain/types";
import { TurnEngine, type TurnFailure } from "../engine/TurnEngine";
import { GeminiClient } from "../llm/GeminiClient";
import { describeLLMError } from "../llm/errorMessages";
import { IndexedDBGameRepo } from "../persistence/IndexedDBGameRepo";
import { isConfigured, loadSettings } from "../persistence/settings";
import { CharacterPanel } from "./CharacterPanel";
import { InfoDrawer } from "./InfoDrawer";
import { SceneDrawer } from "./SceneDrawer";
import { InputEntry, Narration, TurnLog } from "./TurnLog";
import { useStickToBottom } from "./useStickToBottom";
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
}

function describeFailure(failure: TurnFailure): string {
  switch (failure.kind) {
    case "llm":
      return describeLLMError(failure.cause);
    case "invalid_response":
      return "El DM respondió algo que no se pudo interpretar. Tu partida está intacta: probá de nuevo.";
    case "invalid_input":
      return "Esa acción no se puede hacer en este momento.";
  }
}

// The whole game screen is this single React island; every other page is
// plain Astro.
export default function Game() {
  const [screen, setScreen] = useState<Screen>({ status: "loading" });
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sceneOpen, setSceneOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const { atBottom, scrollToBottom, follow } = useStickToBottom();
  const startedRef = useRef(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea with its content: one line when empty, capped by CSS max-height.
  useLayoutEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
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
      (state) =>
        setScreen(
          state
            ? { status: "playing", engine, state, loadedTurns: state.turns.length }
            : { status: "no_game" },
        ),
      () => setScreen({ status: "load_error" }),
    );
  }, []);

  const send = useCallback(
    async (engine: TurnEngine, state: GameState, input: TurnInput) => {
      setBusy(true);
      // Whoever sends wants to see the reply, even if they had scrolled up.
      scrollToBottom();
      setError(null);
      setWarning(null);
      setInFlight({ input, narration: "" });
      const outcome = await engine.playTurn(state, input, (narration) =>
        setInFlight({ input, narration }),
      );
      setBusy(false);
      if (!outcome.ok) {
        // Keep the input on screen so "Reintentar" resends exactly this:
        // enemy dice that were already rolled must not be rolled again.
        setInFlight({ input, narration: "" });
        setError(describeFailure(outcome.failure));
        return;
      }
      setInFlight(null);
      setScreen((previous) => ({
        status: "playing",
        engine,
        state: outcome.state,
        loadedTurns: previous.status === "playing" ? previous.loadedTurns : 0,
      }));
      if (outcome.saveError) {
        setWarning("El turno se jugó pero no se pudo guardar. Si recargás, lo perdés.");
      }
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

  const submitAction = (event: { preventDefault(): void }) => {
    event.preventDefault();
    const text = draft.trim();
    if (!canAct || text === "") return;
    setDraft("");
    // Solo game: the one player is always the author.
    void send(engine, state, { type: "action", text, playerId: state.players[0]?.id });
  };

  return (
    <section className="game">
      <CharacterPanel state={state} onOpenScene={() => setSceneOpen(true)}
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
        <TurnLog turns={state.turns} players={state.players} enterCount={screen.loadedTurns} />
        {inFlight && (
          <div className="turn">
            <InputEntry input={inFlight.input} players={state.players} animated />
            {streamed !== "" && <Narration text={streamed} animated />}
            {busy && streamed === "" && <p className="thinking">El DM está pensando…</p>}
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
                onClick={() => void send(engine, state, inFlight.input)}
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
            Tirá tus dados, sumá tus modificadores y escribí el total en el chat.
          </p>
        </div>
      )}

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
          </div>
        </div>
      </form>
    </section>
  );
}
