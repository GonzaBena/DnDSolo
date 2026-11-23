import type { Bases, LocalEntry, RemoteEntry, SyncAction } from "./types";

/**
 * Decides, per game, what to do given the local list, the Drive list and the
 * bases (the updatedAt both sides last agreed on). Pure: no I/O.
 * Output order: ids of `local` first, then the remaining ids of `remote`.
 */
export function reconcile(local: LocalEntry[], remote: RemoteEntry[], bases: Bases): SyncAction[] {
  const localById = new Map(local.map((entry) => [entry.id, entry]));
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]));
  const ids = [...localById.keys(), ...remote.map((r) => r.id).filter((id) => !localById.has(id))];

  return ids.flatMap((id) => reconcileOne(id, localById.get(id), remoteById.get(id), bases[id]));
}

function reconcileOne(
  id: string,
  l: LocalEntry | undefined,
  r: RemoteEntry | undefined,
  base: string | undefined,
): SyncAction[] {
  // Only local: new game, or Drive lost it. Either way, push it.
  if (l && !r) return [{ type: "upload", id }];

  // Only remote.
  if (!l && r) {
    if (r.deleted) return base === undefined ? [] : [{ type: "forget_base", id }];
    if (base === undefined) return [{ type: "download", id }];
    // Deleted locally since the last sync: propagate unless Drive changed meanwhile.
    return r.updatedAt === base ? [{ type: "tombstone", id }] : [{ type: "download", id }];
  }

  if (!l || !r) return [];

  // Both exist, remote is a tombstone.
  if (r.deleted) {
    return base !== undefined && l.updatedAt === base
      ? [
          { type: "delete_local", id },
          { type: "forget_base", id },
        ]
      : [{ type: "conflict", id, kind: "deleted_remotely" }];
  }

  // Both exist and already identical.
  if (l.updatedAt === r.updatedAt) return [{ type: "mark_synced", id, updatedAt: l.updatedAt }];

  // First connection with two different copies: nothing says which one is newer on purpose, so ask.
  if (base === undefined) return [{ type: "conflict", id, kind: "both_changed" }];

  const localChanged = l.updatedAt !== base;
  const remoteChanged = r.updatedAt !== base;
  if (localChanged && remoteChanged) return [{ type: "conflict", id, kind: "both_changed" }];
  if (localChanged) return [{ type: "upload", id }];
  return [{ type: "download", id }];
}
