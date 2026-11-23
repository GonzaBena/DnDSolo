// "Sincronización entre dispositivos": connect Google Drive, switch the
// renewal mode, sync now and disconnect.
import { saveSyncConfig, loadSyncConfig } from "../sync/config";
import { clearDismissedConflicts } from "../sync/conflictDialog";
import { askWhichToKeep, describeSummary, showSyncToast } from "../sync/firstConnect";
import { IndexedDBGameRepo } from "../persistence/IndexedDBGameRepo";
import type { SyncRuntime } from "../sync/runtime";
import type { DriveAuth } from "../sync/DriveAuth";
import { loadGis } from "../sync/gis";
import { createDriveAuth, disconnectSync, getSyncRuntime, startSyncRuntime, withRenewal } from "../sync/runtime";
import { connectFailureMessage, describeConnection } from "../sync/settingsCopy";
import { syncStatus } from "../sync/status";

export function setUpSync(section: HTMLElement) {
  const offView = section.querySelector<HTMLElement>("#sync-off")!;
  const onView = section.querySelector<HTMLElement>("#sync-on")!;
  const line = section.querySelector<HTMLElement>("#sync-line")!;
  const connectButton = section.querySelector<HTMLButtonElement>("#sync-connect")!;
  const autoRenewInput = section.querySelector<HTMLInputElement>("#sync-auto-renew")!;
  const syncNowButton = section.querySelector<HTMLButtonElement>("#sync-now")!;
  const disconnectButton = section.querySelector<HTMLButtonElement>("#sync-disconnect")!;
  const syncMessage = section.querySelector<HTMLParagraphElement>("#sync-status")!;

  const say = (text: string, tone: "info" | "ok" | "error" = "info") => {
    syncMessage.textContent = text;
    syncMessage.dataset.tone = tone;
  };

  // Connecting opens a Google window, which must open inside the click: GIS has to be loaded by then.
  let gisReady = false;
  let gisLoading = false;
  let busy = false;

  const renderLine = (status = syncStatus.get()) => {
    // Nothing synced on this page yet and the browser token is gone: the line suggests a tap.
    const needsGesture = getSyncRuntime()?.auth.needsGesture() ?? false;
    line.dataset.state = status.state === "off" ? "idle" : status.state;
    line.textContent = describeConnection(status, Date.now(), needsGesture);
  };

  const render = () => {
    const sync = getSyncRuntime();
    offView.hidden = sync !== null;
    onView.hidden = sync === null;
    // aria-disabled (not disabled) while GIS loads: it stays focusable, so focusing it starts the load.
    if (gisReady) connectButton.removeAttribute("aria-disabled");
    else connectButton.setAttribute("aria-disabled", "true");
    connectButton.disabled = busy;
    autoRenewInput.disabled = !gisReady || busy;
    syncNowButton.disabled = !gisReady || busy;
    disconnectButton.disabled = busy;
    autoRenewInput.checked = loadSyncConfig().autoRenew;
    renderLine();
  };

  syncStatus.subscribe((status) => renderLine(status));
  // Keeps "hace N min" honest while the page stays open.
  setInterval(() => renderLine(), 30_000);

  // GIS loads only for someone about to use this section (or who already synced), never for every visitor.
  const LOADING = "Cargando Google…";
  const ensureGis = () => {
    if (gisReady || gisLoading) return;
    gisLoading = true;
    say(LOADING);
    loadGis()
      .then(() => {
        gisReady = true;
        if (syncMessage.textContent === LOADING) say("");
      })
      .catch(() => say("No se pudo cargar el inicio de sesión de Google. Revisá tu conexión y probá de nuevo.", "error"))
      .finally(() => {
        gisLoading = false;
        render();
      });
  };
  for (const type of ["pointerenter", "focusin", "touchstart"]) {
    section.addEventListener(type, ensureGis, { passive: true });
  }
  if (getSyncRuntime()) ensureGis();

  /** A full sync that ends with the "se cargaron N campañas" toast (nothing when it failed). */
  const syncAndReport = (sync: SyncRuntime, run = () => sync.engine.syncAll()) =>
    run().then((summary) => {
      if (summary) showSyncToast(describeSummary(summary));
    });

  /** Before the first sync: the player picks which of this device's campaigns go up; the rest are deleted here. */
  const chooseLocalGames = async () => {
    const local = new IndexedDBGameRepo();
    const games = await local.list().catch(() => []);
    const keep = await askWhichToKeep(games);
    for (const game of games) {
      if (!keep.has(game.id)) await local.delete(game.id).catch(() => undefined);
    }
  };

  /** Runs `connect` (already called inside the click) and, on success, makes `auth` the page's runtime.
      `firstTime`: connecting from off, so ask which local campaigns to keep before syncing. */
  const finishConnect = async (auth: DriveAuth, connecting: Promise<boolean>, autoRenew: boolean, firstTime = false) => {
    let failure: unknown = false;
    try {
      if (await connecting) {
        if (firstTime) await chooseLocalGames();
        saveSyncConfig({ enabled: true, autoRenew });
        const sync = startSyncRuntime(auth);
        say("Conectado a Google Drive.", "ok");
        if (firstTime) void syncAndReport(sync);
        else void sync.engine.syncAll();
        return true;
      }
    } catch (error) {
      failure = error;
    }
    say(connectFailureMessage(failure), "error");
    return false;
  };

  connectButton.addEventListener("click", () => {
    if (!gisReady) return ensureGis();
    if (busy) return;
    const auth = createDriveAuth(false);
    const connecting = auth.connect(); // synchronous inside the click: popups need the live gesture
    busy = true;
    render();
    say("Esperando a Google…");
    void finishConnect(auth, connecting, false, true).finally(() => {
      busy = false;
      render();
    });
  });

  // Switching changes the kind of permission, so it asks Google again. Both modes share one
  // grant, so nothing is revoked at Google here: revoking either side would end the new one too.
  autoRenewInput.addEventListener("change", () => {
    const current = getSyncRuntime();
    const autoRenew = autoRenewInput.checked;
    if (!current || !gisReady || busy) return render();
    const auth = createDriveAuth(autoRenew);
    const connecting = auth.connect(); // the click's only gesture call, before any await
    busy = true;
    render();
    say("Esperando a Google…");
    void finishConnect(auth, connecting, autoRenew)
      .then((ok) => {
        // Success: the old mode lets go of its credentials only (browser token, or the server's cookie).
        // Failure: the old mode was never touched and keeps working.
        if (ok) void current.auth.forget();
      })
      .finally(() => {
        busy = false;
        render();
      });
  });

  syncNowButton.addEventListener("click", () => {
    const sync = getSyncRuntime();
    if (!sync) return;
    // An explicit action: conflicts dismissed earlier are asked again.
    clearDismissedConflicts();
    say("");
    void syncAndReport(sync, () => withRenewal(sync, () => sync.engine.syncAll()));
  });

  disconnectButton.addEventListener("click", () => {
    const sync = getSyncRuntime();
    if (!sync || busy) return;
    busy = true;
    render();
    void disconnectSync(sync).finally(() => {
      busy = false;
      render();
      say("Desconectado. Tus campañas siguen en este dispositivo y en tu Drive.", "ok");
    });
  });

  render();
  // A fresh status for the line; with an expired browser token it waits for "Sincronizar ahora".
  const sync = getSyncRuntime();
  if (sync && !sync.auth.needsGesture()) void sync.engine.syncAll();
}
