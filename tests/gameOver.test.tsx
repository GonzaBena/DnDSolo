import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { castOf } from "../src/domain/dialogue";
import { GameOver } from "../src/game/GameOver";
import { newGame } from "./helpers";

describe("GameOver", () => {
  it("links to the campaign's page", () => {
    const state = { ...newGame(), id: "a b" };
    const html = renderToStaticMarkup(<GameOver state={state} cast={castOf(state)} />);
    expect(html).toContain('href="/campaign?id=a%20b"');
    expect(html).toContain("Ver tu campaña");
  });
});
