import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChoicePicker, togglePick } from "../src/game/ChoicePicker";
import type { ChoiceSpec } from "../src/rules/types";

const opt = (id: string) => ({ id, name: id.toUpperCase(), summary: `Resumen de ${id}.` });
const asi: ChoiceSpec = { id: "feat.asi.abilities", label: "Características", count: 2, allowRepeat: true, options: ["str", "dex"].map(opt) };
const three: ChoiceSpec = { id: "class.wizard.cantrips", label: "Trucos", count: 3, options: ["a", "b", "c", "d"].map(opt) };

describe("togglePick", () => {
  it("allowRepeat: the same option twice, never past the count", () => {
    expect(togglePick(asi, [], [], "str", 1)).toEqual(["str"]);
    expect(togglePick(asi, ["str"], [], "str", 1)).toEqual(["str", "str"]);
    expect(togglePick(asi, ["str", "str"], [], "dex", 1)).toEqual(["str", "str"]);
    expect(togglePick(asi, ["str", "str"], [], "str", -1)).toEqual(["str"]);
  });

  it("locked picks stay; new ones fill up to the count", () => {
    expect(togglePick(three, ["a", "b"], ["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(togglePick(three, ["a", "b"], ["a", "b"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(togglePick(three, ["a", "b", "c"], ["a", "b"], "d", 1)).toEqual(["a", "b", "c"]);
  });

  it("without allowRepeat, adding a taken option does nothing", () =>
    expect(togglePick(three, ["c"], [], "c", 1)).toEqual(["c"]));
});

describe("ChoicePicker", () => {
  const html = renderToStaticMarkup(
    <ChoicePicker
      specs={[three]}
      picks={{ [three.id]: ["a", "b"] }}
      locked={{ [three.id]: ["a", "b"] }}
      errors={[{ field: `picks.${three.id}`, message: "Falta un truco." }]}
      onChange={() => {}}
    />,
  );

  it("asks for what is missing, with each option's summary", () => {
    expect(html).toContain("Trucos");
    expect(html).toContain("Elegí 1");
    expect(html).toContain("Resumen de c.");
  });

  it("shows locked picks checked and disabled", () => expect(html).toMatch(/checked=""[^>]*disabled=""|disabled=""[^>]*checked=""/));

  it("shows that choice's errors", () => expect(html).toContain("Falta un truco."));
});
