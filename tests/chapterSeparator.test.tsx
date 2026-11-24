import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChapterSeparator, chapterTitle } from "../src/game/ChapterSeparator";

describe("ChapterSeparator", () => {
  it("a first visit shows the title and the description, hidden from screen readers", () => {
    const html = renderToStaticMarkup(
      <ChapterSeparator chapter={{ name: "La Cripta de Vel", description: "Piedra húmeda.", firstVisit: true }} />,
    );
    expect(html).toContain('data-visit="first"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("—\u00a0La Cripta de Vel\u00a0—");
    expect(html).toMatch(/class="chapter__description"[^>]*>Piedra húmeda\./);
  });

  it("a revisit is a small line with the name only", () => {
    const html = renderToStaticMarkup(
      <ChapterSeparator chapter={{ name: "Taberna", description: "Humo y risas.", firstVisit: false }} />,
    );
    expect(html).toContain('data-visit="again"');
    expect(html).toContain("Taberna");
    expect(html).not.toContain("chapter__description");
  });

  it("a first visit without a description has no description line", () => {
    const html = renderToStaticMarkup(
      <ChapterSeparator chapter={{ name: "Calle", description: " ", firstVisit: true }} />,
    );
    expect(html).not.toContain("chapter__description");
  });
});

describe("chapterTitle", () => {
  it("the dashes stay glued to the name even if it comes with spaces or line breaks around it", () => {
    expect(chapterTitle("  La Cripta de Vel \n")).toBe("—\u00a0La Cripta de Vel\u00a0—");
  });
});
