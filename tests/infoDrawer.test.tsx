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
});
