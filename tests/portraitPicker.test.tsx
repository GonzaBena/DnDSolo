import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortraitChooser } from "../src/character/PortraitPicker";
import { InfoDrawer } from "../src/game/InfoDrawer";
import { sceneMembers } from "../src/game/SceneDrawer";
import { newGame } from "./helpers";

const render = (classId: string | null, value: string | null) =>
  renderToStaticMarkup(<PortraitChooser classId={classId} name="Brisa Lane" value={value} onPick={() => {}} />);

describe("PortraitChooser", () => {
  it("offers the class's portraits and the initials", () => {
    const html = render("fighter", null);
    expect(html).toContain("Elegir retrato");
    expect(html).toContain("/heroes/fighter-male.webp");
    expect(html).toContain("/heroes/fighter-female.webp");
    expect(html).not.toContain("/heroes/bard-");
    expect(html).toContain("Iniciales");
  });

  it("marks the picked one and shows it as the face", () => {
    const html = render("fighter", "fighter-female");
    expect(html).toContain("Cambiar retrato");
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*fighter-female/);
  });

  it("is not shown for a class without portraits", () => {
    expect(render(null, null)).toBe("");
  });
});

describe("the player's portrait in the game", () => {
  // newGame(): a level 3 elf rogue.
  const withPortrait = (portrait: string | null) => {
    const game = newGame();
    return { ...game, players: [{ ...game.players[0]!, portrait }] };
  };

  it("the scene shows it instead of the initials", () => {
    const player = sceneMembers(withPortrait("rogue-female"), false).find((m) => m.kind === "player")!;
    expect(player.portraitUrl).toBe("/heroes/rogue-female.webp");
    expect(sceneMembers(withPortrait(null), false).find((m) => m.kind === "player")!.portraitUrl).toBeNull();
  });

  it("Info lets the player change it", () => {
    const html = renderToStaticMarkup(
      <InfoDrawer state={withPortrait(null)} open onClose={() => {}} onOpenRecap={() => {}} onSavePortrait={async () => {}} />,
    );
    expect(html).toContain("/heroes/rogue-male.webp");
  });
});
