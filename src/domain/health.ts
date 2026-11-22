import type { Npc } from "./types";

export type HealthLabel = "Ileso" | "Herido" | "Malherido" | "Fuera de combate";

/** How an NPC looks, without giving away numbers; null when it has no hit points tracked. */
export function healthLabel(npc: Pick<Npc, "hp" | "maxHp">): HealthLabel | null {
  if (npc.maxHp === null || npc.hp === null) return null;
  if (npc.hp >= npc.maxHp) return "Ileso";
  if (npc.hp / npc.maxHp > 0.5) return "Herido";
  return npc.hp > 0 ? "Malherido" : "Fuera de combate";
}
