import { describe, expect, it } from "vitest";
import type { Arrival, Chapter, Turn } from "../src/domain/types";
import { advanceBanners, enqueueBanners, turnBanners, type Banner } from "../src/game/bannerQueue";

const goblin: Arrival = { name: "Goblin 1", attitude: "hostile", portrait: null, blurb: "", returning: false, health: null };
const crypt: Chapter = { name: "La Cripta de Vel", description: "Piedra húmeda.", firstVisit: true };

const turn = (extra: Partial<Turn>): Turn => ({ number: 2, input: { type: "start" }, narration: "", events: [], ...extra });

describe("turnBanners", () => {
  it("a first visit with an ambush: the chapter first, then the ambush", () => {
    expect(turnBanners(turn({ chapter: crypt, arrivals: [goblin] }), ["combat_start"])).toEqual([
      { kind: "chapter", chapter: crypt },
      { kind: "ambush", hostiles: [goblin] },
    ]);
  });

  it("a revisit raises no chapter banner", () => {
    expect(turnBanners(turn({ chapter: { ...crypt, firstVisit: false } }), [])).toEqual([]);
  });

  it("nothing to show without a chapter or an ambush", () => {
    expect(turnBanners(turn({ arrivals: [goblin] }), [])).toEqual([]);
  });
});

describe("banner queue", () => {
  const chapter: Banner = { kind: "chapter", chapter: crypt };
  const ambush: Banner = { kind: "ambush", hostiles: [goblin] };

  it("starts a queue with the given key, or appends to the one showing", () => {
    expect(enqueueBanners(null, [chapter], 1)).toEqual({ key: 1, queue: [chapter] });
    expect(enqueueBanners({ key: 1, queue: [chapter] }, [ambush], 2)).toEqual({ key: 1, queue: [chapter, ambush] });
  });

  it("the head leaving shows the next under a new key, then clears", () => {
    const next = advanceBanners({ key: 1, queue: [chapter, ambush] }, 1, 2);
    expect(next).toEqual({ key: 2, queue: [ambush] });
    expect(advanceBanners(next, 2, 3)).toBeNull();
  });

  it("a late exit of an older banner changes nothing", () => {
    const current = { key: 2, queue: [ambush] };
    expect(advanceBanners(current, 1, 3)).toBe(current);
  });
});
