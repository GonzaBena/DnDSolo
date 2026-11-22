import { describe, expect, it } from "vitest";
import { applyBuildChange, mergeReviewedStats, parseLevel, parseWholeNumber } from "../src/character/buildChange";
import { formValuesFromOption } from "../src/character/formValues";
import { buildSheet } from "../src/rules/buildSheet";
import type { GeneratedOption } from "../src/rules/generateOptions";
import { fighterChoices } from "./helpers";

function optionFrom(choices: ReturnType<typeof fighterChoices>): GeneratedOption {
  const built = buildSheet(choices);
  if (!built.ok) throw new Error("bad choices");
  return { name: "Brisa", story: "x", pitch: "x", outsideSrdNote: null, choices, sheet: built.sheet };
}

const human = formValuesFromOption(optionFrom(fighterChoices()));

describe("applyBuildChange", () => {
  it("rebuilds the stats when the new species builds with the same choices", () => {
    // Dwarves need no species picks, so the human fighter's choices still build.
    const result = applyBuildChange(human, { speciesId: "dwarf" });
    expect(result.review).toBe(false);
    expect(result.values.speciesId).toBe("dwarf");
    expect(result.values.stats).not.toBeNull();
    expect(result.values.stats).not.toEqual(human.stats);
    expect(result.values.choices).toEqual(human.choices);
  });

  it("keeps the previous stats and asks for review when the rebuild fails", () => {
    // Human picks are species-specific: dropping them for another species that needs its own picks fails.
    const result = applyBuildChange(human, { speciesId: "elf" });
    expect(result.review).toBe(true);
    expect(result.values.speciesId).toBe("elf");
    expect(result.values.stats).toEqual(human.stats);
    expect(result.values.startingInventory).toEqual(human.startingInventory);
  });

  it("keeps the previous stats for review when there are no original choices", () => {
    const result = applyBuildChange({ ...human, choices: undefined }, { speciesId: "elf" });
    expect(result.review).toBe(true);
    expect(result.values.stats).toEqual(human.stats);
  });

  it("returns the original stats when going back to the original species", () => {
    const away = applyBuildChange(human, { speciesId: "elf" });
    const back = applyBuildChange(away.values, { speciesId: "human" });
    expect(back.review).toBe(false);
    expect(back.values.stats).toEqual(human.stats);
    expect(back.values.startingInventory).toEqual(human.startingInventory);
  });

  it.each([
    ["class", { classId: "wizard" }],
    ["level", { level: 2 }],
    ["background", { srdBackgroundId: "sage" }],
  ])("drops the generated sheet when the %s changes", (_name, patch) => {
    const result = applyBuildChange(human, patch);
    expect(result.review).toBe(false);
    expect(result.values.stats).toBeNull();
    expect(result.values.startingInventory).toBeUndefined();
    expect(result.values.choices).toBeUndefined();
  });

  it("just applies the change on a manual form", () => {
    const manual = { ...human, stats: undefined, startingInventory: undefined, choices: undefined };
    const result = applyBuildChange(manual, { classId: "wizard" });
    expect(result.values.classId).toBe("wizard");
    expect(result.review).toBe(false);
  });
});

describe("mergeReviewedStats", () => {
  const kept = human.stats!;

  it("replaces PG and CA with the edited numbers and keeps the rest", () => {
    expect(mergeReviewedStats(kept, "30", "17")).toEqual({ ...kept, maxHp: 30, armorClass: 17 });
  });

  it("keeps the previous number when a field is empty, invalid or below 1", () => {
    expect(mergeReviewedStats(kept, "", "abc")).toEqual(kept);
    expect(mergeReviewedStats(kept, "0", "-3")).toEqual(kept);
  });

  it("truncates fractions", () => {
    expect(mergeReviewedStats(kept, "12.9", "15")).toEqual({ ...kept, maxHp: 12, armorClass: 15 });
  });
});

describe("parseLevel", () => {
  it("accepts a whole level from 1 to 20", () => {
    expect(parseLevel("1")).toBe(1);
    expect(parseLevel("20")).toBe(20);
  });

  it("ignores empty, out of range and non-integer text", () => {
    for (const text of ["", " ", "0", "21", "-1", "2.5", "abc"]) expect(parseLevel(text)).toBeNull();
  });
});

describe("parseWholeNumber", () => {
  it("reads whole numbers and rejects empty or invalid text", () => {
    expect(parseWholeNumber("18")).toBe(18);
    expect(parseWholeNumber("18.7")).toBe(18);
    expect(parseWholeNumber("")).toBeNull();
    expect(parseWholeNumber("x")).toBeNull();
  });
});
