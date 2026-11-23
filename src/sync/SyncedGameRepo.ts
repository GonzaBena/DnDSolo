import type { GameState } from "../domain/types";
import type { GameRepo } from "../persistence/GameRepo";
import type { SyncEngine } from "./SyncEngine";

/** Drop-in GameRepo: every call resolves with the local result; Drive work
    is only scheduled, so a Drive failure never rejects these promises. */
export class SyncedGameRepo implements GameRepo {
  constructor(
    private readonly local: GameRepo,
    private readonly engine: SyncEngine,
  ) {}

  async save(state: GameState): Promise<void> {
    await this.local.save(state);
    this.engine.schedulePush(state.id);
  }

  load(id: string): Promise<GameState | null> {
    return this.local.load(id);
  }

  loadLatest(): Promise<GameState | null> {
    return this.local.loadLatest();
  }

  list(): Promise<GameState[]> {
    return this.local.list();
  }

  async delete(id: string): Promise<void> {
    await this.local.delete(id);
    this.engine.deleteEverywhere(id);
  }
}
