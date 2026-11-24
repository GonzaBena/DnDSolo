// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TurnInput } from "../src/domain/types";

const play = vi.fn();
vi.mock("../src/audio/sound", () => ({ play: (...args: unknown[]) => play(...args) }));
const { InputEntry } = await import("../src/game/TurnLog");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(input: TurnInput, animated: boolean) {
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<InputEntry input={input} players={[]} animated={animated} />));
  root.unmount();
}

const enemy: TurnInput = {
  type: "enemy_rolls",
  results: [{ die: "d20", count: 1, modifier: 0, mode: "normal", values: [12], total: 12, reason: "Ataque" }],
} as TurnInput;
const death: TurnInput = { type: "death_save", natural: 8 } as TurnInput;

afterEach(() => play.mockClear());

describe("roll card sound", () => {
  it("an enemy roll arriving live rolls the dice", () => {
    render(enemy, true);
    expect(play).toHaveBeenCalledWith("dice", 1);
  });

  it("the player's own roll sounds softer", () => {
    render(death, true);
    expect(play).toHaveBeenCalledWith("dice", 0.5);
  });

  it("rolls in the history stay quiet", () => {
    render(enemy, false);
    render(death, false);
    expect(play).not.toHaveBeenCalled();
  });
});
