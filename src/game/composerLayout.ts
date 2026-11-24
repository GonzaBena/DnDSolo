/** Whether the composer's text takes a row of its own above the buttons
    (like a chat app): once it no longer fits on the one line beside them,
    or has a line break. It stays there until the text is emptied, so it
    doesn't jump back and forth while typing near the edge. */
export function nextExpanded(expanded: boolean, draft: string, overflows: boolean): boolean {
  if (draft.trim() === "") return false;
  return expanded || overflows || draft.includes("\n");
}
