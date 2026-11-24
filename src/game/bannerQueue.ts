import { isAmbush } from "../domain/arrivals";
import type { Arrival, Chapter, GameState, Turn } from "../domain/types";

/** A strip that drops from the top for a moment (see TopBanner). */
export type Banner =
  | { kind: "chapter"; chapter: Chapter }
  | { kind: "ambush"; hostiles: Arrival[] }
  | { kind: "quest"; outcome: "completed" | "failed"; title: string };

/** What a live turn raises, in order: getting to a new place, then whoever
    jumps out there. A revisit raises nothing (its separator is enough). */
export function turnBanners(turn: Turn, events: readonly string[]): Banner[] {
  const arrivals = turn.arrivals ?? [];
  const banners: Banner[] = [];
  if (turn.chapter?.firstVisit) banners.push({ kind: "chapter", chapter: turn.chapter });
  if (isAmbush(events, arrivals)) {
    banners.push({ kind: "ambush", hostiles: arrivals.filter((a) => a.attitude === "hostile") });
  }
  return banners;
}

const questKey = (title: string) => title.trim().toLowerCase();

/** A banner for each quest that closed this turn, completed or failed, in
    the order the quests are kept. A new quest raises none (it has a toast). */
export function questBanners(prev: GameState, next: GameState): Banner[] {
  const before = new Map(prev.quests.map((q) => [questKey(q.title), q.status]));
  const banners: Banner[] = [];
  for (const quest of next.quests) {
    if (quest.status === "active" || before.get(questKey(quest.title)) === quest.status) continue;
    banners.push({ kind: "quest", outcome: quest.status, title: quest.title });
  }
  return banners;
}

/** A banner with the id it was given when queued: it keys the element, so
    each banner mounts fresh exactly once. Ids are handed out outside React
    updaters, which must stay pure (React may run them again). */
export type QueuedBanner = Banner & { id: number };

/** Banners waiting their turn; only the first is on screen. */
export type BannerQueue = QueuedBanner[];

/** Adds banners behind the one showing, or starts showing them. */
export function enqueueBanners(current: BannerQueue | null, banners: QueuedBanner[]): BannerQueue | null {
  if (banners.length === 0) return current;
  return [...(current ?? []), ...banners];
}

/** The banner with `leftId` has left: show the next one, or clear. A late
    exit of an older banner changes nothing. */
export function advanceBanners(current: BannerQueue | null, leftId: number): BannerQueue | null {
  if (current?.[0]?.id !== leftId) return current;
  const rest = current.slice(1);
  return rest.length > 0 ? rest : null;
}
