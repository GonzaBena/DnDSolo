import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DM_PORTRAIT_URL, PORTRAIT_FOLDERS, PORTRAIT_IDS, portraitUrl, npcNameFromArchetype, describeArchetypes, isMonsterPortrait } from "../src/domain/portraits";

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

describe("DM_PORTRAIT_URL", () => {
  it("points at an image in public/portraits", () => {
    expect(existsSync(join(ROOT, "..", DM_PORTRAIT_URL))).toBe(true);
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
    expect(portraitUrl("troll-male", "Tobías")).toBeNull();
    expect(portraitUrl("dragon-turtle", "Tobías")).toBeNull();
  });
});

describe("npcNameFromArchetype", () => {
  it("names an archetype in Spanish, with its gender", () => {
    expect(npcNameFromArchetype("innkeeper-male")).toBe("Tabernero");
    expect(npcNameFromArchetype("Innkeeper-Female")).toBe("Tabernera");
    expect(npcNameFromArchetype("elder")).toBe("Anciano");
  });

  it("keeps a trailing number", () => {
    expect(npcNameFromArchetype("goblin-2")).toBe("Goblin 2");
    expect(npcNameFromArchetype("guard_female 3")).toBe("Guardia 3");
  });

  it("leaves real names alone", () => {
    expect(npcNameFromArchetype("Brena")).toBe("Brena");
    expect(npcNameFromArchetype("Goblin 1")).toBe("Goblin 1");
    expect(npcNameFromArchetype("Guardia del portón")).toBe("Guardia del portón");
  });
});

describe("describeArchetypes", () => {
  it("lists every archetype the DM can pick, with who it suits", () => {
    const guide = describeArchetypes();
    for (const id of PORTRAIT_IDS) expect(guide).toContain(`"${id}"`);
    for (const line of guide.split("\n")) expect(line).toMatch(/: \S/);
  });

  it("points merchants to the townsfolk faces, not the guards", () => {
    const line = describeArchetypes().split("\n").find((l) => l.includes("vendedores"));
    expect(line).toContain('"innkeeper-female"');
    expect(line).not.toContain("guard");
  });
});

describe("isMonsterPortrait", () => {
  it("creatures are monsters; people and missing portraits are not", () => {
    for (const id of ["goblin", "kobold", "wolf", "skeleton", "zombie", "drowned", "dragon"]) {
      expect(isMonsterPortrait(id)).toBe(true);
    }
    expect(isMonsterPortrait("orc-male")).toBe(false);
    expect(isMonsterPortrait("hooded")).toBe(false);
    expect(isMonsterPortrait(null)).toBe(false);
  });
});
