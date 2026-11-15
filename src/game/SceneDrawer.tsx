import { useEffect, useRef } from "react";
import { enterDrawer } from "../animations/motion";
import type { Attitude, GameState } from "../domain/types";
import { initials } from "./TurnLog";

const ATTITUDE_LABEL: Record<Attitude, string> = {
  friendly: "Amistoso",
  neutral: "Neutral",
  hostile: "Hostil",
};

export interface SceneMember {
  name: string;
  detail: string;
  /** Short label under the name: the class line or the NPC's attitude. */
  tag: string;
  attitude: Attitude | null;
  isPlayer: boolean;
  hasTurn: boolean;
}

/** Everyone in the current scene, players first, with whoever has the turn
    flagged. No `turnOf` means the player: between DM replies the game is
    always waiting on them. */
export function sceneMembers(state: GameState): SceneMember[] {
  const turnOf = state.scene.turnOf ?? state.players[0]?.name ?? null;
  return [
    ...state.players.map((p) => ({
      name: p.name,
      detail: `${p.race} · ${p.characterClass} · Nivel ${p.level}`,
      tag: "Jugador",
      attitude: null,
      isPlayer: true,
      hasTurn: p.name === turnOf,
    })),
    ...state.npcs
      .filter((n) => n.present)
      .map((n) => ({
        name: n.name,
        detail: n.description,
        tag: ATTITUDE_LABEL[n.attitude],
        attitude: n.attitude,
        isPlayer: false,
        hasTurn: n.name === turnOf,
      })),
  ];
}

interface Props {
  state: GameState;
  open: boolean;
  onClose: () => void;
}

/** Side panel with who is in the scene. The DM runs everyone but the
    player; the panel only shows whose turn it is (orange border in combat,
    green otherwise) and dims the rest. A native modal <dialog> gives focus
    trapping and Escape-to-close for free. */
export function SceneDrawer({ state, open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (panelRef.current) enterDrawer(panelRef.current);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const members = sceneMembers(state);
  const { inCombat } = state.scene;
  const others = members.length - state.players.length;

  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-labelledby="scene-title"
      onClose={onClose}
      // The dialog fills the screen; a click that lands on it rather than
      // on the panel is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
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
              key={`${member.isPlayer ? "p" : "n"}:${member.name}`}
              className={`scene-card${member.hasTurn ? " scene-card--turn" : ""}`}
              aria-current={member.hasTurn ? "true" : undefined}
            >
              <span
                className="scene-card__avatar"
                data-attitude={member.attitude ?? "player"}
                aria-hidden="true"
              >
                {initials(member.name)}
              </span>
              <div className="scene-card__body">
                <strong>{member.name}</strong>
                <span className="scene-card__tag">{member.tag}</span>
                <p className="scene-card__detail">{member.detail}</p>
              </div>
              {member.hasTurn && (
                <span className="scene-card__turn">{member.isPlayer ? "Tu turno" : "Su turno"}</span>
              )}
            </li>
          ))}
        </ul>

        {others === 0 && <p className="drawer__empty">No hay nadie más en la escena.</p>}
      </div>
    </dialog>
  );
}
