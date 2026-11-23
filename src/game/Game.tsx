import { useCallback, useEffect, useRef, useState } from "react";
import { castOf, speakingNow } from "../domain/dialogue";
import type { PlayerRoll } from "../domain/types";
import { CharacterPanel } from "./CharacterPanel";
import { Composer } from "./Composer";
import DiceLoader from "./DiceLoader";
import { DyingNotice } from "./DyingNotice";
import { EventToasts, type ToastItem } from "./EventToasts";
import { FailureBanner } from "./FailureBanner";
import { GameOver } from "./GameOver";
import { InfoDrawer } from "./InfoDrawer";
import { RollDialog } from "./RollDialog";
import { RollRequest } from "./RollRequest";
import { SceneDrawer } from "./SceneDrawer";
import { ScenePanel } from "./ScenePanel";
import { expandSlashCommands } from "./slashCommands";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { InputEntry, Narration, TurnLog } from "./TurnLog";
import { useComposerFocus } from "./useComposerFocus";
import { useGameSession } from "./useGameSession";
import { useHpAdjust } from "./useHpAdjust";
import { useOldSaveSuggestions } from "./useOldSaveSuggestions";
import { useSendTurn } from "./useSendTurn";
import { useStickToBottom } from "./useStickToBottom";
import { useTurnAnnouncement } from "./useTurnAnnouncement";
import "./game.css";

