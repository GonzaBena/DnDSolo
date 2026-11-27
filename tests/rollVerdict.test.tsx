import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlayerRoll, TurnInput } from "../src/domain/types";
import { InputEntry } from "../src/game/TurnLog";

const action = (roll: PlayerRoll): TurnInput => ({ type: "action", text: "", roll });
const html = (roll: PlayerRoll) => renderToStaticMarkup(<InputEntry input={action(roll)} players={[]} />);
const stealth = (value: number, difficulty?: number): PlayerRoll =>
  ({ die: "d20", count: 1, value, modifier: 3, reason: "Sigilo", ...(difficulty === undefined ? {} : { difficulty }) });

describe("the DC on the player's roll card", () => {
  it("says the total reached it", () => {
    expect(html(stealth(14, 15))).toMatch(/roll-card__verdict--hit[^>]*>Necesitabas 15, sacaste 17 ✓/);
  });

  it("says the total fell short", () => {
    expect(html(stealth(9, 15))).toMatch(/roll-card__verdict--miss[^>]*>Necesitabas 15, sacaste 12 ✗/);
  });

  it("is not shown without a DC", () => {
    expect(html(stealth(14))).not.toContain("Necesitabas");
  });

  it("shows combined damage metadata when present", () => {
    const attack: PlayerRoll = {
      die: "d20",
      count: 1,
      value: 14,
      modifier: 5,
      reason: "Espada larga",
      difficulty: 15,
      damage: { die: "d8", count: 1, value: 6, modifier: 3, reason: "Espada larga" },
    };
    expect(html(attack)).toContain("daño si impacta: 1d8+3 = 9");
  });
});
