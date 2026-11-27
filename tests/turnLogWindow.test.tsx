// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { castOf } from "../src/domain/dialogue";
import { TurnLog } from "../src/game/TurnLog";
import type { Turn } from "../src/domain/types";
import { newGame } from "./helpers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("TurnLog windowing", () => {
  it("shows only the latest 25 turns initially and reveals older turns when requested", () => {
    const game = newGame();
    const turns: Turn[] = Array.from({ length: 30 }, (_, i) => ({
      number: i + 1,
      input: { type: "action", text: `Acción ${i + 1}` },
      narration: `Narración ${i + 1}`,
      events: [],
    }));

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
      root.render(<TurnLog turns={turns} players={game.players} cast={castOf(game)} />);
    });

    expect(container.textContent).not.toContain("Narración 1\n");
    expect(container.textContent).not.toContain("Acción 5");
    expect(container.textContent).toContain("Acción 6");
    expect(container.textContent).toContain("Narración 30");

    const more = container.querySelector<HTMLButtonElement>(".log__more")!;
    expect(more.textContent).toContain("Ver turnos anteriores (5)");

    act(() => more.click());
    expect(container.textContent).toContain("Acción 1");
    expect(container.querySelector(".log__more")).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
