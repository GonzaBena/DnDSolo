import type { GameState } from "../domain/types";

interface Props {
  state: GameState;
  onOpenScene: () => void;
  onOpenInfo: () => void;
  zenMode?: boolean;
  onToggleZen?: () => void;
}

export function CharacterPanel({
  state,
  onOpenScene,
  onOpenInfo,
  zenMode = false,
  onToggleZen,
}: Props) {
  const player = state.players?.[0];
  if (!player) return null;
  // The first active quest is the main one.
  const mainQuest = (state.quests ?? []).find((q) => q.status === "active");
  // Players, the DM and the NPCs around.
  const inScene = (state.players?.length ?? 1) + 1 + (state.npcs ?? []).filter((n) => n.present).length;
  const inCombat = state.scene?.inCombat ?? false;

  return (
    <aside className={`sheet${zenMode ? " sheet--zen" : ""}`} aria-label="Tu personaje">
      <div className="sheet__main">
        <div className="sheet__identity">
          <strong>{player.name}</strong>
          <span>
            {player.race} · {player.characterClass} · Nivel {player.level}
          </span>
        </div>
        {!zenMode && (
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
        )}
      </div>
      <div className="sheet__actions">
        {onToggleZen && (
          <button
            type="button"
            className={`button scene-toggle ${zenMode ? "scene-toggle--active" : ""}`}
            onClick={onToggleZen}
            title={zenMode ? "Mostrar ficha completa" : "Modo lectura"}
            aria-label={zenMode ? "Mostrar ficha completa" : "Modo lectura"}
          >
            {zenMode ? "Ficha" : "Lectura"}
          </button>
        )}
        <button
          type="button"
          className="button scene-toggle scene-toggle--scene"
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
