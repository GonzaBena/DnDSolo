import { clearDismissedConflicts } from "./conflictDialog";
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

/** States shown as a button that retries: renews with the click and asks dismissed conflicts again. */
export const RETRY_STATES: ReadonlySet<SyncState> = new Set<SyncState>(["reconnect", "error"]);

/** Shows the sync state inside `host` (hidden when sync is off). Returns the cleanup. */
export function mountSyncIndicator(host: HTMLElement): () => void {
  const render = ({ state }: SyncStatus) => {
    host.hidden = state === "off";
    host.replaceChildren();
    if (state === "off") return;
    host.classList.add("sync-indicator");
    host.dataset.state = state;
    if (RETRY_STATES.has(state)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button sync-indicator__button";
      button.textContent = STATUS_LABEL[state];
      // withRenewal runs synchronously in the click: the Google window needs the live gesture.
      button.addEventListener("click", () => {
        clearDismissedConflicts();
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
