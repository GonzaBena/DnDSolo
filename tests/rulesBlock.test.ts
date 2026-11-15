import { describe, expect, it } from "vitest";
import type { Character } from "../src/domain/types";
import { describeCharacterRules } from "../src/engine/rulesBlock";
import { buildTurnPrompt } from "../src/engine/dmPrompt";
import { newGame } from "./helpers";

function hero(overrides: Partial<Character>): Character {
  return {
    id: "p1", name: "Hero", race: "Humano", characterClass: "Guerrero",
    speciesId: "human", classId: "fighter", subclassId: null, srdBackgroundId: null,
    level: 2, background: null, inventory: [], ...overrides,
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
    expect(block).toContain("subclase");
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

describe("buildTurnPrompt", () => {
  it("includes the rules block after the state", () => {
    const prompt = buildTurnPrompt(newGame(), { type: "start" }, 6);
    expect(prompt).toContain("REGLAS DE LOS PERSONAJES");
    expect(prompt.indexOf("ESTADO")).toBeLessThan(prompt.indexOf("REGLAS DE LOS PERSONAJES"));
    expect(prompt.indexOf("REGLAS DE LOS PERSONAJES")).toBeLessThan(prompt.indexOf("RESUMEN"));
  });
});
