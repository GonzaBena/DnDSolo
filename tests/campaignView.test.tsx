import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampaignMissing, CampaignView, tabFromHash, type CampaignTab } from "../src/campaign/CampaignView";
import { OFFICIAL_CAMPAIGNS } from "../src/campaigns";
import type { GameState, Npc, Turn } from "../src/domain/types";
import { newGame } from "./helpers";

const turn = (number: number, extra: Partial<Turn> = {}): Turn => ({
  number,
  input: { type: "action", text: "Sigo" },
  narration: "…",
  events: [],
  ...extra,
});
function npc(name: string, extra: Partial<Npc> = {}): Npc {
  return { name, description: `${name} es alguien. Más.`, attitude: "neutral", present: false, voice: "", portrait: null, hp: null, maxHp: null, seen: true, ...extra };
}
const game = (extra: Partial<GameState> = {}): GameState => ({ ...newGame(), id: "a b", ...extra });
const render = (state: GameState, tab: CampaignTab = "cronica") =>
  renderToStaticMarkup(<CampaignView state={state} tab={tab} />);

describe("CampaignView", () => {
  it("heading: free adventure and the hero", () => {
    const html = render(game());
    const hero = newGame().players[0]!;
    expect(html).toContain("Aventura libre");
    expect(html).toContain(hero.name);
    expect(html).toContain(hero.characterClass);
    expect(html).toContain(`Nivel ${hero.level}`);
  });

  it("heading: an official campaign's title", () => {
    const official = OFFICIAL_CAMPAIGNS[0]!;
    expect(render(game({ campaignId: official.id }))).toContain(official.title);
  });

  it("shows the numbers", () => {
    const html = render(game({ turns: [turn(1, { chapter: { name: "Cripta", description: "", firstVisit: true } }), turn(2)] }));
    expect(html).toMatch(/>2<\/strong>\s*<span>turnos/);
    expect(html).toMatch(/>1<\/strong>\s*<span>lugares visitados/);
  });

  it("chronicle: summary and every timeline entry", () => {
    const html = render(
      game({
        summary: "Llegaste al pueblo.",
        turns: [
          turn(3, {
            chapter: { name: "La Cripta de Vel", description: "", firstVisit: true },
            moments: [
              { kind: "quest", title: "Ruta", status: "completed" },
              { kind: "quest", title: "Sello", status: "active" },
              { kind: "quest", title: "Faro", status: "failed" },
              { kind: "level", level: 4 },
              { kind: "death" },
            ],
          }),
        ],
      }),
    );
    expect(html).toContain("Crónica");
    expect(html).toContain("Llegaste al pueblo.");
    expect(html).toContain("Turno 3");
    expect(html).toContain("Llegaste a La Cripta de Vel");
    expect(html).toContain("Misión cumplida: Ruta");
    expect(html).toContain("Nueva misión: Sello");
    expect(html).toContain("Misión fallida: Faro");
    expect(html).toContain("Subiste a nivel 4");
    expect(html).toContain("Caíste en combate");
  });

  const met = () =>
    game({
      npcs: [
        npc("Orvin", { attitude: "friendly" }),
        npc("Goblin 1", { portrait: "goblin", attitude: "hostile", hp: 0, maxHp: 7 }),
      ],
    });

  it("three tabs, the active one selected, and only its panel shown", () => {
    const html = render(met(), "personajes");
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html).toContain('aria-selected="true" data-tab="personajes"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toContain("Orvin es alguien.");
    expect(html).not.toContain("Llegaste");
    expect(html).not.toContain("Descubriste");
  });

  it("people: blurb, attitude", () => {
    const html = render(met(), "personajes");
    expect(html).toContain("Aliado");
  });

  it("monsters: the album with found and missing kinds", () => {
    const html = render(met(), "monstruos");
    expect(html).toContain("1/7");
    expect(html).toContain("Descubriste 1 de 7");
    expect(html).toContain("Goblin");
    expect(html).toContain("Hostil");
    expect(html).toContain("Derrotado");
    expect(html.match(/\?\?\?/g)).toHaveLength(6);
    expect(html).toContain("Todavía no te cruzaste con esta criatura");
  });

  it("no people met says so", () => {
    expect(render(game({ npcs: [] }), "personajes")).toContain("Todavía no conociste a nadie");
  });

  it("links back to playing, except after death, and always home", () => {
    expect(render(game())).toContain('href="/play?id=a%20b"');
    const dead = game();
    dead.players = dead.players.map((p) => ({ ...p, condition: "dead" }));
    const html = render(dead);
    expect(html).not.toContain("/play?id=");
    expect(html).toContain('href="/"');
  });
});

describe("CampaignMissing", () => {
  it("says so and links home", () => {
    const html = renderToStaticMarkup(<CampaignMissing />);
    expect(html).toContain("No encontramos esa campaña");
    expect(html).toContain('href="/"');
  });
});

describe("tabFromHash", () => {
  it("known tabs, otherwise the chronicle", () => {
    expect(tabFromHash("#monstruos")).toBe("monstruos");
    expect(tabFromHash("#personajes")).toBe("personajes");
    expect(tabFromHash("")).toBe("cronica");
    expect(tabFromHash("#otra")).toBe("cronica");
  });
});
