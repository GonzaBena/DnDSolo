import { sameName } from "./names";
import type { GameState, Moment } from "./types";

/** What a turn changed that the campaign's timeline remembers: quests
    taken on or closed, a level gained, the character's death. Computed by
    code from the two states, never sent by the model. */
export function momentsOf(prev: GameState, next: GameState): Moment[] {
  const moments: Moment[] = [];
  for (const quest of next.quests) {
    const before = prev.quests.find((q) => sameName(q.title, quest.title));
    if (!before || before.status !== quest.status) {
      moments.push({ kind: "quest", title: quest.title, status: quest.status });
    }
  }
  const levelBefore = Math.max(0, ...prev.players.map((p) => p.level));
  const levelAfter = Math.max(0, ...next.players.map((p) => p.level));
  if (levelAfter > levelBefore) moments.push({ kind: "level", level: levelAfter });
  const deadBefore = prev.players.some((p) => p.condition === "dead");
  if (!deadBefore && next.players.some((p) => p.condition === "dead")) moments.push({ kind: "death" });
  return moments;
}
