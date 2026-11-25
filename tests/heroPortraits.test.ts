import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HERO_PORTRAIT_IDS, genderOf, heroPortraitUrl, heroPortraitsFor, portraitFor, portraitForClass } from "../src/domain/heroPortraits";
import { CLASSES } from "../src/domain/character";

const ROOT = join(__dirname, "..", "public", "heroes");

describe("HERO_PORTRAIT_IDS", () => {
  it("matches the images in public/heroes", () => {
    const onDisk = readdirSync(ROOT).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, ""));
    expect([...HERO_PORTRAIT_IDS].sort()).toEqual(onDisk.sort());
  });

  it("names each image after a class and a gender", () => {
    const classIds = CLASSES.map((c) => c.id);
    for (const id of HERO_PORTRAIT_IDS) {
      const match = /^([a-z]+)-(male|female)$/.exec(id);
      expect(match, id).not.toBeNull();
      expect(classIds, id).toContain(match![1]);
    }
  });
});

describe("heroPortraitsFor", () => {
  it("lists only the class's portraits", () => {
    expect(heroPortraitsFor("fighter")).toEqual(["fighter-male", "fighter-female"]);
  });

  it("is empty without a class", () => {
    expect(heroPortraitsFor(null)).toEqual([]);
    expect(heroPortraitsFor("nope")).toEqual([]);
  });
});

describe("heroPortraitUrl", () => {
  it("points at the image", () => {
    expect(heroPortraitUrl("bard-female")).toBe("/heroes/bard-female.webp");
  });

  it("is null without a portrait or with one that isn't on disk", () => {
    expect(heroPortraitUrl(null)).toBeNull();
    expect(heroPortraitUrl("bard-other")).toBeNull();
  });
});

describe("portraitForClass", () => {
  it("keeps a portrait of the same class", () => {
    expect(portraitForClass("monk-female", "monk")).toBe("monk-female");
  });

  it("drops a portrait of another class, or none", () => {
    expect(portraitForClass("monk-female", "bard")).toBeNull();
    expect(portraitForClass(undefined, "bard")).toBeNull();
    expect(portraitForClass(null, "bard")).toBeNull();
  });
});

describe("genderOf and portraitFor", () => {
  it("reads the gender off a portrait", () => {
    expect(genderOf("bard-female")).toBe("female");
    expect(genderOf("bard-male")).toBe("male");
    expect(genderOf(null)).toBeNull();
  });

  it("finds the other class's bust of the same gender", () => {
    expect(portraitFor("bard", "female")).toBe("bard-female");
  });

  it("is null for a class without that bust, or without a gender", () => {
    expect(portraitFor("warlock", "female")).toBeNull();
    expect(portraitFor("bard", null)).toBeNull();
  });
});
