import { describe, expect, it } from "vitest";
import type { GameState } from "../src/domain/types";
import { heroProperty } from "../src/sync/DriveGameStore";
import { driveRows, pendingCount } from "../src/sync/driveImport";
import type { RemoteEntry } from "../src/sync/types";

const remote = (id: string, updatedAt: string, extra: Partial<RemoteEntry> = {}): RemoteEntry => ({
  id,
  updatedAt,
  turnCount: 1,
  deleted: false,
  ...extra,
});

const local = (id: string, updatedAt: string, name = "Aria") =>
  ({ id, updatedAt, players: [{ name, characterClass: "Mago", level: 3 }], turns: [] }) as unknown as GameState;

describe("driveRows", () => {
  it("compares each Drive campaign with this device", () => {
    const rows = driveRows(
      [
        remote("same", "2026-01-01"),
        remote("ahead", "2026-03-01"),
        remote("behind", "2026-01-01"),
        remote("new", "2026-02-01", { hero: "Borin, Guerrero nivel 1" }),
      ],
      [local("same", "2026-01-01"), local("ahead", "2026-02-01"), local("behind", "2026-02-15")],
    );
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ["ahead", "newer_remote"],
      ["new", "new"],
      ["same", "same"],
      ["behind", "newer_local"],
    ]);
    expect(rows.find((r) => r.id === "new")!.name).toBe("Borin, Guerrero nivel 1");
    expect(rows.find((r) => r.id === "same")!.name).toBe("Aria, Mago nivel 3");
    expect(pendingCount(rows)).toBe(2);
  });

  it("leaves out deleted campaigns and names old files without a hero", () => {
    const rows = driveRows([remote("gone", "2026-01-01", { deleted: true }), remote("old", "2026-01-01")], []);
    expect(rows).toEqual([{ id: "old", name: "Campaña sin nombre", status: "new", updatedAt: "2026-01-01" }]);
  });
});

describe("heroProperty", () => {
  it("is empty without a player", () => {
    expect(heroProperty({ players: [] } as unknown as GameState)).toEqual({});
  });

  it("fits Drive's 124-byte property limit", () => {
    const { hero } = heroProperty(local("a", "x", "Ñandú".repeat(40)));
    expect(new TextEncoder().encode(`hero${hero}`).length).toBeLessThanOrEqual(124);
    expect(hero!.startsWith("Ñandú")).toBe(true);
  });
});
