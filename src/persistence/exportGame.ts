import type { GameState } from "../domain/types";

/** Hands the player a JSON file with the whole campaign. */
export function downloadGame(game: GameState): void {
  const blob = new Blob([JSON.stringify(game, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const name = game.players[0]?.name ?? "campania";
  link.download = `dungeonsolo-${name.replace(/[^\p{L}\p{N}]+/gu, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
