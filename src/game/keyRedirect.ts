export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

export interface TargetLike {
  tagName: string;
  isContentEditable?: boolean;
  getAttribute(name: string): string | null;
}

const TEXT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const KEEP_TAGS = new Set(["BUTTON", "A", "SUMMARY", ...TEXT_TAGS]);
const KEEP_ROLES = new Set(["button", "link", "menuitem", "tab", "checkbox"]);

/** Whether keystrokes on this element already go somewhere useful (a text field). */
export function isEditable(
  el: { tagName: string; isContentEditable?: boolean } | null,
): boolean {
  if (!el) return false;
  return el.isContentEditable === true || TEXT_TAGS.has(el.tagName.toUpperCase());
}

/** Whether a keystroke on `target` should be sent to the composer. */
export function shouldRedirectKey(event: KeyLike, target: TargetLike | null): boolean {
  if (event.defaultPrevented) return false;
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (!target) return true;
  if (target.isContentEditable) return false;
  if (KEEP_TAGS.has(target.tagName.toUpperCase())) return false;
  const role = target.getAttribute("role");
  return !(role !== null && KEEP_ROLES.has(role));
}
