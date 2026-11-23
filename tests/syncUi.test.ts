import { describe, expect, it } from "vitest";
import type { GameState, Turn } from "../src/domain/types";
import { vi } from "vitest";
import { clearDismissedConflicts, describeVersion, rememberDismissals } from "../src/sync/conflictDialog";
import { ConflictPendingError } from "../src/sync/errors";
import { STATUS_LABEL } from "../src/sync/indicator";
import { newGame } from "./helpers";

const NOW = Date.UTC(2026, 0, 10, 12, 0);
const turn = (n: number): Turn => ({ number: n, input: { type: "start" }, narration: "", events: [] });

function saved(msAgo: number, turns: number): GameState {
  return {
    ...newGame(),
    updatedAt: new Date(NOW - msAgo).toISOString(),
    turns: Array.from({ length: turns }, (_, i) => turn(i + 1)),
  };
}

describe("describeVersion", () => {
  it("shows the turn count and minutes", () => {
    expect(describeVersion(saved(10 * 60_000, 40), NOW)).toBe("turno 40 · hace 10 min");
  });
  it("shows hours", () => {
    expect(describeVersion(saved(2 * 3_600_000 + 5 * 60_000, 42), NOW)).toBe("turno 42 · hace 2 h");
  });
  it("shows days", () => {
    expect(describeVersion(saved(3 * 86_400_000, 7), NOW)).toBe("turno 7 · hace 3 días");
    expect(describeVersion(saved(86_400_000, 7), NOW)).toBe("turno 7 · hace 1 día");
  });
  it("says just now under a minute", () => {
    expect(describeVersion(saved(5_000, 0), NOW)).toBe("turno 0 · hace un momento");
  });
});

describe("STATUS_LABEL", () => {
  it("has the exact copy", () => {
    expect(STATUS_LABEL).toEqual({
      off: "",
      idle: "Sincronizado",
      syncing: "Sincronizando…",
      offline: "Sin conexión, se sube después",
      reconnect: "Reconectar",
      error: "No se pudo sincronizar",
    });
  });
});

describe("rememberDismissals", () => {
  const conflict = { id: "g1", kind: "both_changed" as const, local: null, remote: null };

  it("does not ask again for a dismissed id until cleared", async () => {
    clearDismissedConflicts();
    const show = vi.fn().mockRejectedValueOnce(new ConflictPendingError("x")).mockResolvedValue("local");
    const resolve = rememberDismissals(show);

    await expect(resolve(conflict)).rejects.toBeInstanceOf(ConflictPendingError);
    await expect(resolve(conflict)).rejects.toBeInstanceOf(ConflictPendingError);
    expect(show).toHaveBeenCalledTimes(1);

    clearDismissedConflicts();
    await expect(resolve(conflict)).resolves.toBe("local");
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("does not remember other failures", async () => {
    clearDismissedConflicts();
    const show = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue("remote");
    const resolve = rememberDismissals(show);
    await expect(resolve(conflict)).rejects.toThrow("boom");
    await expect(resolve(conflict)).resolves.toBe("remote");
  });
});
