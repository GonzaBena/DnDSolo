import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDice } from "../domain/dice";
import type { GameState, TurnInput } from "../domain/types";
import { TurnEngine, type TurnFailure } from "../engine/TurnEngine";
import { GeminiClient } from "../llm/GeminiClient";
import { describeLLMError } from "../llm/errorMessages";
import { IndexedDBGameRepo } from "../persistence/IndexedDBGameRepo";
import { isConfigured, loadSettings } from "../persistence/settings";
import { CharacterPanel } from "./CharacterPanel";
import { InputEntry, Narration, TurnLog } from "./TurnLog";
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

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
    repo.loadLatest().then(
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
    [],
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
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turnCount, streamed, error]);

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
      <CharacterPanel state={state} />

      <div className="log" aria-live="polite">
        <TurnLog turns={state.turns} players={state.players} enterCount={screen.loadedTurns} />
        {inFlight && (
          <div className="turn">
            <InputEntry input={inFlight.input} players={state.players} animated />
            {streamed !== "" && <Narration text={streamed} animated />}
            {busy && streamed === "" && <p className="thinking">El DM está pensando…</p>}
          </div>
        )}
        <div ref={bottomRef} />
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
        <label className="field">
          <span>¿Qué hacés?</span>
          <textarea
            rows={3}
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
        </label>
        <div className="actions">
          <button type="submit" className="button button--primary" disabled={!canAct || draft.trim() === ""}>
            Enviar
          </button>
        </div>
      </form>
    </section>
  );
}
