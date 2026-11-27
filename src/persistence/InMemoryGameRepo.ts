import type { GameState } from "../domain/types";
import { extractGameSummary, type GameRepo, type GameSummary } from "./GameRepo";

/** For tests, and a reference for what any GameRepo must do. */
export class InMemoryGameRepo implements GameRepo {
  private readonly games = new Map<string, GameState>();
  saveCount = 0;

  async save(state: GameState): Promise<void> {
    this.saveCount += 1;
    // Clone so later changes to the caller's object can't alter the "disk".
    this.games.set(state.id, structuredClone(state));
  }

  async load(id: string): Promise<GameState | null> {
    const found = this.games.get(id);
    return found ? structuredClone(found) : null;
  }

  async loadLatest(): Promise<GameState | null> {
    let latest: GameState | null = null;
    for (const game of this.games.values()) {
      if (!latest || game.updatedAt > latest.updatedAt) latest = game;
    }
    return latest ? structuredClone(latest) : null;
  }

  async list(): Promise<GameState[]> {
    return [...this.games.values()]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .map((game) => structuredClone(game));
  }

  async listSummaries(): Promise<GameSummary[]> {
    const out: GameSummary[] = [];
    for (const game of [...this.games.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))) {
      const summary = extractGameSummary(game);
      if (summary) out.push(summary);
    }
    return out;
  }

  async delete(id: string): Promise<void> {
    this.games.delete(id);
  }
}
