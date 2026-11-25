import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Recap } from "../src/domain/recap";
import { RecapContent } from "../src/game/RecapScreen";

const recap = (extra: Partial<Recap> = {}): Recap => ({
  summary: [],
  quests: [],
  place: "Cripta de Vel",
  inCombat: false,
  lastWords: { speaker: null, text: "La puerta cruje." },
  pendingRoll: null,
  dying: false,
  ...extra,
});

describe("RecapContent", () => {
  it("has the title and where you left off", () => {
    const html = renderToStaticMarkup(<RecapContent recap={recap()} />);
    expect(html).toContain("Anteriormente en…");
    expect(html).toContain("Donde quedaste");
    expect(html).toContain("Cripta de Vel");
    expect(html).toContain("La puerta cruje.");
  });

  it("without summary or quests, no empty headings", () => {
    const html = renderToStaticMarkup(<RecapContent recap={recap()} />);
    expect(html).not.toContain("Misiones en curso");
    expect(html).not.toContain("recap__summary");
  });

  it("summary, quests, combat and who spoke last", () => {
    const html = renderToStaticMarkup(
      <RecapContent
        recap={recap({
          summary: ["Llegaste al pueblo."],
          quests: [{ title: "Ruta", description: "Llegar al paso" }],
          inCombat: true,
          lastWords: { speaker: "Orvin", text: "—Vení." },
        })}
      />,
    );
    expect(html).toContain("Llegaste al pueblo.");
    expect(html).toContain("Misiones en curso");
    expect(html).toContain("Ruta");
    expect(html).toContain("en combate");
    expect(html).toContain("Orvin");
  });

  it("a pending roll shows its reason and difficulty", () => {
    const pendingRoll = { die: "d20" as const, count: 1, reason: "Sigilo para pasar", difficulty: 14, mode: "normal" as const };
    const html = renderToStaticMarkup(<RecapContent recap={recap({ pendingRoll })} />);
    expect(html).toContain("Sigilo para pasar");
    expect(html).toContain("CD 14");
  });

  it("dying shows the pending death save", () => {
    expect(renderToStaticMarkup(<RecapContent recap={recap({ dying: true })} />)).toContain("Tirada de muerte pendiente");
  });
});
