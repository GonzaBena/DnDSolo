import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { editPlayerInventory, editSceneState } from "../src/domain/manualEdits";
import { TurnEngine } from "../src/engine/TurnEngine";
import { SceneDrawer } from "../src/game/SceneDrawer";
import { FakeLLMClient } from "../src/llm/FakeLLMClient";
import { InMemoryGameRepo } from "../src/persistence/InMemoryGameRepo";
import { newGame } from "./helpers";

describe("manualEdits", () => {
  it("edits location name (clearing stale description only when place changes) and exits combat cleanly", () => {
    const base = {
      ...newGame(),
      location: { name: "Taberna", description: "Huele a humo." },
      scene: { inCombat: true, turnOf: "Goblin", order: ["Lyra", "Goblin"] },
    };

    const samePlace = editSceneState(base, { locationName: "taberna" });
    expect(samePlace.location.description).toBe("Huele a humo.");

    const moved = editSceneState(base, { locationName: "Callejón oscuro", inCombat: false });
    expect(moved.location).toEqual({ name: "Callejón oscuro", description: "" });
    expect(moved.scene).toEqual({ inCombat: false, turnOf: null, order: [] });
  });

  it("adds, increments, decrements and removes inventory items while keeping storyItems synced", () => {
    const base = newGame();
    const pid = base.players[0]!.id;

    const added = editPlayerInventory(base, pid, { type: "add", name: "Llave oxidada", quantity: 2 });
    expect(added.players[0]!.inventory).toContainEqual({ name: "Llave oxidada", quantity: 2 });
    expect(added.storyItems).toContainEqual(expect.objectContaining({ name: "Llave oxidada", status: "taken" }));

    const merged = editPlayerInventory(added, pid, { type: "add", name: "llave oxidada", quantity: 1 });
    expect(merged.players[0]!.inventory.find((i) => i.name === "Llave oxidada")?.quantity).toBe(3);

    const dec = editPlayerInventory(merged, pid, { type: "delta", name: "Llave oxidada", delta: -3 });
    expect(dec.players[0]!.inventory.some((i) => i.name === "Llave oxidada")).toBe(false);
    expect(dec.storyItems.find((i) => i.name === "Llave oxidada")?.status).toBe("gone");

    const readded = editPlayerInventory(dec, pid, { type: "add", name: "Antorcha" });
    const removed = editPlayerInventory(readded, pid, { type: "remove", name: "antorcha" });
    expect(removed.players[0]!.inventory.some((i) => i.name === "Antorcha")).toBe(false);
  });

  it("persists manual edits via TurnEngine.updateState", async () => {
    const repo = new InMemoryGameRepo();
    const engine = new TurnEngine({ llm: new FakeLLMClient(), repo });
    const base = newGame();
    await repo.save(base);

    const res = await engine.updateState(base, (s) => editSceneState(s, { locationName: "Puerto" }));
    expect(res.saveError).toBeNull();
    expect(res.state.location.name).toBe("Puerto");
    expect((await repo.load(base.id))?.location.name).toBe("Puerto");
  });

  it("renders manual scene editing controls in SceneDrawer when onEditScene is passed", () => {
    const html = renderToStaticMarkup(
      <SceneDrawer state={newGame()} dmActing={false} open onClose={() => {}} onEditScene={async () => {}} />,
    );
    expect(html).toContain("Corregir lugar o combate");
    expect(html).toContain("Lugar actual");
  });
});
