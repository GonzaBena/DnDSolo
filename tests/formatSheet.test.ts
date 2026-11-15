import { describe, expect, it } from "vitest";
import { buildSheet } from "../src/rules/buildSheet";
import type { CharacterSheet } from "../src/rules";
import { formatSheetMarkdown, formatSheetText } from "../src/rules/formatSheet";
import { fighterChoices, greedyChoices } from "./helpers";
import type { CharacterChoices } from "../src/rules/buildSheet";

function sheetOf(choices: CharacterChoices = fighterChoices()): CharacterSheet {
  const r = buildSheet(choices);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.sheet;
}
const fighter = () => sheetOf();
const story = "Una soldado retirada que busca paz.";

describe("formatSheetText", () => {
  it("contains the key lines", () => {
    const t = formatSheetText(fighter(), "Brisa", story);
    expect(t).toContain("Brisa");
    expect(t).toContain("CA ");
    expect(t).toContain("PG 12");
    expect(t).toContain("Fuerza 17 (+3)");
    expect(t).toContain("Atletismo +5");
    expect(t).toContain(story);
    expect(t.trimEnd().split("\n").at(-1)).toBe("Reglas: SRD 5.2 (CC-BY-4.0)");
  });

  it("never prints +-N and lists all 18 skills", () => {
    const t = formatSheetText(fighter(), "Brisa", story);
    expect(t).not.toMatch(/\+-/);
    expect(t).toContain("Inteligencia 8 (-1)");
    expect(t).toMatch(/Juego de manos [+-]\d/);
    expect(t.match(/^ {2}.+ [+-]\d+/gm)!.length).toBeGreaterThanOrEqual(18);
  });

  it("shows speed in metres with decimal comma", () => {
    const s = fighter();
    expect(formatSheetText({ ...s, speed: 30 }, "A", "")).toContain("Velocidad 9 m");
    expect(formatSheetText({ ...s, speed: 35 }, "A", "")).toContain("Velocidad 10,5 m");
    expect(formatSheetText({ ...s, speed: 25 }, "A", "")).toContain("Velocidad 7,5 m");
  });

  it("shows caster details for a wizard", () => {
    const s = sheetOf(greedyChoices("human", "wizard", "sage", 3));
    const t = formatSheetText(s, "Ilan", "");
    expect(t).toContain(`CD ${s.spellcasting!.saveDc}`);
    expect(t).toContain("Espacios");
    expect(t).toContain("Trucos");
    expect(t).toContain("Libro de conjuros");
  });

  it("shows pact slots for a warlock", () => {
    const s = sheetOf(greedyChoices("human", "warlock", "acolyte", 3));
    expect(formatSheetText(s, "Zed", "")).toContain("Espacios de pacto");
  });
});

describe("formatSheetMarkdown", () => {
  it("starts with the name and has an Atributos section", () => {
    const m = formatSheetMarkdown(fighter(), "Brisa", story);
    expect(m.startsWith("# Brisa")).toBe(true);
    expect(m).toContain("## Atributos");
    expect(m).not.toMatch(/\+-/);
    expect(m.trimEnd().split("\n").at(-1)).toBe("Reglas: SRD 5.2 (CC-BY-4.0)");
  });
});
