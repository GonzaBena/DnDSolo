import { describe, expect, it } from "vitest";
import { campaignPortrait } from "../src/campaigns";
import { guessPortrait } from "../src/domain/portraitGuess";

describe("guessPortrait", () => {
  it.each([
    ["Tabernera", "", "innkeeper-female"],
    ["Tabernero", "", "innkeeper-male"],
    ["Guardia del portón", "Una mujer alta con lanza.", "guard-female"],
    ["Guardia del portón", "Bigote espeso, cansado.", "guard-male"],
    ["La guardia", "", "guard-female"],
    ["Goblin 2", "Flaco y nervioso.", "goblin"],
    ["Anciano", "", "elder-male"],
    ["Hermano Aldric", "Un monje de túnica gris.", "cleric-male"],
    ["Brena", "Herrera de brazos quemados.", "innkeeper-female"],
    ["Odrina", "Cultista de la marea.", "cultist-female"],
    ["Capitán Ahogado", "", "sailor-male"],
    ["Sargento Vel", "", "soldier-male"],
    ["Los ladrones", "", "thief-male"],
    ["Ermitaño", "", "elder-male"],
    ["Lobo gris", "", "wolf"],
    ["Comerciante", "Una vendedora de especias.", "innkeeper-female"],
  ])("%s / %s → %s", (name, description, expected) => {
    expect(guessPortrait(name, description)).toBe(expected);
  });

  it("gives nothing when no word says what the NPC is", () => {
    expect(guessPortrait("Voz", "Resuena entre las piedras.")).toBeNull();
  });

  it("does not match inside other words", () => {
    // "orca" inside "horca", "mago" inside "estómago".
    expect(guessPortrait("Verdugo", "Junto a la horca, se toca el estómago.")).toBeNull();
  });
});

describe("campaignPortrait", () => {
  it("reads the portrait an official campaign set in its notes, numbered copies too", () => {
    expect(campaignPortrait("campana-faro-hundido", "Capitán Ahogado")).toBe("drowned");
    expect(campaignPortrait("campana-faro-hundido", "Esqueleto de Coral 2")).toBe("skeleton");
    expect(campaignPortrait("campana-faro-hundido", "Nadie")).toBeNull();
    expect(campaignPortrait(null, "Capitán Ahogado")).toBeNull();
  });
});
