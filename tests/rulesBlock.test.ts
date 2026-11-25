import { describe, expect, it } from "vitest";
import type { Character } from "../src/domain/types";
import { describeCharacterRules } from "../src/engine/rulesBlock";
import { DM_SYSTEM_PROMPT, buildTurnPrompt } from "../src/engine/dmPrompt";
import { newGame } from "./helpers";

function hero(overrides: Partial<Character>): Character {
  return {
    id: "p1", name: "Hero", race: "Humano", characterClass: "Guerrero",
    speciesId: "human", classId: "fighter", subclassId: null, srdBackgroundId: null,
    level: 2, background: null, inventory: [], stats: null, currentHp: null,
    condition: "ok", deathSaves: { successes: 0, failures: 0 }, milestonesSinceLevel: 0, choices: null, ...overrides,
  };
}

describe("describeCharacterRules", () => {
  it("gives a level 2 fighter the level 2 and the next level's features", () => {
    const block = describeCharacterRules([hero({})]);
    expect(block).toContain("Hero — Humano Guerrero nivel 2");
    expect(block).toContain("Acción súbita");
    expect(block).toContain("bonificador de competencia +2");
    // The subclass is not chosen yet at level 2, but level 3 previews the Champion.
    expect(block).toContain("Crítico mejorado");
    const label = block.indexOf('Si elige la subclase SRD (Campeón, id "champion", aún no elegida):');
    expect(label).toBeGreaterThan(-1);
    expect(block.indexOf("Crítico mejorado")).toBeGreaterThan(label);
    expect(block.indexOf("Atleta sobresaliente")).toBeGreaterThan(label);
  });

  it("does not label the subclass features when it is chosen", () => {
    const block = describeCharacterRules([hero({ level: 2, subclassId: "champion" })]);
    expect(block).not.toContain("aún no elegida");
  });

  it("includes the champion features at level 3 with the subclass chosen", () => {
    const block = describeCharacterRules([hero({ level: 2, subclassId: "champion" })]);
    expect(block).toContain("(Campeón)");
    expect(block).toContain("Atleta sobresaliente");
    expect(block).toContain("Crítico mejorado");
  });

  it("flags a missing subclass once the level enables it", () => {
    const block = describeCharacterRules([
      hero({ level: 3, race: "Elfo", speciesId: "elf", characterClass: "Pícaro", classId: "rogue" }),
    ]);
    expect(block).toContain("Sin datos de reglas");
    expect(block).toContain("subclase no elegida");
  });

  it("offers the SRD subclass with its id once its level is reached and it is not chosen", () => {
    const block = describeCharacterRules([
      hero({ level: 3, race: "Elfo", speciesId: "elf", characterClass: "Pícaro", classId: "rogue" }),
    ]);
    const label = block.indexOf('Si elige la subclase SRD (Ladrón, id "thief", aún no elegida):');
    expect(label).toBeGreaterThan(-1);
    expect(block.indexOf("Manos rápidas")).toBeGreaterThan(label);
    const later = describeCharacterRules([hero({ level: 4, characterClass: "Pícaro", classId: "rogue" })]);
    expect(later).toContain('subclase no elegida (se obtiene en el nivel 3; la del SRD es Ladrón, id "thief")');
  });

  it("falls back to labels and flags unknown species", () => {
    const block = describeCharacterRules([
      hero({ race: "Semielfo", speciesId: null, characterClass: "Pícaro", classId: null, level: 4 }),
    ]);
    expect(block).toContain("Sin datos de reglas");
    expect(block).toContain("Semielfo");
    expect(block).toContain("Pícaro");
  });

  it("names the next level as not loaded at the cap", () => {
    const block = describeCharacterRules([hero({ level: 4 })]);
    expect(block).toMatch(/Sin datos de reglas:.*nivel 5/);
  });
});

describe("casters and caps", () => {
  it("lists wizard spell slots for the current and next level", () => {
    const block = describeCharacterRules([hero({ classId: "wizard", characterClass: "Mago", level: 1 })]);
    expect(block).toMatch(/Nivel 1 [^\n]*\n(  [^\n]*\n)*  Espacios de conjuro: 2 de nivel 1/);
    expect(block).toMatch(/Nivel 2 [^\n]*\n(  [^\n]*\n)*  Espacios de conjuro: 3 de nivel 1/);
  });

  it("lists warlock pact slots", () => {
    const block = describeCharacterRules([hero({ classId: "warlock", characterClass: "Brujo", level: 1 })]);
    expect(block).toContain("de pacto (nivel 1)");
  });

  it("flags both levels when above the loaded cap", () => {
    const block = describeCharacterRules([hero({ level: 6 })]);
    expect(block).toContain("nivel 6 y 7");
  });
});

describe("DM_SYSTEM_PROMPT", () => {
  it("tells the DM to send the subclass change with the id from the rules block", () => {
    expect(DM_SYSTEM_PROMPT).toContain('cambio "subclass"');
    expect(DM_SYSTEM_PROMPT).toMatch(/subclass"[^\n]*REGLAS DE LOS PERSONAJES/);
    expect(DM_SYSTEM_PROMPT).toMatch(/subclase que no está en el SRD[^\n]*frase/);
  });
});

describe("buildTurnPrompt", () => {
  it("includes the rules block after the state", () => {
    const prompt = buildTurnPrompt(newGame(), { type: "start" }, 6);
    expect(prompt).toContain("REGLAS DE LOS PERSONAJES");
    expect(prompt.indexOf("ESTADO")).toBeLessThan(prompt.indexOf("REGLAS DE LOS PERSONAJES"));
    expect(prompt.indexOf("REGLAS DE LOS PERSONAJES")).toBeLessThan(prompt.indexOf("RESUMEN"));
  });
});
