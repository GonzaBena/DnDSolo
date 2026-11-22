// Pure copy for the sync section of Configuración, kept out of the page script so it can be tested.
import { describeAgo } from "./conflictDialog";
import { ServerNotConfiguredError } from "./errors";
import { STATUS_LABEL } from "./indicator";
import type { SyncStatus } from "./status";

export const CONNECT_FAILED = "No se conectó con Google.";
export const NOT_CONFIGURED = "La renovación automática no está configurada en este servidor.";

const CONNECTED = "Conectado a Google Drive";

/** `connect()` resolved false or rejected: what to tell the player. */
export function connectFailureMessage(failure: unknown): string {
  return failure instanceof ServerNotConfiguredError ? NOT_CONFIGURED : CONNECT_FAILED;
}

/** "Conectado a Google Drive · última sincronización hace 2 min", or the problem when there is one. */
export function describeConnection({ state, lastSyncedAt }: SyncStatus, now: number): string {
  const last = lastSyncedAt ? ` · última sincronización ${describeAgo(lastSyncedAt, now)}` : "";
  switch (state) {
    case "off":
    case "idle":
      return CONNECTED + last;
    case "syncing":
      return `${CONNECTED} · ${STATUS_LABEL.syncing}`;
    case "reconnect":
      return "Hay que volver a conectar: tocá «Sincronizar ahora»";
    default:
      return STATUS_LABEL[state] + last;
  }
}
