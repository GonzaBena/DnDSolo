// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { wireSettingsMenu } from "../src/layouts/settingsMenu";

function setup() {
  document.body.innerHTML = `
    <a id="gear" href="/settings">⚙</a>
    <div id="menu" popover></div>`;
  return {
    gear: document.querySelector<HTMLAnchorElement>("#gear")!,
    menu: document.querySelector<HTMLElement>("#menu")!,
  };
}

const click = (el: Element) => {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
};

afterEach(() => vi.restoreAllMocks());

describe("wireSettingsMenu", () => {
  it("without popover support the gear stays a link to settings", () => {
    const { gear, menu } = setup();
    wireSettingsMenu(gear, menu, false);
    expect(click(gear).defaultPrevented).toBe(false);
    expect(gear.getAttribute("aria-haspopup")).toBeNull();
  });

  it("with popover support the gear opens the menu instead", () => {
    const { gear, menu } = setup();
    const toggle = vi.fn();
    menu.togglePopover = toggle;
    wireSettingsMenu(gear, menu, true);
    expect(click(gear).defaultPrevented).toBe(true);
    expect(toggle).toHaveBeenCalledOnce();
    expect(gear.getAttribute("role")).toBe("button");
    expect(gear.getAttribute("aria-haspopup")).toBe("true");
  });
});
