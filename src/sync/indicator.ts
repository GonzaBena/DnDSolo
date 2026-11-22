import { getSyncRuntime, withRenewal } from "./runtime";
import { syncStatus, type SyncState, type SyncStatus } from "./status";

export const STATUS_LABEL: Record<SyncState, string> = {
  off: "",
  idle: "Sincronizado",
  syncing: "Sincronizando…",
  offline: "Sin conexión, se sube después",
  reconnect: "Reconectar",
  error: "No se pudo sincronizar",
};

/** Shows the sync state inside `host` (hidden when sync is off). Returns the cleanup. */
export function mountSyncIndicator(host: HTMLElement): () => void {
  const render = ({ state }: SyncStatus) => {
    host.hidden = state === "off";
    host.replaceChildren();
    if (state === "off") return;
    host.className = "sync-indicator";
    host.dataset.state = state;
    if (state === "reconnect") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button sync-indicator__button";
      button.textContent = STATUS_LABEL.reconnect;
      button.addEventListener("click", () => {
        const sync = getSyncRuntime();
        if (sync) void withRenewal(sync, () => sync.engine.flush());
      });
      host.append(button);
    } else {
      host.textContent = STATUS_LABEL[state];
    }
  };
  render(syncStatus.get());
  const unsubscribe = syncStatus.subscribe(render);
  return () => {
    unsubscribe();
    host.replaceChildren();
  };
}
