import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuestStrip } from "../src/game/QuestBanner";

describe("QuestStrip", () => {
  it("completed: with the seal, hidden from screen readers (the turn announcement says it)", () => {
    const html = renderToStaticMarkup(<QuestStrip outcome="completed" title="Ruta" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="status"');
    expect(html).toContain("Misión cumplida");
    expect(html).toContain("Ruta");
    expect(html).toContain("quest-banner__seal");
    expect(html).not.toContain("quest-banner__flame");
  });

  it("failed: with the flame", () => {
    const html = renderToStaticMarkup(<QuestStrip outcome="failed" title="Ruta" />);
    expect(html).toContain("Misión fallida");
    expect(html).toContain("quest-banner__flame");
    expect(html).not.toContain("quest-banner__seal");
  });
});
