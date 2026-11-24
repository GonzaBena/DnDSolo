import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChapterStrip } from "../src/game/ChapterBanner";

describe("ChapterStrip", () => {
  it("shows the title and the description, hidden from screen readers", () => {
    const html = renderToStaticMarkup(
      <ChapterStrip chapter={{ name: "La Cripta de Vel", description: "Piedra húmeda.", firstVisit: true }} />,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("—\u00a0La Cripta de Vel\u00a0—");
    expect(html).toContain("Piedra húmeda.");
  });
});
