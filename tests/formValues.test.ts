import { describe, expect, it } from "vitest";
import { copyText } from "../src/character/clipboard";
import { formValuesFromOption } from "../src/character/formValues";
import { inventoryFromSheet, statsFromSheet } from "../src/domain/stats";
import { buildSheet } from "../src/rules/buildSheet";
import { findClass } from "../src/rules";
import type { GeneratedOption } from "../src/rules/generateOptions";
import { fighterChoices } from "./helpers";
import { OUTSIDE_SRD_PHRASE } from "../src/rules/generatorPrompt";

function optionAt(level: number): GeneratedOption {
  const choices = fighterChoices({ level });
  const built = buildSheet(choices);
  const sheet = built.ok ? built.sheet : (undefined as never);
  return { name: "Brisa", story: "Una soldado retirada.", pitch: "x", outsideSrdNote: null, choices, sheet };
}

describe("formValuesFromOption", () => {
  it("leaves the subclass empty below the subclass level", () => {
    expect(formValuesFromOption(optionAt(1))).toEqual({
      name: "Brisa",
      speciesId: "human",
      classId: "fighter",
      subclassId: null,
      srdBackgroundId: "soldier",
      level: 1,
      background: "Una soldado retirada.",
      stats: statsFromSheet(optionAt(1).sheet),
      startingInventory: inventoryFromSheet(optionAt(1).sheet),
      choices: fighterChoices({ level: 1 }),
      outsideSrdNote: "",
    });
  });

  it("keeps the class subclass from its level on", () => {
    const values = formValuesFromOption(optionAt(3));
    expect(values.subclassId).toBe(findClass("fighter")!.subclass.id);
    expect(values.level).toBe(3);
  });
});

describe("copyText", () => {
  it("falls back without a clipboard", async () => {
    expect(await copyText("hola", undefined)).toBe("fallback");
  });

  it("falls back when writeText rejects", async () => {
    expect(await copyText("hola", { writeText: () => Promise.reject(new Error("no")) })).toBe("fallback");
  });

  it("reports copied when writeText resolves", async () => {
    let written = "";
    const result = await copyText("hola", {
      writeText: async (text) => {
        written = text;
      },
    });
    expect(result).toBe("copied");
    expect(written).toBe("hola");
  });
});

describe("formValuesFromOption: the generator's outside-SRD note", () => {
  it("keeps what was asked and replaced, without the fixed phrase", () =>
    expect(
      formValuesFromOption({ ...optionAt(1), outsideSrdNote: `${OUTSIDE_SRD_PHRASE} Pediste Ermitaño; te di Sabio.` })
        .outsideSrdNote,
    ).toBe("Pediste Ermitaño; te di Sabio."));
});
