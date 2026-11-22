import type { SyncRuntime } from "./runtime";

export type OpenOutcome = "downloaded" | "unchanged";

/**
 * Reconciles `id` (every game when null, for "Continuar") for up to
 * `timeoutMs`. A real race: a conflict dialog can hold the engine for as
 * long as the player looks at it, so this never waits on it unbounded.
 * `late` is null when the reconcile finished in time; otherwise it resolves
 * when it does. Never rejects. With no id, `late` resolves "unchanged": the
 * caller compares what it loaded with the newest local save.
 */
export async function syncBeforeOpen(
  sync: SyncRuntime | null,
  id: string | null,
  timeoutMs = 3000,
): Promise<{ late: Promise<OpenOutcome> | null }> {
  if (!sync) return { late: null };
  const run: Promise<OpenOutcome> = (
    id ? sync.engine.syncGame(id) : sync.engine.syncAll().then((): OpenOutcome => "unchanged")
  ).catch((): OpenOutcome => "unchanged");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<true>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });
  const late = await Promise.race([run.then(() => false), timedOut]);
  clearTimeout(timer);
  return { late: late ? run : null };
}
