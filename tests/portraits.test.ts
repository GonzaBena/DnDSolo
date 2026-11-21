import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PORTRAIT_FOLDERS, PORTRAIT_IDS, portraitUrl } from "../src/domain/portraits";

const ROOT = join(__dirname, "..", "public", "portraits");

describe("PORTRAIT_FOLDERS", () => {
  it("matches the images in public/portraits", () => {
    const onDisk = Object.fromEntries(
      readdirSync(ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((dir) => [dir.name, readdirSync(join(ROOT, dir.name)).filter((f) => f.endsWith(".webp")).length]),
    );
    expect(PORTRAIT_FOLDERS).toEqual(onDisk);
  });

  it("numbers each folder's images from 1", () => {
    for (const [folder, count] of Object.entries(PORTRAIT_FOLDERS)) {
      const files = readdirSync(join(ROOT, folder)).sort();
      expect(files).toEqual(Array.from({ length: count }, (_, i) => `${i + 1}.webp`).sort());
    }
  });
});

describe("PORTRAIT_IDS", () => {
  it("only offers the DM archetypes that have a folder of their own or of their base", () => {
    for (const id of PORTRAIT_IDS) expect(portraitUrl(id, "X"), id).not.toBeNull();
  });
});

describe("portraitUrl", () => {
  it("picks the same image for the same NPC, ignoring case and spaces", () => {
    expect(portraitUrl("guard-female", " Brena ")).toBe(portraitUrl("guard-female", "brena"));
    expect(portraitUrl("guard-female", "Brena")).toMatch(/^\/portraits\/guard-female\/[1-4]\.webp$/);
  });

  it("spreads different NPCs over the variants", () => {
    const urls = new Set(["Ana", "Brena", "Cora", "Dalia", "Eda", "Fina", "Gala", "Hebe"].map((n) => portraitUrl("guard-female", n)));
    expect(urls.size).toBeGreaterThan(1);
  });

  it("falls back to the archetype without gender", () => {
    expect(portraitUrl("soldier-female", "Brena")).toMatch(/^\/portraits\/soldier\/\d\.webp$/);
  });

  it("is null when there is no image for the archetype", () => {
    expect(portraitUrl("cleric-male", "Tobías")).toBeNull();
    expect(portraitUrl("dragon-turtle", "Tobías")).toBeNull();
  });
});
