import { isAmbush } from "../domain/arrivals";
import type { Arrival, Chapter, Turn } from "../domain/types";

/** A strip that drops from the top for a moment (see TopBanner). */
export type Banner = { kind: "chapter"; chapter: Chapter } | { kind: "ambush"; hostiles: Arrival[] };

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

/** Banners waiting their turn; only the head is on screen, mounted under
    `key` so each one is a fresh element. */
export interface BannerQueue {
  key: number;
  queue: Banner[];
}

/** Adds banners behind the one showing, or starts showing them under `key`. */
export function enqueueBanners(current: BannerQueue | null, banners: Banner[], key: number): BannerQueue | null {
  if (banners.length === 0) return current;
  return current ? { ...current, queue: [...current.queue, ...banners] } : { key, queue: banners };
}

/** The banner under `leftKey` has left: show the next one under `nextKey`,
    or clear. A late exit of an older banner changes nothing. */
export function advanceBanners(current: BannerQueue | null, leftKey: number, nextKey: number): BannerQueue | null {
  if (current?.key !== leftKey) return current;
  const rest = current.queue.slice(1);
  return rest.length > 0 ? { key: nextKey, queue: rest } : null;
}
