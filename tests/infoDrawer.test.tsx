import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InfoDrawer } from "../src/game/InfoDrawer";
import { newGame } from "./helpers";

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

    it("no subclass options before the subclass level", () =>
      expect(render(withPlayer({ level: 1 }))).not.toContain("Otra de tu manual"));
  });
});
