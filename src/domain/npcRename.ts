import { findNpc } from "./dialogue";
import { sameName } from "./names";
import type { Attitude, GameState, Npc } from "./types";

export const NPC_NAME_MAX = 40;
export const NPC_LABEL_MAX = 24;

const ATTITUDE_LABEL: Record<Attitude, string> = {
  friendly: "Amistoso",
  neutral: "Neutral",
  hostile: "Hostil",
};

/** The tag under an NPC's name: the player's label, unless they turned hostile. */
export function npcTag(npc: Pick<Npc, "attitude" | "label">): string {
  const label = npc.label?.trim() ?? "";
  return label !== "" && npc.attitude !== "hostile" ? label : ATTITUDE_LABEL[npc.attitude];
}

export type RenameResult = { ok: true; state: GameState } | { ok: false; message: string };

/** The player renames an NPC (a tamed wolf becomes "Colmillo") and sets their
    label. The old name stays as an alias, so the DM still using it lands on
    the same NPC; the scene's turn and initiative follow the new name. */
export function renameNpc(state: GameState, currentName: string, newName: string, label: string): RenameResult {
  const npc = state.npcs.find((n) => n.name === currentName);
  if (!npc) return { ok: false, message: "Ese personaje ya no está." };
  const name = newName.trim().replace(/\s+/g, " ");
  if (name === "") return { ok: false, message: "Escribí un nombre." };
  if (name.length > NPC_NAME_MAX) return { ok: false, message: `El nombre puede tener hasta ${NPC_NAME_MAX} letras.` };
  const tag = label.trim().replace(/\s+/g, " ");
  if (tag.length > NPC_LABEL_MAX) return { ok: false, message: `La etiqueta puede tener hasta ${NPC_LABEL_MAX} letras.` };
  const taken = state.players.some((p) => sameName(p.name, name)) || (findNpc(state.npcs, name) ?? npc) !== npc;
  if (taken) return { ok: false, message: "Ya hay otro personaje con ese nombre." };

  const formerNames = [...(npc.formerNames ?? []), npc.name].filter(
    (former, i, all) => !sameName(former, name) && all.findIndex((f) => sameName(f, former)) === i,
  );
  const { label: _old, ...rest } = npc;
  const renamed: Npc = {
    ...rest,
    name,
    ...(formerNames.length > 0 ? { formerNames } : {}),
    ...(tag !== "" ? { label: tag } : {}),
  };
  const follow = (n: string) => (n === npc.name ? name : n);
  return {
    ok: true,
    state: {
      ...state,
      npcs: state.npcs.map((n) => (n === npc ? renamed : n)),
      scene: {
        ...state.scene,
        turnOf: state.scene.turnOf === null ? null : follow(state.scene.turnOf),
        order: state.scene.order.map(follow),
      },
    },
  };
}
