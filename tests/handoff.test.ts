import { describe, expect, it } from "vitest";
import { HANDOFF_KEY, stashCharacter, takeCharacter } from "../src/character/handoff";
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
});
