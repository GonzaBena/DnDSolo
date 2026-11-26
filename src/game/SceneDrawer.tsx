import { healthLabel, type HealthLabel } from "../domain/health";
import type { Attitude, GameState } from "../domain/types";
import { npcTag } from "../domain/npcRename";
import { NpcEditButton } from "./NpcRenameDialog";
import { heroPortraitUrl } from "../domain/heroPortraits";
import { initials } from "./NpcAvatar";
import { useDrawer } from "./useDrawer";

export const DM_NAME = "Dungeon Master";

export interface SceneMember {
  name: string;
  detail: string;
  /** Short label under the name: the class line or the NPC's attitude. */
  tag: string;
  kind: "player" | "dm" | Attitude;
  hasTurn: boolean;
  /** How a hostile NPC with hit points looks; never numbers. */
  health: HealthLabel | null;
  /** Place in the initiative order during a fight, from 1. */
  initiative: number | null;
  /** A player's portrait image; null shows their initials. */
  portraitUrl: string | null;
}

/** Everyone at the table: the DM at the head, the players, then the NPCs
    in the scene, with whoever has the turn flagged. While the DM is
    answering (the player just sent something) the turn is theirs;
    otherwise it is whoever the scene says, and no `turnOf` means the
    player. */
export function sceneMembers(state: GameState, dmActing: boolean): SceneMember[] {
  const members = tableMembers(state, dmActing);
  const { inCombat } = state.scene;
  // Numbers count only who is in the scene now.
  const order = state.scene.order.filter((name) => members.some((m) => m.kind !== "dm" && m.name === name));
  if (!inCombat || order.length === 0) return members;
  // In a fight: the DM at the head, then initiative order, the unlisted last.
  const place = (m: SceneMember) => (m.kind === "dm" ? -1 : order.indexOf(m.name));
  const rank = (m: SceneMember) => (place(m) === -1 && m.kind !== "dm" ? order.length : place(m));
  return [...members]
    .sort((a, b) => rank(a) - rank(b))
    .map((m) => (place(m) >= 0 ? { ...m, initiative: place(m) + 1 } : m));
}

function tableMembers(state: GameState, dmActing: boolean): SceneMember[] {
  const turnOf = dmActing ? null : (state.scene.turnOf ?? state.players[0]?.name ?? null);
  return [
    {
      name: DM_NAME,
      detail: "Narra la historia y maneja a todos los demás personajes.",
      tag: "Narrador",
      kind: "dm" as const,
      hasTurn: dmActing,
      health: null,
      initiative: null,
      portraitUrl: null,
    },
    ...state.players.map((p) => ({
      name: p.name,
      detail: `${p.race} · ${p.characterClass} · Nivel ${p.level}`,
      tag: "Jugador",
      kind: "player" as const,
      hasTurn: p.name === turnOf,
      health: null,
      initiative: null,
      portraitUrl: heroPortraitUrl(p.portrait),
    })),
    ...state.npcs
      .filter((n) => n.present)
      .map((n) => ({
        name: n.name,
        detail: n.description,
        tag: npcTag(n),
        kind: n.attitude,
        hasTurn: n.name === turnOf,
        health: n.attitude === "hostile" ? healthLabel(n) : null,
        initiative: null,
        portraitUrl: null,
      })),
  ];
}

interface Props {
  state: GameState;
  /** The DM is working on a reply, so the turn is theirs. */
  dmActing: boolean;
  open: boolean;
  onClose: () => void;
  /** Opens the rename dialog for an NPC; without it they can't be renamed. */
  onEditNpc?: (name: string) => void;
}

/** Side panel with who is at the table. The DM runs everyone but the
    player; the panel only shows whose turn it is (orange border in combat,
    green otherwise) and dims the rest. A native modal <dialog> gives focus
    trapping and Escape-to-close for free. */
export function SceneDrawer({ state, dmActing, open, onClose, onEditNpc }: Props) {
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

        <p className="scene-status">
          {inCombat
            ? members.some((m) => m.initiative !== null)
              ? "En combate · Orden de iniciativa"
              : "En combate"
            : "Sin combate"}
        </p>

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
                {member.portraitUrl ? (
                  <img src={member.portraitUrl} alt="" decoding="async" />
                ) : member.kind === "dm" ? (
                  "DM"
                ) : (
                  initials(member.name)
                )}
              </span>
              <div className="scene-card__body">
                <strong>
                  {member.initiative !== null && (
                    <span className="initiative-number" aria-label={`Iniciativa ${member.initiative}`}>
                      {member.initiative}
                    </span>
                  )}
                  {member.name}
                </strong>
                <span className="scene-card__tag">
                  {member.tag}
                  {onEditNpc && member.kind !== "player" && member.kind !== "dm" && (
                    <NpcEditButton name={member.name} onClick={() => onEditNpc(member.name)} />
                  )}
                </span>
                {member.health && <HealthTag label={member.health} />}
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

const HEALTH_TONE: Record<HealthLabel, string> = {
  Ileso: "fine",
  Herido: "hurt",
  Malherido: "bad",
  "Fuera de combate": "out",
};

export function HealthTag({ label }: { label: HealthLabel }) {
  return (
    <span className="health-tag" data-tone={HEALTH_TONE[label]}>
      {label}
    </span>
  );
}
