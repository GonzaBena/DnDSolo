import type { GameState } from "../domain/types";
import { GAME_STATE_VERSION } from "../domain/types";

export interface GameSummary {
  id: string;
  updatedAt: string;
  campaignId: string | null;
  player: { name: string; characterClass: string; level: number } | null;
  turnCount: number;
  latestNarration: string;
}

/** Extracts lightweight listing metadata from a stored save without running
    full Zod validation over every turn. Returns null for unreadable/future saves. */
export function extractGameSummary(raw: unknown): GameSummary | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.updatedAt !== "string") return null;
  if (typeof r.version !== "number" || r.version < 1 || r.version > GAME_STATE_VERSION) return null;

  let player: GameSummary["player"] = null;
  if (Array.isArray(r.players) && typeof r.players[0] === "object" && r.players[0] !== null) {
    const p = r.players[0] as Record<string, unknown>;
    if (typeof p.name === "string" && typeof p.characterClass === "string" && typeof p.level === "number") {
      player = { name: p.name, characterClass: p.characterClass, level: p.level };
    }
  }

  let turnCount = 0;
  let latestNarration = "";
  if (Array.isArray(r.turns)) {
    turnCount = r.turns.length;
    for (let i = r.turns.length - 1; i >= 0; i--) {
      const t = r.turns[i];
      if (typeof t === "object" && t !== null) {
        const narration = (t as Record<string, unknown>).narration;
        if (typeof narration === "string" && narration.trim() !== "") {
          latestNarration = narration;
          break;
        }
      }
    }
  }

  return {
    id: r.id,
    updatedAt: r.updatedAt,
    campaignId: typeof r.campaignId === "string" ? r.campaignId : null,
    player,
    turnCount,
    latestNarration,
  };
}

// The only door to persistence (Spec, architecture rule 4). Today it's
// IndexedDB; tomorrow it can be Firestore without the engine noticing.
export interface GameRepo {
  save(state: GameState): Promise<void>;
  load(id: string): Promise<GameState | null>;
  /** The most recently updated game, for "Continuar". */
  loadLatest(): Promise<GameState | null>;
  /** Every readable game, most recently updated first, for "Cargar campaña". */
  list(): Promise<GameState[]>;
  /** Lightweight summaries, most recently updated first, without validating turns. */
  listSummaries(): Promise<GameSummary[]>;
  delete(id: string): Promise<void>;
}
