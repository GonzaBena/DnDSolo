import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SheetUpgradeBody, UpgradeNotice } from "../src/game/SheetUpgrade";
import { buildSheet } from "../src/rules/buildSheet";
import { greedyChoices } from "./helpers";

const noop = () => {};

describe("UpgradeNotice", () => {
  it("says why, with Cancelar and Actualizar", () => {
    const html = renderToStaticMarkup(<UpgradeNotice onUpgrade={noop} onCancel={noop} />);
    expect(html).toContain(
      "Tu personaje no tiene guardadas sus elecciones de reglas. Completalas para que al subir de nivel se recalculen sus PG y elecciones.",
    );
    expect(html).not.toContain("antigua");
    expect(html).toContain("Cancelar");
    expect(html).toContain("Actualizar");
  });
});

describe("SheetUpgradeBody", () => {
  const choices = greedyChoices("elf", "rogue", "criminal", 3);
  const built = buildSheet(choices);
  if (!built.ok) throw new Error("rogue");

  it("a proposal shows the sheet and the three actions", () => {
    const html = renderToStaticMarkup(
      <SheetUpgradeBody
        name="Vex"
        story="Explorador."
        phase={{ status: "proposal", choices, sheet: built.sheet }}
        onUse={noop}
        onRetry={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain("Vex");
    for (const text of ["Usar esta", "Otra propuesta", "Cancelar"]) expect(html).toContain(text);
  });

  it("while saving, the actions are disabled (no double save)", () => {
    const html = renderToStaticMarkup(
      <SheetUpgradeBody
        name="Vex"
        story=""
        phase={{ status: "proposal", choices, sheet: built.sheet }}
        saving
        onUse={noop}
        onRetry={noop}
        onCancel={noop}
      />,
    );
    expect(html.match(/disabled=""/g)?.length).toBe(3);
  });

  it("a failure shows the reason and lets you ask again", () => {
    const html = renderToStaticMarkup(
      <SheetUpgradeBody
        name="Vex"
        story=""
        phase={{ status: "failed", message: "No se pudo armar a Vex." }}
        onUse={noop}
        onRetry={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain("No se pudo armar a Vex.");
    expect(html).toContain("Otra propuesta");
    expect(html).not.toContain("Usar esta");
  });

  it("while generating, says so", () =>
    expect(
      renderToStaticMarkup(
        <SheetUpgradeBody name="Vex" story="" phase={{ status: "loading" }} onUse={noop} onRetry={noop} onCancel={noop} />,
      ),
    ).toContain("Armando la ficha…"));
});
