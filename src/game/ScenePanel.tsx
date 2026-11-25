import { findNpc } from "../domain/dialogue";
import type { GameState } from "../domain/types";
import { NpcAvatar } from "./NpcAvatar";
import { HealthTag, sceneMembers } from "./SceneDrawer";

/** The table at a glance, beside the log on wide screens: everyone in the
    scene with their face, whoever has the turn marked, and whoever is
    talking right now grown and swinging. Narrow screens keep the drawer. */
export function ScenePanel({
  state,
  dmActing,
  speaking,
}: {
  state: GameState;
  dmActing: boolean;
  /** The NPC whose line is being written, if any. */
  speaking: string | null;
}) {
  const members = sceneMembers(state, dmActing);
  return (
    <aside className="scene-panel" aria-label="Personajes en escena" data-mode={state.scene.inCombat ? "combat" : "calm"}>
      <p className="scene-panel__place">{state.location.name || "Lugar desconocido"}</p>
      {members.some((m) => m.initiative !== null) && (
        <p className="scene-panel__order">Orden de iniciativa</p>
      )}
      <ul className="scene-panel__list">
        {members.map((member) => {
          const npc = member.kind === "dm" || member.kind === "player" ? undefined : findNpc(state.npcs, member.name);
          return (
            <li
              key={`${member.kind}:${member.name}`}
              className={`scene-panel__member${member.hasTurn ? " scene-panel__member--turn" : ""}`}
              aria-current={member.hasTurn ? "true" : undefined}
            >
              <NpcAvatar
                name={member.name}
                npc={npc}
                size="lg"
                kind={member.kind}
                playerPortrait={member.portraitUrl}
                speaking={npc !== undefined && npc.name === speaking}
              />
              <span className="scene-panel__name">
                {member.initiative !== null && (
                  <span className="initiative-number" aria-label={`Iniciativa ${member.initiative}`}>
                    {member.initiative}
                  </span>
                )}
                {member.name}
              </span>
              {/* Inside the tag: the card has two rows beside the face. */}
              <span className="scene-panel__tag">
                {member.tag}
                {member.health && <> <HealthTag label={member.health} /></>}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
