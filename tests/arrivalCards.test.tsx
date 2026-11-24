import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Arrival } from "../src/domain/types";
import { ArrivalCards } from "../src/game/ArrivalCards";

const arrival = (name: string, overrides: Partial<Arrival> = {}): Arrival => ({
  name,
  attitude: "hostile",
  portrait: null,
  blurb: "",
  returning: false,
  health: null,
  ...overrides,
});

const mateo = arrival("Mateo", { attitude: "friendly", blurb: "Herrero del pueblo." });

describe("ArrivalCards", () => {
  it("draws one card per group with the count", () => {
    const html = renderToStaticMarkup(
      <ArrivalCards arrivals={[arrival("Goblin 1"), arrival("Goblin 2"), arrival("Goblin 3")]} />,
    );
    expect(html.match(/class="arrival-card"/g)).toHaveLength(1);
    expect(html).toContain("Goblin");
    expect(html).toContain("×3");
    expect(html).toContain("hostil");
  });

  it("says when someone returns and shows a health tag other than Ileso", () => {
    const html = renderToStaticMarkup(
      <ArrivalCards arrivals={[{ ...mateo, returning: true, health: "Malherido" }]} />,
    );
    expect(html).toContain("Vuelve a aparecer");
    expect(html).toContain("Herrero del pueblo.");
    expect(html).toContain("Malherido");
  });

  it("shows no health tag when health is null", () => {
    expect(renderToStaticMarkup(<ArrivalCards arrivals={[mateo]} />)).not.toContain("health-tag");
  });

  it("renders nothing without arrivals", () => {
    expect(renderToStaticMarkup(<ArrivalCards arrivals={[]} />)).toBe("");
  });
});
