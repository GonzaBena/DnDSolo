import { describe, expect, it } from "vitest";
import { describeAgo } from "../src/sync/conflictDialog";
import { ServerNotConfiguredError } from "../src/sync/errors";
import { indicatorView } from "../src/sync/indicator";
import { CONNECT_FAILED, NOT_CONFIGURED, connectFailureMessage, describeConnection } from "../src/sync/settingsCopy";

const NOW = Date.UTC(2026, 0, 10, 12, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("describeAgo", () => {
  it("formats minutes, hours and days", () => {
    expect(describeAgo(ago(30_000), NOW)).toBe("hace un momento");
    expect(describeAgo(ago(2 * 60_000), NOW)).toBe("hace 2 min");
    expect(describeAgo(ago(3 * 3_600_000), NOW)).toBe("hace 3 h");
    expect(describeAgo(ago(86_400_000), NOW)).toBe("hace 1 día");
  });
  it("never says a future time", () => {
    expect(describeAgo(new Date(NOW + 60_000).toISOString(), NOW)).toBe("hace un momento");
  });
});

describe("describeConnection", () => {
  it("matches the mockup when synced", () => {
    expect(describeConnection({ state: "idle", lastSyncedAt: ago(2 * 60_000) }, NOW)).toBe(
      "Conectado a Google Drive · última sincronización hace 2 min",
    );
  });
  it("omits the last sync before the first one", () => {
    expect(describeConnection({ state: "off", lastSyncedAt: null }, NOW)).toBe("Conectado a Google Drive");
    expect(describeConnection({ state: "idle", lastSyncedAt: null }, NOW)).toBe("Conectado a Google Drive");
  });
  it("softly suggests syncing when the browser token is gone and nothing synced yet", () => {
    expect(describeConnection({ state: "off", lastSyncedAt: null }, NOW, true)).toBe(
      "Conectado a Google Drive · tocá «Sincronizar ahora» para actualizar",
    );
    // A real state wins over the hint.
    expect(describeConnection({ state: "syncing", lastSyncedAt: null }, NOW, true)).toBe(
      "Conectado a Google Drive · Sincronizando…",
    );
  });
  it("says it is syncing", () => {
    expect(describeConnection({ state: "syncing", lastSyncedAt: null }, NOW)).toBe(
      "Conectado a Google Drive · Sincronizando…",
    );
  });
  it("shows the problem, keeping the last good sync", () => {
    expect(describeConnection({ state: "offline", lastSyncedAt: ago(5 * 60_000) }, NOW)).toBe(
      "Sin conexión, se sube después · última sincronización hace 5 min",
    );
    expect(describeConnection({ state: "error", lastSyncedAt: null }, NOW)).toBe("No se pudo sincronizar");
    expect(describeConnection({ state: "reconnect", lastSyncedAt: null }, NOW)).toBe(
      "Hay que volver a conectar: tocá «Sincronizar ahora»",
    );
  });
});

describe("connectFailureMessage", () => {
  it("explains a server without auto-renewal", () => {
    expect(connectFailureMessage(new ServerNotConfiguredError("x"))).toBe(NOT_CONFIGURED);
    expect(NOT_CONFIGURED).toBe("La renovación automática no está configurada en este servidor.");
  });
  it("falls back to the generic message", () => {
    expect(connectFailureMessage(false)).toBe(CONNECT_FAILED);
    expect(connectFailureMessage(new Error("boom"))).toBe(CONNECT_FAILED);
    expect(CONNECT_FAILED).toBe("No se conectó con Google.");
  });
});

describe("indicatorView", () => {
  it("syncs now when green", () => {
    expect(indicatorView("idle")).toEqual({ label: "Sincronizado. Tocá para sincronizar ahora", action: "sync" });
  });
  it("retries when reconnect, error or offline", () => {
    expect(indicatorView("reconnect")).toEqual({ label: "Reconectar con Google Drive", action: "retry" });
    expect(indicatorView("error")).toEqual({ label: "No se pudo sincronizar. Tocá para reintentar", action: "retry" });
    expect(indicatorView("offline")).toEqual({
      label: "Sin conexión, se sube después. Tocá para reintentar",
      action: "retry",
    });
  });
  it("does nothing while syncing or off", () => {
    expect(indicatorView("syncing")).toEqual({ label: "Sincronizando…", action: null });
    expect(indicatorView("off").action).toBeNull();
  });
});
