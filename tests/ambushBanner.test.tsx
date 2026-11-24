import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { groupArrivals } from "../src/domain/arrivals";
import type { Arrival } from "../src/domain/types";
import { AmbushStrip, bannerSlots } from "../src/game/AmbushBanner";

const arrival = (name: string): Arrival => ({
  name,
  attitude: "hostile",
  portrait: null,
  blurb: "",
  returning: false,
  health: null,
});

const kinds = (n: number) => Array.from({ length: n }, (_, i) => arrival(`Bestia${String.fromCharCode(65 + i)}`));
const groups = (n: number) => groupArrivals(kinds(n));

describe("bannerSlots", () => {
  it("fits up to four groups", () => {
    expect(bannerSlots(groups(4))).toEqual({ shown: groups(4), hidden: 0 });
  });

  it("turns the fourth slot into +N past four", () => {
    expect(bannerSlots(groups(6))).toEqual({ shown: groups(6).slice(0, 3), hidden: 3 });
  });
});

describe("AmbushStrip", () => {
  it("shows the title, grouped counts and the overflow chip", () => {
    const arrivals = [arrival("Goblin 1"), arrival("Goblin 2"), arrival("Goblin 3"), ...kinds(5)];
    const html = renderToStaticMarkup(<AmbushStrip arrivals={arrivals} />);
    expect(html).toContain("¡Emboscada!");
    expect(html).toContain("×3");
    expect(html).toContain("+3");
    expect(html.match(/class="ambush__member"/g)).toHaveLength(3);
  });

  it("is hidden from screen readers, which hear the turn announcement instead", () => {
    expect(renderToStaticMarkup(<AmbushStrip arrivals={[arrival("Goblin 1")]} />)).toMatch(/^<div[^>]*aria-hidden="true"/);
  });
});

