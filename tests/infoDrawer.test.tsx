import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InfoDrawer } from "../src/game/InfoDrawer";
import { greedyChoices, newGame } from "./helpers";

describe("InfoDrawer", () => {
  it("the chronicle offers the recap and the campaign's page", () => {
    const state = { ...newGame(), id: "a b", turns: [{ number: 1, input: { type: "start" as const }, narration: "Hola.", events: [] }] };
    const html = renderToStaticMarkup(<InfoDrawer state={state} open onClose={() => {}} onOpenRecap={() => {}} />);
    expect(html).toContain("Anteriormente en…");
    expect(html).toContain('href="/campaign?id=a%20b"');
    expect(html).toContain("Ver tu campaña");
  });

  it("while a turn is being played, the campaign link is not offered (leaving would lose the turn)", () => {
    const state = { ...newGame(), id: "a b" };
    const html = renderToStaticMarkup(
      <InfoDrawer state={state} open onClose={() => {}} onOpenRecap={() => {}} turnRunning />,
    );
    expect(html).not.toContain("/campaign?id=");
  });

  it("splits the information into Héroe, Historia and Mundo tabs, Héroe first", () => {
    const html = renderToStaticMarkup(<InfoDrawer state={newGame()} open onClose={() => {}} onOpenRecap={() => {}} />);
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-selected="true"[^>]*>.*?Héroe/);
    // The other panels are in the page, hidden until their tab is picked.
    expect(html.match(/role="tabpanel"[^>]*hidden=""/g)).toHaveLength(2);
  });

  it("marks carried story items in the inventory", () => {
    const game = newGame();
    const state = {
      ...game,
      players: [{ ...game.players[0]!, inventory: [{ name: "Llave de bronce", quantity: 1 }] }],
      storyItems: [{ name: "Llave de bronce", description: "Abre el faro.", location: "", status: "taken" as const }],
    };
    const html = renderToStaticMarkup(<InfoDrawer state={state} open onClose={() => {}} onOpenRecap={() => {}} />);
    expect(html).toContain("(objeto de la historia)");
    expect(html).toContain("Abre el faro.");
  });

  describe("Fuera del SRD", () => {
    const withPlayer = (overrides: object) => {
      const game = newGame();
      return { ...game, players: [{ ...game.players[0]!, ...overrides }] };
    };
    const render = (state: ReturnType<typeof newGame>) =>
      renderToStaticMarkup(
        <InfoDrawer state={state} open onClose={() => {}} onOpenRecap={() => {}} onSaveOutsideSrd={async () => {}} />,
      );

    it("shows the note and, past the subclass level, the subclass options", () => {
      // newGame(): a level 3 elf rogue; the SRD rogue subclass is the Thief.
      const html = render(withPlayer({ outsideSrd: { note: "Trasfondo Ermitaño.", subclass: null } }));
      expect(html).toContain("Fuera del SRD");
      expect(html).toContain("Trasfondo Ermitaño.");
      expect(html).toContain("Ladrón (SRD)");
      expect(html).toContain("Otra de tu manual");
    });

    it("offers completing the rules choices when they can be", () => {
      const state = withPlayer({ srdBackgroundId: "criminal" });
      const html = renderToStaticMarkup(
        <InfoDrawer state={state} open onClose={() => {}} onOpenRecap={() => {}} onSaveOutsideSrd={async () => {}} onUpgradeSheet={() => {}} />,
      );
      expect(html).toContain("Completar elecciones");
    });

    it("not when the character already has them", () => {
      const state = withPlayer({ srdBackgroundId: "criminal", choices: greedyChoices("elf", "rogue", "criminal", 3) });
      const html = renderToStaticMarkup(
        <InfoDrawer state={state} open onClose={() => {}} onOpenRecap={() => {}} onSaveOutsideSrd={async () => {}} onUpgradeSheet={() => {}} />,
      );
      expect(html).not.toContain("Completar elecciones");
    });

    it("no subclass options before the subclass level", () =>
      expect(render(withPlayer({ level: 1 }))).not.toContain("Otra de tu manual"));

    it("renders the full read-only character sheet, hit dice, and active conditions when choices exist", () => {
      const state = withPlayer({
        srdBackgroundId: "criminal",
        choices: greedyChoices("elf", "rogue", "criminal", 3),
        activeConditions: ["Envenenado"],
      });
      const html = renderToStaticMarkup(<InfoDrawer state={state} open onClose={() => {}} onOpenRecap={() => {}} />);
      expect(html).toContain("Ver ficha completa");
      expect(html).toContain("Dados de golpe");
      expect(html).toContain("d8 · se gastan en descanso corto");
      expect(html).toContain("3 de 3 disponibles");
      expect(html).toContain("Envenenado");
    });

    it("renders manual hit dice and the inventory's edit toggle when handlers are passed", () => {
      const state = withPlayer({
        inventory: [{ name: "Cuerda", quantity: 1 }],
      });
      const html = renderToStaticMarkup(
        <InfoDrawer
          state={state}
          open
          onClose={() => {}}
          onOpenRecap={() => {}}
          onAdjustHitDice={async () => {}}
          onEditInventory={async () => {}}
        />,
      );
      expect(html).toContain("Gastar dado de golpe");
      expect(html).toContain("Editar");
      expect(html).toContain("Cuerda");
    });
  });
});
