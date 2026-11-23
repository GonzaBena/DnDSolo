import { describe, expect, it } from "vitest";
import type { GameState } from "../src/domain/types";
import { conflictQuestion, decideImport } from "../src/home/importFile";
import { newGame } from "./helpers";

const saved = (updatedAt = "2026-01-02T00:00:00.000Z"): GameState => ({ ...newGame(), updatedAt });
const none = async () => null;

describe("decideImport", () => {
  it("refuses text that is not JSON", async () => {
    expect(await decideImport("no es json", none)).toEqual({ kind: "invalid" });
  });

  it("refuses JSON that is not a campaign", async () => {
    expect(await decideImport(JSON.stringify({ hola: 1 }), none)).toEqual({ kind: "invalid" });
  });

  it("saves a campaign this device doesn't have", async () => {
    const decision = await decideImport(JSON.stringify(saved()), none);
    expect(decision.kind).toBe("new");
  });

  it("skips an identical save", async () => {
    const game = saved();
    const decision = await decideImport(JSON.stringify(game), async () => game);
    expect(decision.kind).toBe("same");
  });

  it("asks when the file is newer or older than this device's copy", async () => {
    const file = JSON.stringify(saved("2026-01-05T00:00:00.000Z"));
    expect(await decideImport(file, async () => saved("2026-01-01T00:00:00.000Z"))).toMatchObject({
      kind: "conflict",
      newer: true,
    });
    expect(await decideImport(file, async () => saved("2026-01-09T00:00:00.000Z"))).toMatchObject({
      kind: "conflict",
      newer: false,
    });
  });

  it("reports when this device's saves can't be read", async () => {
    const decision = await decideImport(JSON.stringify(saved()), async () => {
      throw new Error("IndexedDB blocked");
    });
    expect(decision).toEqual({ kind: "unreadable" });
  });
});

describe("conflictQuestion", () => {
  it("says which copy is newer", () => {
    expect(conflictQuestion("Lira", true)).toBe("Ya tenés «Lira». La del archivo es más nueva.");
    expect(conflictQuestion("Lira", false)).toBe("Ya tenés «Lira», y la tuya es más nueva que la del archivo.");
  });
});
