import { withRenewal, type SyncRuntime } from "./runtime";

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

/**
 * A turn sent from a click: `hold(true)` right away, so nothing else can be
 * sent while the Google window may be open (up to ~20 s), and `hold(false)`
 * the moment the turn itself starts. Call it synchronously in the handler.
 */
export async function sendAfterRenewal<T>(
  sync: SyncRuntime | null,
  hold: (on: boolean) => void,
  run: () => Promise<T>,
): Promise<T> {
  hold(true);
  let started = false;
  try {
    return await withRenewal(sync, () => {
      started = true;
      hold(false);
      return run();
    });
  } finally {
    // The renewal itself threw before the turn could start.
    if (!started) hold(false);
  }
}

/**
 * Whether a turn must not be sent: Drive's copy replaced the screen after the
 * click (`clickedGeneration` is stale), or is being written/opened right now.
 * The click's engine and state belong to the old screen; playing them would
 * save over Drive's copy.
 */
export function shouldDropSend(clickedGeneration: number, currentGeneration: number, paused: boolean): boolean {
  return paused || clickedGeneration !== currentGeneration;
}
