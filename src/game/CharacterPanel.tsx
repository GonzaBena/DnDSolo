import type { GameState } from "../domain/types";

interface Props {
  state: GameState;
  onOpenScene: () => void;
  onOpenInfo: () => void;
}

export function CharacterPanel({ state, onOpenScene, onOpenInfo }: Props) {
  const player = state.players[0];
  if (!player) return null;
  // The first active quest is the main one.
  const mainQuest = state.quests.find((q) => q.status === "active");
  // Players, the DM and the NPCs around.
  const inScene = state.players.length + 1 + state.npcs.filter((n) => n.present).length;
  const { inCombat } = state.scene;

  return (
    <aside className="sheet" aria-label="Tu personaje">
      <div className="sheet__main">
        <div className="sheet__identity">
          <strong>{player.name}</strong>
          <span>
            {player.race} · {player.characterClass} · Nivel {player.level}
          </span>
        </div>
        <dl className="sheet__details">
          <div>
            <dt>Lugar</dt>
            <dd>{state.location.name || "—"}</dd>
          </div>
          {mainQuest && (
            <div>
              <dt>Misión</dt>
              <dd>{mainQuest.title}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="sheet__actions">
        <button
          type="button"
          className="button scene-toggle"
          data-mode={inCombat ? "combat" : "calm"}
          onClick={onOpenScene}
          aria-haspopup="dialog"
        >
          {inCombat ? "Combate" : "Escena"}
          <span className="scene-toggle__count" aria-label={`${inScene} personajes`}>
            {inScene}
          </span>
        </button>
        <button type="button" className="button scene-toggle" onClick={onOpenInfo} aria-haspopup="dialog">
          Info
        </button>
      </div>
    </aside>
  );
}
