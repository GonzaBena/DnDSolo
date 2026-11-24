import { isAmbush } from "../domain/arrivals";
import type { GameState } from "../domain/types";
import type { ToastItem } from "./EventToasts";

type Draft = Omit<ToastItem, "id">;

const key = (name: string) => name.trim().toLowerCase();

function inventoryOf(state: GameState): Map<string, { name: string; quantity: number }> {
  const map = new Map<string, { name: string; quantity: number }>();
  for (const item of state.players[0]?.inventory ?? []) {
    const k = key(item.name);
    const known = map.get(k);
    map.set(k, { name: item.name, quantity: (known?.quantity ?? 0) + item.quantity });
  }
  return map;
}

/** The first player's tracked hit points, or null while the sheet has none. */
function hpOf(state: GameState): { current: number; max: number } | null {
  const player = state.players[0];
  if (!player || player.stats === null || player.currentHp === null) return null;
  return { current: player.currentHp, max: player.stats.maxHp };
}

function itemDetail(name: string, amount: number): string {
  return amount > 1 ? `${name} ×${amount}` : name;
}

/**
 * Toasts for one turn, computed from what actually changed between the
 * previous and the applied state, so changes the referee rejected never
 * show up. Combat and healing have no state to diff and come from events.
 */
export function buildTurnToasts(
  prev: GameState,
  next: GameState,
  events: readonly string[],
  stamp: number,
): ToastItem[] {
  const drafts: Draft[] = [];

  const hpBefore = hpOf(prev);
  const hpAfter = hpOf(next);
  // With tracked hit points the toast comes from the real change, so it
  // carries the exact number and a rejected change shows nothing.
  const tracked = hpBefore !== null && hpAfter !== null;
  if (tracked) {
    const delta = hpAfter.current - hpBefore.current;
    const shown = `(${hpAfter.current}/${hpAfter.max})`;
    if (delta < 0) {
      drafts.push({
        kind: "damage",
        title: "¡Daño recibido!",
        detail: `Perdiste ${-delta} PG ${shown}.`,
      });
    } else if (delta > 0) {
      drafts.push({
        kind: "healing",
        title: "Recuperación",
        detail: `Recuperaste ${delta} PG ${shown}.`,
      });
    }
  }
  if (!tracked && events.includes("damage_taken")) {
    drafts.push({
      kind: "damage",
      title: "¡Daño recibido!",
      detail: "Hubo un impacto en combate o peligro del entorno.",
    });
  }
  if (!tracked && events.includes("healing")) {
    drafts.push({
      kind: "healing",
      title: "Recuperación",
      detail: "Te recuperaste o recibiste curación.",
    });
  }
  if (events.includes("combat_start")) {
    // An ambush gets its own banner (see AmbushBanner) instead. Decided from
    // the arrivals the new turn stored, the same ones the banner shows.
    const arrivals = next.turns.length > prev.turns.length ? (next.turns.at(-1)?.arrivals ?? []) : [];
    if (!isAmbush(events, arrivals)) {
      drafts.push({
        kind: "combat",
        title: "¡Iniciativa!",
        detail: "Comenzó un enfrentamiento en la escena.",
      });
    }
  } else if (events.includes("combat_end")) {
    drafts.push({
      kind: "info",
      title: "Fin del combate",
      detail: "La calma regresa al entorno.",
    });
  }

  // A level up gets its own screen (see LevelUpScreen).

  const before = inventoryOf(prev);
  const after = inventoryOf(next);
  for (const [k, item] of after) {
    const gained = item.quantity - (before.get(k)?.quantity ?? 0);
    if (gained > 0) {
      drafts.push({
        kind: "item",
        title: "Objeto obtenido",
        detail: itemDetail(item.name, gained),
      });
    }
  }
  for (const [k, item] of before) {
    const lost = item.quantity - (after.get(k)?.quantity ?? 0);
    if (lost > 0) {
      drafts.push({
        kind: "item",
        title: "Objeto usado o perdido",
        detail: itemDetail(item.name, lost),
      });
    }
  }

  const prevQuests = new Map(prev.quests.map((q) => [key(q.title), q]));
  for (const quest of next.quests) {
    const old = prevQuests.get(key(quest.title));
    // A quest that closes gets a banner instead (see questBanners).
    if (quest.status === "active" && !old) {
      drafts.push({ kind: "quest", title: "Nueva misión", detail: quest.title });
    }
  }

  return drafts.map((draft, index) => ({ ...draft, id: `${draft.kind}-${stamp}-${index}` }));
}

/** Whether the screen should shake: a player took damage. With tracked hit
    points (`prev` and `next` given) it is the real drop, otherwise the event. */
export function tookDamage(
  events: readonly string[],
  prev?: GameState,
  next?: GameState,
): boolean {
  const before = prev ? hpOf(prev) : null;
  const after = next ? hpOf(next) : null;
  if (before !== null && after !== null) return after.current < before.current;
  return events.includes("damage_taken");
}
