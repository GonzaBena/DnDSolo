import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  | { status: "playing"; engine: TurnEngine; state: GameState };

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
      (state) => setScreen(state ? { status: "playing", engine, state } : { status: "no_game" }),
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
        // a failed roll must not be rolled again.
        setInFlight({ input, narration: "" });
        setError(describeFailure(outcome.failure));
        return;
      }
      setInFlight(null);
      setScreen({ status: "playing", engine, state: outcome.state });
      if (outcome.saveError) {
        setWarning("El turno se jugó pero no se pudo guardar. Si recargás, lo perdés.");
      }
    },
    [],
  );

  // A brand-new game has no turns: ask the DM for the opening scene.
  useEffect(() => {
    if (screen.status !== "playing" || startedRef.current) return;
    startedRef.current = true;
    if (screen.state.turns.length === 0) {
      void send(screen.engine, screen.state, { type: "start" });
    }
  }, [screen, send]);

  const turnCount = screen.status === "playing" ? screen.state.turns.length : 0;
  const streamed = inFlight?.narration ?? "";
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turnCount, streamed, error]);

  const pendingRoll = screen.status === "playing" ? screen.state.pendingRoll : null;
  const canAct = useMemo(
    () => screen.status === "playing" && !busy && !inFlight && !pendingRoll,
    [screen.status, busy, inFlight, pendingRoll],
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
    void send(engine, state, { type: "action", text });
  };

  const roll = () => {
    if (busy || inFlight || !state.pendingRoll) return;
    // The number comes from the engine (code), never from the model.
    void send(engine, state, { type: "roll", result: engine.rollPending(state) });
  };

  return (
    <section className="game">
      <CharacterPanel state={state} />

      <div className="log" aria-live="polite">
        <TurnLog turns={state.turns} />
        {inFlight && (
          <div className="turn">
            <InputEntry input={inFlight.input} />
            {streamed !== "" && <Narration text={streamed} />}
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

      {pendingRoll && !inFlight && (
        <div className="roll-request">
          <p>
            <strong>El DM pide una tirada:</strong> {pendingRoll.reason}
            {pendingRoll.difficulty !== null && ` (CD ${pendingRoll.difficulty})`}
          </p>
          <button type="button" className="button button--primary" onClick={roll}>
            Tirar {pendingRoll.die}
          </button>
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
            placeholder={pendingRoll ? "Primero resolvé la tirada." : "Describí la acción de tu personaje…"}
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
