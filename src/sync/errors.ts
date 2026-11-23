/** Nobody chose a side (no dialog mounted, or it was dismissed): the engine leaves both copies alone and keeps the id pending. */
export class ConflictPendingError extends Error {}

/** The server answered that auto-renewal has no Google secrets configured. */
export class ServerNotConfiguredError extends Error {}