// The whole game screen is this single React island; every other page is
// plain Astro. Loading and Drive live in useGameSession, turns in useSendTurn.
export default function Game() {
  const session = useGameSession();
  const { screen, inFlight, error, warning, showSuggestions, abortRef, paused, isPaused } = session;
  const [draft, setDraft] = useState("");
  const [sceneOpen, setSceneOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [rollOpen, setRollOpen] = useState(false);
  const [deathSaveOpen, setDeathSaveOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [zenMode, setZenMode] = useState(false);
  const { atBottom, scrollToBottom, follow } = useStickToBottom();
  const startedRef = useRef(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const gameRef = useRef<HTMLElement>(null);
  const { busy, send, sendFromPlayer } = useSendTurn(session, { setDraft, setToasts, scrollToBottom, gameRef });
  const { hpPending, adjustHp } = useHpAdjust(session, setToasts);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Turns the app takes on its own, with no player input:
  // - a brand-new game has no turns, so ask the DM for the opening scene;
  // - when the DM asked for enemy rolls, roll them (code, never the model)
  //   and send the results straight back so the DM can narrate the outcome.
  // `inFlight` being set also blocks this after a failure, so a failed
  // send waits for "Reintentar" instead of re-rolling in a loop.
  useEffect(() => {
    if (screen.status !== "playing" || busy || inFlight || hpPending > 0 || paused) return;
    const { engine, state } = screen;
    if (state.turns.length === 0) {
      if (startedRef.current) return;
      startedRef.current = true;
      void send(engine, state, { type: "start" });
    } else if (state.pendingEnemyRolls.length > 0) {
      void send(engine, state, { type: "enemy_rolls", results: engine.rollEnemyDice(state) });
    }
  }, [screen, busy, inFlight, hpPending, paused, send]);

  const turnCount = screen.status === "playing" ? screen.state.turns.length : 0;
  const streamed = inFlight?.narration ?? "";
  const playing = screen.status === "playing";
  // Opening the game lands at the latest turn; after that, new text keeps
  // the view at the bottom unless the player scrolled up to reread.
  useEffect(() => {
    follow();
  }, [playing, turnCount, streamed, error, busy, follow]);

  const announcement = useTurnAnnouncement(screen);

  const playerRoll = screen.status === "playing" ? screen.state.pendingPlayerRoll : null;
  const enemyRollsPending =
    screen.status === "playing" && screen.state.pendingEnemyRolls.length > 0;
  // The player's turn, apart from a pending HP fix. Focus follows this one,
  // so adjusting HP doesn't pull focus from the -/+ buttons to the composer.
  const turnReady = screen.status === "playing" && !busy && !inFlight && !enemyRollsPending;
  const canAct = turnReady && hpPending === 0 && !paused;

  useOldSaveSuggestions(session, canAct);
  useComposerFocus(draftRef, turnReady);

  if (screen.status === "loading") return <DiceLoader label="Cargando partida…" />;

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
  const hero = state.players[0];
  // A pending reply still shows how the character fell; the end comes after it.
  if (hero?.condition === "dead" && !inFlight && !busy) return <GameOver state={state} cast={cast} />;
  const dying = hero?.condition === "dying";
  // Whose line the typewriter is writing: their face swings in the panel.
  // A retry restarts the narration, which brings it back to null.
  const speaking = busy && inFlight ? speakingNow(inFlight.narration, cast) : null;
  const stop = () => abortRef.current?.abort();

  const submitAction = (event: { preventDefault(): void }) => {
    event.preventDefault();
    const raw = draft.trim();
    if (!canAct || isPaused() || raw === "") return;
    setDraft("");
    // Solo game: the one player is always the author.
    const text = expandSlashCommands(raw);
    sendFromPlayer(engine, state, { type: "action", text, playerId: state.players[0]?.id }, raw);
  };

  // Whatever was already typed goes first, so "Ataco al orco" + roll
  // becomes a single turn.
  const submitRoll = (roll: Omit<PlayerRoll, "reason">) => {
    setRollOpen(false);
    if (!canAct || isPaused()) return;
    const raw = draft.trim();
    setDraft("");
    sendFromPlayer(engine, state, {
      type: "action",
      text: raw === "" ? "" : expandSlashCommands(raw),
      playerId: state.players[0]?.id,
      roll: { ...roll, reason: playerRoll?.reason },
    });
  };

  const submitDeathSave = (roll: { value: number }) => {
    setDeathSaveOpen(false);
    if (!canAct || isPaused() || !hero) return;
    sendFromPlayer(engine, state, { type: "death_save", playerId: hero.id, natural: roll.value });
  };

  const retry = () => {
    if (!inFlight || isPaused()) return;
    sendFromPlayer(engine, state, inFlight.input, inFlight.draft);
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
          onAdjustHp={(delta) => {
            if (busy || inFlight || isPaused()) return;
            void adjustHp(engine, state, delta);
          }}
          hpDisabled={busy || inFlight !== null || paused}
        />
        <InfoDrawer state={state} open={infoOpen} onClose={() => setInfoOpen(false)} />
        <SceneDrawer
          state={state}
          dmActing={busy}
          open={sceneOpen}
          onClose={() => setSceneOpen(false)}
        />

        <p className="sr-only" role="status">{announcement}</p>
        <div className="log">
          <TurnLog turns={state.turns} players={state.players} cast={cast} enterCount={screen.loadedTurns} />
          {inFlight && (
            <div className="turn">
              <InputEntry input={inFlight.input} players={state.players} animated />
              {streamed !== "" && <Narration text={streamed} cast={cast} animated />}
              {busy && streamed === "" && <ThinkingIndicator />}
            </div>
          )}
        </div>

        {error && (
          <FailureBanner
            error={error}
            onRetry={inFlight ? retry : null}
            retryDisabled={hpPending > 0 || paused}
          />
        )}
        {warning && <p className="notice">{warning}</p>}

        {playerRoll && !inFlight && !dying && <RollRequest roll={playerRoll} />}

        <RollDialog
          open={rollOpen}
          request={playerRoll}
          onClose={() => setRollOpen(false)}
          onSubmit={submitRoll}
        />
        <RollDialog
          open={deathSaveOpen}
          request={null}
          deathSave
          onClose={() => setDeathSaveOpen(false)}
          onSubmit={submitDeathSave}
        />

        {dying && hero ? (
          <DyingNotice
            deathSaves={hero.deathSaves}
            canAct={canAct}
            busy={busy}
            onRoll={() => setDeathSaveOpen(true)}
            onStop={stop}
          />
        ) : (
          <Composer
            draft={draft}
            onDraftChange={setDraft}
            inputRef={draftRef}
            canAct={canAct}
            busy={busy}
            rollRequested={playerRoll !== null}
            atBottom={atBottom}
            onScrollToBottom={() => scrollToBottom("smooth")}
            suggestions={
              showSuggestions
                ? { actions: state.suggestedActions, visible: turnReady && !paused && !dying && !playerRoll }
                : null
            }
            onSubmit={submitAction}
            onOpenRoll={() => setRollOpen(true)}
            onStop={stop}
          />
        )}
      </div>
      <ScenePanel state={state} dmActing={busy} speaking={speaking} />
    </section>
  );
}
