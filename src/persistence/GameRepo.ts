import type { GameState } from "../domain/types";

// The only door to persistence (Spec, architecture rule 4). Today it's
// IndexedDB; tomorrow it can be Firestore without the engine noticing.
export interface GameRepo {
  save(state: GameState): Promise<void>;
  load(id: string): Promise<GameState | null>;
  /** The most recently updated game, for "Continuar". */
  loadLatest(): Promise<GameState | null>;
  delete(id: string): Promise<void>;
}
