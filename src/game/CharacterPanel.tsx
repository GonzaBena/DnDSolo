import type { GameState } from "../domain/types";

interface Props {
  state: GameState;
  onOpenScene: () => void;
}

export function CharacterPanel({ state, onOpenScene }: Props) {
  const player = state.players[0];
  if (!player) return null;
  const activeQuests = state.quests.filter((q) => q.status === "active");
  // Players, the DM and the NPCs around.
  const inScene = state.players.length + 1 + state.npcs.filter((n) => n.present).length;
  const { inCombat } = state.scene;

  return (
    <aside className="sheet" aria-label="Tu personaje">
      <div className="sheet__identity">
        <strong>{player.name}</strong>
        <span>
          {player.race} · {player.characterClass} · Nivel {player.level}
        </span>
      </div>
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
      <dl className="sheet__details">
        <div>
          <dt>Lugar</dt>
          <dd>{state.location.name || "—"}</dd>
        </div>
        <div>
          <dt>Objetos de la historia</dt>
          <dd>
            {player.inventory.length === 0
              ? "Ninguno todavía"
              : player.inventory
                  .map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name))
                  .join(", ")}
          </dd>
        </div>
        {activeQuests.length > 0 && (
          <div>
            <dt>Misiones</dt>
            <dd>{activeQuests.map((q) => q.title).join(", ")}</dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
