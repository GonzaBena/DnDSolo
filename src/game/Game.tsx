import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { shakeScreen } from "../animations/motion";
import { formatDice } from "../domain/dice";
import type { GameState, PlayerRoll, StateChange, TurnInput } from "../domain/types";
import { TurnEngine, type TurnFailure } from "../engine/TurnEngine";
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
import { expandSlashCommands } from "./slashCommands";
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
  const [rollOpen, setRollOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [zenMode, setZenMode] = useState(false);
  const { atBottom, scrollToBottom, follow } = useStickToBottom();
  const startedRef = useRef(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const gameRef = useRef<HTMLElement>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleTurnEvents = useCallback((events: string[], stateChanges: StateChange[]) => {
    const newToasts: ToastItem[] = [];
    const timestamp = Date.now();

    if (events.includes("damage")) {
      if (gameRef.current) {
        shakeScreen(gameRef.current);
        gameRef.current.classList.add("game--damage-flash");
        setTimeout(() => {
          gameRef.current?.classList.remove("game--damage-flash");
        }, 400);
      }
      newToasts.push({
        id: `dmg-${timestamp}`,
        kind: "damage",
        title: "¡Daño recibido!",
        detail: "Hubo un impacto en combate o peligro del entorno.",
      });
    }

    if (events.includes("healing")) {
      newToasts.push({
        id: `heal-${timestamp}`,
        kind: "healing",
        title: "Recuperación",
        detail: "Te recuperaste o recibiste curación.",
      });
    }

    if (events.includes("combat_start")) {
      newToasts.push({
        id: `cbt-${timestamp}`,
        kind: "combat",
        title: "¡Iniciativa!",
        detail: "Comenzó un enfrentamiento en la escena.",
      });
    } else if (events.includes("combat_end")) {
      newToasts.push({
        id: `cbt-end-${timestamp}`,
        kind: "info",
        title: "Fin del combate",
        detail: "La calma regresa al entorno.",
      });
    }

    if (events.includes("level_up")) {
      newToasts.push({
        id: `lvl-${timestamp}`,
        kind: "level",
        title: "¡Subiste de nivel!",
        detail: "Tu personaje se ha vuelto más poderoso.",
      });
    }

    for (const change of stateChanges) {
      if (change.type === "inventory_add") {
        newToasts.push({
          id: `item-add-${change.item}-${timestamp}`,
          kind: "item",
          title: "Objeto obtenido",
          detail: change.quantity > 1 ? `${change.item} ×${change.quantity}` : change.item,
        });
      } else if (change.type === "inventory_remove") {
        newToasts.push({
          id: `item-rem-${change.item}-${timestamp}`,
          kind: "item",
          title: "Objeto usado o perdido",
          detail: change.quantity > 1 ? `${change.item} ×${change.quantity}` : change.item,
        });
      } else if (change.type === "quest") {
        if (change.status === "completed") {
          newToasts.push({
            id: `quest-done-${change.title}-${timestamp}`,
            kind: "quest",
            title: "¡Misión completada!",
            detail: change.title,
          });
        } else if (change.status === "active" && events.includes("new_quest")) {
          newToasts.push({
            id: `quest-new-${change.title}-${timestamp}`,
            kind: "quest",
            title: "Nueva misión",
            detail: change.title,
          });
        }
      } else if (change.type === "npc" && events.includes("new_npc")) {
        newToasts.push({
          id: `npc-${change.name}-${timestamp}`,
          kind: "npc",
          title: "Nuevo personaje",
          detail: `${change.name} está presente en la historia.`,
        });
      }
    }

    if (newToasts.length > 0) {
      setToasts((prev) => [...prev, ...newToasts]);
    }
  }, []);

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
      handleTurnEvents(outcome.response.events, outcome.response.stateChanges);
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
    [scrollToBottom, handleTurnEvents],
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
    const raw = draft.trim();
    if (!canAct || raw === "") return;

    const text = expandSlashCommands(raw);
    setDraft("");
    // Solo game: the one player is always the author.
    void send(engine, state, { type: "action", text, playerId: state.players[0]?.id });
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
        <TurnLog turns={state.turns} players={state.players} enterCount={screen.loadedTurns} />
        {inFlight && (
          <div className="turn">
            <InputEntry input={inFlight.input} players={state.players} animated />
            {streamed !== "" && <Narration text={streamed} animated />}
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
