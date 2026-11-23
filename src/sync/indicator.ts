import { clearDismissedConflicts } from "./conflictDialog";
import { describeSummary, showSyncToast } from "./firstConnect";
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

/** What a tap does: "sync" brings Drive's changes now, "retry" renews and resends what is pending. */
export type IndicatorAction = "sync" | "retry" | null;

export interface IndicatorView {
  /** Tooltip and accessible name: the state, plus what a tap does. */
  label: string;
  action: IndicatorAction;
}

const ACTION: Record<SyncState, IndicatorAction> = {
  off: null,
  idle: "sync",
  syncing: null,
  offline: "retry",
  reconnect: "retry",
  error: "retry",
};

const HINT: Record<Exclude<IndicatorAction, null>, string> = {
  sync: "Tocá para sincronizar ahora",
  retry: "Tocá para reintentar",
};

export function indicatorView(state: SyncState): IndicatorView {
  const action = ACTION[state];
  const label =
    state === "reconnect"
      ? "Reconectar con Google Drive"
      : action
        ? `${STATUS_LABEL[state]}. ${HINT[action]}`
        : STATUS_LABEL[state];
  return { label, action };
}

/** Fired on document when a tap on the indicator finished, so a page can re-read its games. */
export const SYNC_TAPPED_EVENT = "dnsolo:sync-tapped";

/** Drives the navbar sync button (hidden while sync is off). Returns the cleanup. */
export function mountSyncIndicator(button: HTMLButtonElement): () => void {
  let action: IndicatorAction = null;
  const render = ({ state }: SyncStatus) => {
    const view = indicatorView(state);
    action = view.action;
    button.hidden = state === "off";
    button.dataset.state = state;
    button.title = view.label;
    button.setAttribute("aria-label", view.label);
    button.setAttribute("aria-disabled", String(!action));
  };
  // withRenewal runs synchronously in the click: the Google window needs the live gesture.
  const onClick = () => {
    const sync = getSyncRuntime();
    if (!sync || !action) return;
    clearDismissedConflicts();
    const fullSync = action === "sync";
    const run = async () => {
      if (!fullSync) return sync.engine.flush();
      const summary = await sync.engine.syncAll();
      if (summary) showSyncToast(describeSummary(summary));
    };
    void withRenewal(sync, run).then(() => document.dispatchEvent(new Event(SYNC_TAPPED_EVENT)));
  };
  button.addEventListener("click", onClick);
  render(syncStatus.get());
  const unsubscribe = syncStatus.subscribe(render);
  return () => {
    unsubscribe();
    button.removeEventListener("click", onClick);
  };
}
