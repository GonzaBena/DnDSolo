import { findNpc } from "./dialogue";
import { sameName } from "./names";
import { npcNameFromArchetype } from "./portraits";
import type { GameState, StateChange, TurnEvent } from "./types";

const questKey = (title: string) => title.trim().toLowerCase();

/** Whether an "hp" target is a player, read the way applyStateChanges
    reads it: an NPC by name first, any other target is the hero. */
function targetsPlayer(state: GameState, target: string): boolean {
  if (state.players.some((p) => p.id === target || sameName(p.name, target))) return true;
  return !findNpc(state.npcs, npcNameFromArchetype(target));
}

/** What happened in a turn, read from the state before and after it and
    from the changes the DM asked for. The DM used to tag these itself;
    here they can't disagree with the state. Hit point changes are read
    from the request so a hero without tracked hit points (rejected "hp")
    still gets the damage feedback. */
export function deriveEvents(prev: GameState, next: GameState, changes: readonly StateChange[]): TurnEvent[] {
  const events = new Set<TurnEvent>();

  for (const change of changes) {
    if (change.type !== "hp") continue;
    if (targetsPlayer(next, change.target)) events.add(change.delta < 0 ? "damage_taken" : "healing");
    else if (change.delta < 0) events.add("damage_dealt");
  }

  if (!prev.scene.inCombat && next.scene.inCombat) events.add("combat_start");
  if (prev.scene.inCombat && !next.scene.inCombat) events.add("combat_end");
  if (next.location.name !== "" && !sameName(prev.location.name, next.location.name)) events.add("scene_change");

  for (const player of next.players) {
    const before = prev.players.find((p) => p.id === player.id);
    if (!before) continue;
    if (player.level > before.level) events.add("level_up");
    if (player.condition === "dead" && before.condition !== "dead") events.add("death");
    const had = new Map(before.inventory.map((i) => [i.name.trim().toLowerCase(), i.quantity]));
    if (player.inventory.some((i) => i.quantity > (had.get(i.name.trim().toLowerCase()) ?? 0))) {
      events.add("item_gained");
    }
  }

  if (next.npcs.length > prev.npcs.length) events.add("new_npc");

  const quests = new Map(prev.quests.map((q) => [questKey(q.title), q.status]));
  for (const quest of next.quests) {
    const before = quests.get(questKey(quest.title));
    if (before === undefined && quest.status === "active") events.add("new_quest");
    if (quest.status === "completed" && before !== "completed") events.add("quest_completed");
  }

  return [...events];
}
