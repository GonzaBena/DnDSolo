import { describe, expect, it } from "vitest";
import { CLASSES_DATA, LOADED_MAX_LEVEL, SPECIES } from "../src/rules";
import { buildQuickChoices, recommendedBackgroundForClass } from "../src/rules/quickBuild";
import { nonSrdSubclassesFor } from "../src/domain/outsideSrdCatalog";

describe("buildQuickChoices", () => {
  it("builds a valid sheet for every SRD class at levels 1 and 5", () => {
    for (const cls of CLASSES_DATA) {
      for (const level of [1, 5]) {
        const result = buildQuickChoices({
          speciesId: "human",
          classId: cls.id,
          backgroundId: recommendedBackgroundForClass(cls.id),
          level,
        });
        expect(result).not.toBeNull();
        expect(result!.choices.classId).toBe(cls.id);
        expect(result!.sheet.className).toBe(cls.name);
        expect(result!.sheet.level).toBe(level);
        expect(result!.sheet.hitPoints).toBeGreaterThan(0);
      }
    }
  });

  it("builds valid sheets across all species and up to LOADED_MAX_LEVEL", () => {
    for (const species of SPECIES) {
      const result = buildQuickChoices({
        speciesId: species.id,
        classId: "wizard",
        backgroundId: null,
        level: LOADED_MAX_LEVEL,
      });
      expect(result).not.toBeNull();
      expect(result!.choices.backgroundId).toBe("sage");
    }
  });

  it("returns null outside loaded level range", () => {
    expect(buildQuickChoices({ speciesId: "human", classId: "fighter", level: 0 })).toBeNull();
    expect(buildQuickChoices({ speciesId: "human", classId: "fighter", level: LOADED_MAX_LEVEL + 1 })).toBeNull();
  });
});

describe("nonSrdSubclassesFor", () => {
  it("returns official non-SRD subclass names for each SRD class", () => {
    for (const cls of CLASSES_DATA) {
      expect(nonSrdSubclassesFor(cls.id).length).toBeGreaterThan(0);
    }
    expect(nonSrdSubclassesFor(null)).toEqual([]);
  });
});
