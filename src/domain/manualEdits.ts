import { syncStoryItems } from "./applyChanges";
import { sameName, samePlace } from "./names";
import type { GameState } from "./types";

export type InventoryEdit =
  | { type: "add"; name: string; quantity?: number }
  | { type: "delta"; name: string; delta: number }
  | { type: "remove"; name: string };

/** Manual correction for place name or combat status when the DM gets out of sync. */
export function editSceneState(
  state: GameState,
  patch: { locationName?: string; inCombat?: boolean },
): GameState {
  let next = state;
  if (patch.locationName !== undefined) {
    const name = patch.locationName.trim();
    if (name !== "") {
      const changedPlace = !samePlace(name, state.location.name);
      next = {
        ...next,
        location: {
          name,
          description: changedPlace ? "" : state.location.description,
        },
      };
    }
  }
  if (patch.inCombat !== undefined) {
    next = {
      ...next,
      scene: patch.inCombat
        ? { ...next.scene, inCombat: true }
        : { inCombat: false, turnOf: null, order: [] },
    };
  }
  return next;
}

/** Manual correction for a player's carried inventory, keeping storyItems in sync. */
export function editPlayerInventory(state: GameState, playerId: string, edit: InventoryEdit): GameState {
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) return state;

  const players = state.players.map((player, i) => {
    if (i !== index) return player;
    switch (edit.type) {
      case "add": {
        const name = edit.name.trim();
        if (!name) return player;
        const qty = Math.max(1, Math.floor(edit.quantity ?? 1));
        const existing = player.inventory.find((item) => sameName(item.name, name));
        const inventory = existing
          ? player.inventory.map((item) =>
              item === existing ? { ...item, quantity: item.quantity + qty } : item,
            )
          : [...player.inventory, { name, quantity: qty }];
        return { ...player, inventory };
      }
      case "delta": {
        if (edit.delta === 0) return player;
        const inventory = player.inventory
          .map((item) =>
            sameName(item.name, edit.name) ? { ...item, quantity: item.quantity + edit.delta } : item,
          )
          .filter((item) => item.quantity > 0);
        return { ...player, inventory };
      }
      case "remove": {
        const inventory = player.inventory.filter((item) => !sameName(item.name, edit.name));
        return { ...player, inventory };
      }
    }
  });

  return syncStoryItems({ ...state, players });
}
