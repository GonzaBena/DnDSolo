import { describe, expect, it } from "vitest";
import type { Arrival, Chapter, GameState, Quest, Turn } from "../src/domain/types";
import { advanceBanners, enqueueBanners, questBanners, turnBanners, type QueuedBanner } from "../src/game/bannerQueue";
import { newGame } from "./helpers";

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
  const chapter: QueuedBanner = { id: 1, kind: "chapter", chapter: crypt };
  const ambush: QueuedBanner = { id: 2, kind: "ambush", hostiles: [goblin] };

  it("starts a queue, or appends behind the banner showing", () => {
    expect(enqueueBanners(null, [chapter])).toEqual([chapter]);
    expect(enqueueBanners([chapter], [ambush])).toEqual([chapter, ambush]);
    expect(enqueueBanners(null, [])).toBeNull();
  });

  it("the head leaving shows the next, then clears", () => {
    const next = advanceBanners([chapter, ambush], 1);
    expect(next).toEqual([ambush]);
    expect(advanceBanners(next, 2)).toBeNull();
  });

  it("a late exit of an older banner changes nothing", () => {
    const current = [ambush];
    expect(advanceBanners(current, 1)).toBe(current);
  });

  it("running the same update twice gives the same queue (React may replay it)", () => {
    const current = [chapter, ambush];
    expect(advanceBanners(current, 1)).toEqual(advanceBanners(current, 1));
    expect(enqueueBanners(current, [ambush])).toEqual(enqueueBanners(current, [ambush]));
  });
});

describe("questBanners", () => {
  const quest = (title: string, status: Quest["status"]): Quest => ({ title, description: "", status });
  const withQuests = (quests: Quest[]): GameState => ({ ...newGame(), quests });

  it("a quest completed or failed this turn raises its banner", () => {
    const prev = withQuests([quest("Ruta", "active"), quest("Faro", "active")]);
    const next = withQuests([quest(" ruta ", "completed"), quest("Faro", "failed")]);
    expect(questBanners(prev, next)).toEqual([
      { kind: "quest", outcome: "completed", title: " ruta " },
      { kind: "quest", outcome: "failed", title: "Faro" },
    ]);
  });

  it("an already closed quest raises nothing again", () => {
    const s = withQuests([quest("Ruta", "completed")]);
    expect(questBanners(s, s)).toEqual([]);
  });

  it("a new active quest raises no banner", () => {
    expect(questBanners(withQuests([]), withQuests([quest("Nueva", "active")]))).toEqual([]);
  });
});

