import { useEffect, type RefObject } from "react";
import { isEditable, shouldRedirectKey } from "./keyRedirect";

/** Keeps the composer within reach of the keyboard:
    - it takes focus whenever it is the player's turn, unless they are already
      in another field. Skipped on touch screens, where focusing would pop the
      on-screen keyboard over the story;
    - typing anywhere on the page goes into it: focusing it on keydown makes
      the browser deliver that same keystroke to it. */
export function useComposerFocus(inputRef: RefObject<HTMLTextAreaElement | null>, turnReady: boolean) {
  useEffect(() => {
    if (!turnReady || !matchMedia("(pointer: fine)").matches) return;
    if (isEditable(document.activeElement)) return;
    inputRef.current?.focus();
  }, [turnReady, inputRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = inputRef.current;
      if (!el || el.disabled) return;
      if (!shouldRedirectKey(event, event.target as Element | null)) return;
      if (document.querySelector("dialog[open]")) return;
      el.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [inputRef]);
}
