import { describe, expect, it } from "vitest";
import { HANDOFF_KEY, readCampaignId, stashCampaignId, stashCharacter, takeCharacter } from "../src/character/handoff";
import { fighterChoices } from "./helpers";
import type { CharacterInput } from "../src/domain/character";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

const VALUES: CharacterInput = {
  name: "Brisa",
  speciesId: "human",
  classId: "fighter",
  subclassId: null,
  srdBackgroundId: "soldier",
  level: 1,
  background: "Una soldado retirada.",
};

describe("character handoff", () => {
  it("returns the stashed values once and then clears them", () => {
    const storage = memoryStorage();
    expect(stashCharacter(storage, VALUES)).toBe(true);
    expect(takeCharacter(storage)).toEqual(VALUES);
    expect(takeCharacter(storage)).toBeNull();
  });

  it("carries the outside-SRD note", () => {
    const storage = memoryStorage();
    stashCharacter(storage, { ...VALUES, outsideSrdNote: "Trasfondo Ermitaño." });
    expect(takeCharacter(storage)?.outsideSrdNote).toBe("Trasfondo Ermitaño.");
  });

  it("carries stats and the starting inventory", () => {
    const storage = memoryStorage();
    const full: CharacterInput = {
      ...VALUES,
      stats: { maxHp: 12, armorClass: 16, initiative: 1, speed: 9, hitDice: "1d10", attacks: [{ name: "Espada", attackBonus: 5, damage: "1d8+3" }], spellSaveDc: null, spellAttackBonus: null },
      startingInventory: [{ name: "Espada larga", quantity: 1 }],
      choices: fighterChoices(),
    };
    stashCharacter(storage, full);
    expect(takeCharacter(storage)).toEqual(full);
  });

  it("drops values with malformed stats", () => {
    const storage = memoryStorage();
    storage.setItem(HANDOFF_KEY, JSON.stringify({ ...VALUES, stats: { maxHp: "mucho" } }));
    expect(takeCharacter(storage)).toBeNull();
  });

  it("drops values with malformed choices", () => {
    const storage = memoryStorage();
    storage.setItem(HANDOFF_KEY, JSON.stringify({ ...VALUES, choices: { speciesId: "human" } }));
    expect(takeCharacter(storage)).toBeNull();
  });

  it("returns null when nothing was stashed", () => {
    expect(takeCharacter(memoryStorage())).toBeNull();
  });

  it("drops values with an unknown class or broken JSON", () => {
    const storage = memoryStorage();
    storage.setItem(HANDOFF_KEY, JSON.stringify({ ...VALUES, classId: "gunslinger" }));
    expect(takeCharacter(storage)).toBeNull();
    storage.setItem(HANDOFF_KEY, "{not json");
    expect(takeCharacter(storage)).toBeNull();
    expect(storage.data.has(HANDOFF_KEY)).toBe(false);
  });

  it("reports blocked storage instead of throwing", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(stashCharacter(blocked, VALUES)).toBe(false);
    expect(takeCharacter(blocked)).toBeNull();
  });

  it("remembers and validates the selected official campaign id", () => {
    const storage = memoryStorage();
    expect(readCampaignId(storage)).toBeNull();
    expect(stashCampaignId(storage, "campana-faro-hundido")).toBe(true);
    expect(readCampaignId(storage)).toBe("campana-faro-hundido");

    expect(stashCampaignId(storage, null)).toBe(true);
    expect(readCampaignId(storage)).toBeNull();

    // Unknown campaign id is ignored and cleared
    expect(stashCampaignId(storage, "campana-falsa")).toBe(true);
    expect(readCampaignId(storage)).toBeNull();
  });
});
