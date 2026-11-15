import type { Attitude, GameState } from "../domain/types";
import { initials } from "./TurnLog";
import { useDrawer } from "./useDrawer";

const ATTITUDE_LABEL: Record<Attitude, string> = {
  friendly: "Amistoso",
  neutral: "Neutral",
  hostile: "Hostil",
};

export const DM_NAME = "Dungeon Master";

export interface SceneMember {
  name: string;
  detail: string;
  /** Short label under the name: the class line or the NPC's attitude. */
  tag: string;
  kind: "player" | "dm" | Attitude;
  hasTurn: boolean;
}

/** Everyone at the table: the DM at the head, the players, then the NPCs
    in the scene, with whoever has the turn flagged. While the DM is
    answering (the player just sent something) the turn is theirs;
    otherwise it is whoever the scene says, and no `turnOf` means the
    player. */
export function sceneMembers(state: GameState, dmActing: boolean): SceneMember[] {
  const turnOf = dmActing ? null : (state.scene.turnOf ?? state.players[0]?.name ?? null);
  return [
    {
      name: DM_NAME,
      detail: "Narra la historia y maneja a todos los demás personajes.",
      tag: "Narrador",
      kind: "dm" as const,
      hasTurn: dmActing,
    },
    ...state.players.map((p) => ({
      name: p.name,
      detail: `${p.race} · ${p.characterClass} · Nivel ${p.level}`,
      tag: "Jugador",
      kind: "player" as const,
      hasTurn: p.name === turnOf,
    })),
    ...state.npcs
      .filter((n) => n.present)
      .map((n) => ({
        name: n.name,
        detail: n.description,
        tag: ATTITUDE_LABEL[n.attitude],
        kind: n.attitude,
        hasTurn: n.name === turnOf,
      })),
  ];
}

interface Props {
  state: GameState;
  /** The DM is working on a reply, so the turn is theirs. */
  dmActing: boolean;
  open: boolean;
  onClose: () => void;
}

/** Side panel with who is at the table. The DM runs everyone but the
    player; the panel only shows whose turn it is (orange border in combat,
    green otherwise) and dims the rest. A native modal <dialog> gives focus
    trapping and Escape-to-close for free. */
export function SceneDrawer({ state, dmActing, open, onClose }: Props) {
  const { dialogProps, panelRef } = useDrawer(open, onClose);

  const members = sceneMembers(state, dmActing);
  const { inCombat } = state.scene;
  const npcsInScene = members.filter((m) => m.kind !== "player" && m.kind !== "dm").length;

  return (
    <dialog {...dialogProps} aria-labelledby="scene-title">
      <div ref={panelRef} className="drawer__panel" data-mode={inCombat ? "combat" : "calm"}>
        <header className="drawer__header">
          <div>
            <h2 id="scene-title">En escena</h2>
            <p className="drawer__place">{state.location.name || "Lugar desconocido"}</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <p className="scene-status">{inCombat ? "En combate" : "Sin combate"}</p>

        <ul className="scene-list">
          {members.map((member) => (
            <li
              key={`${member.kind}:${member.name}`}
              className={`scene-card${member.hasTurn ? " scene-card--turn" : ""}`}
              aria-current={member.hasTurn ? "true" : undefined}
            >
              <span
                className="scene-card__avatar"
                data-kind={member.kind}
                aria-hidden="true"
              >
                {member.kind === "dm" ? "DM" : initials(member.name)}
              </span>
              <div className="scene-card__body">
                <strong>{member.name}</strong>
                <span className="scene-card__tag">{member.tag}</span>
                <p className="scene-card__detail">{member.detail}</p>
              </div>
              {member.hasTurn && (
                <span className="scene-card__turn">{member.kind === "player" ? "Tu turno" : "Su turno"}</span>
              )}
            </li>
          ))}
        </ul>

        {npcsInScene === 0 && <p className="drawer__empty">No hay nadie más en la escena.</p>}
      </div>
    </dialog>
  );
}
