// @vitest-environment happy-dom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "../src/game/Composer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderComposer(pointer: "fine" | "coarse") {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === `(pointer: ${pointer})` }));
  const container = document.createElement("div");
  document.body.append(container);
  const inputRef = createRef<HTMLTextAreaElement>();
  let draft = "";
  const root = createRoot(container);
  act(() =>
    root.render(
      <Composer
        draft={draft}
        onDraftChange={(update) => (draft = update(draft))}
        inputRef={inputRef}
        canAct
        busy={false}
        rollRequested={false}
        atBottom
        onScrollToBottom={() => {}}
        suggestions={{ actions: ["Sigo las huellas"], visible: true }}
        onSubmit={() => {}}
        onOpenRoll={() => {}}
        onStop={() => {}}
      />,
    ),
  );
  const chip = [...container.querySelectorAll("button")].find((b) => b.textContent === "Sigo las huellas")!;
  act(() => chip.click());
  return { input: inputRef.current!, draft: () => draft, done: () => (root.unmount(), container.remove()) };
}

afterEach(() => vi.unstubAllGlobals());

describe("picking a suggestion", () => {
  it("on a phone it fills the field without opening the keyboard", () => {
    const { input, draft, done } = renderComposer("coarse");
    expect(draft()).toContain("Sigo las huellas");
    expect(document.activeElement).not.toBe(input);
    done();
  });

  it("with a mouse it fills the field and focuses it", () => {
    const { input, done } = renderComposer("fine");
    expect(document.activeElement).toBe(input);
    done();
  });
});
