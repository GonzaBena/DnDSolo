import { describe, expect, it } from "vitest";
import { applyStateChanges } from "../src/domain/applyChanges";
import { castOf, splitDialogue } from "../src/domain/dialogue";
import { npcTag, renameNpc } from "../src/domain/npcRename";
import { stateForModel } from "../src/engine/dmPrompt";
import { sceneMembers } from "../src/game/SceneDrawer";
import type { GameState } from "../src/domain/types";
import { newGame } from "./helpers";

const wolf = (attitude: "friendly" | "hostile" = "friendly") =>
  ({
    type: "npc",
    name: "Lobo de caza",
    description: "Un lobo gris",
    attitude,
    present: true,
    voice: "",
    portrait: null,
    maxHp: 11,
  }) as const;

function tamed(): GameState {
  const { state } = applyStateChanges(newGame(), [wolf()]);
  const result = renameNpc(state, "Lobo de caza", "  Colmillo ", "Domesticado");
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

describe("renameNpc", () => {
  it("renames, keeps the old name as an alias and sets the label", () => {
    const npc = tamed().npcs[0]!;
    expect(npc).toMatchObject({ name: "Colmillo", formerNames: ["Lobo de caza"], label: "Domesticado", hp: 11 });
  });

  it("rejects an empty name and a name someone else has", () => {
    const { state } = applyStateChanges(newGame(), [wolf(), { ...wolf(), name: "Tabernero" }]);
    expect(renameNpc(state, "Lobo de caza", "  ", "").ok).toBe(false);
    expect(renameNpc(state, "Lobo de caza", "tabernero", "").ok).toBe(false);
    expect(renameNpc(state, "Lobo de caza", "Lira", "").ok).toBe(false);
  });

  it("can change only the label, and clear it", () => {
    const relabeled = renameNpc(tamed(), "Colmillo", "Colmillo", "");
    if (!relabeled.ok) throw new Error(relabeled.message);
    expect(relabeled.state.npcs[0]).not.toHaveProperty("label");
    expect(relabeled.state.npcs[0]!.formerNames).toEqual(["Lobo de caza"]);
  });

  it("moves the turn and the initiative order to the new name", () => {
    const { state } = applyStateChanges(newGame(), [
      wolf(),
      { type: "scene", inCombat: true, turnOf: "Lobo de caza", order: ["Lobo de caza", "Lira"] },
    ]);
    const result = renameNpc(state, "Lobo de caza", "Colmillo", "");
    if (!result.ok) throw new Error(result.message);
    expect(result.state.scene).toMatchObject({ turnOf: "Colmillo", order: ["Colmillo", "Lira"] });
  });
});

describe("the DM still using the old name", () => {
  it("updates the renamed NPC instead of adding another", () => {
    const { state } = applyStateChanges(tamed(), [{ ...wolf(), description: "" }]);
    expect(state.npcs).toHaveLength(1);
    expect(state.npcs[0]).toMatchObject({ name: "Colmillo", label: "Domesticado", description: "Un lobo gris" });
  });

  it("lands damage, turns and dialogue on them", () => {
    const { state } = applyStateChanges(tamed(), [
      { type: "hp", target: "Lobo de caza", delta: -3 },
      { type: "scene", inCombat: true, turnOf: "Lobo de caza", order: ["Lobo de caza", "Lira"] },
    ]);
    expect(state.npcs[0]!.hp).toBe(8);
    expect(state.scene).toMatchObject({ turnOf: "Colmillo", order: ["Colmillo", "Lira"] });
    expect(splitDialogue("[[Lobo de caza]] Grrr.", castOf(state))[0]!.speaker).toBe("Colmillo");
  });
});

describe("npcTag", () => {
  it("shows the label unless the NPC turned hostile", () => {
    expect(npcTag({ attitude: "friendly", label: "Domesticado" })).toBe("Domesticado");
    expect(npcTag({ attitude: "hostile", label: "Domesticado" })).toBe("Hostil");
    expect(npcTag({ attitude: "neutral" })).toBe("Neutral");
    expect(sceneMembers(tamed(), false).at(-1)!.tag).toBe("Domesticado");
  });
});

it("the DM sees the new name and label, not the former names", () => {
  const npc = (stateForModel(tamed()) as { npcs: Record<string, unknown>[] }).npcs[0]!;
  expect(npc).toMatchObject({ name: "Colmillo", label: "Domesticado" });
  expect(npc).not.toHaveProperty("formerNames");
});
