/** The header's settings gear. It is a plain link to /settings; where the
    browser has popovers (Safari 17+, Firefox 125+) a click opens the small
    menu with the sound switch instead. */
export function wireSettingsMenu(
  gear: HTMLAnchorElement,
  menu: HTMLElement,
  supported = Object.prototype.hasOwnProperty.call(HTMLElement.prototype, "popover"),
): void {
  if (!supported) return;
  gear.setAttribute("role", "button");
  gear.setAttribute("aria-haspopup", "true");
  gear.setAttribute("aria-expanded", "false");
  gear.setAttribute("aria-controls", menu.id);
  // Tapping the gear while the menu is open: the outside tap already closed
  // it (light dismiss) before the click, so the click must not reopen it.
  let wasOpen = false;
  gear.addEventListener("pointerdown", () => {
    wasOpen = menu.matches(":popover-open");
  });
  gear.addEventListener("click", (event) => {
    event.preventDefault();
    if (wasOpen) wasOpen = false;
    else menu.togglePopover();
  });
  menu.addEventListener("toggle", (event) => {
    gear.setAttribute("aria-expanded", String((event as ToggleEvent).newState === "open"));
  });
}
