/** Puts a picked suggestion in the composer without losing what was typed. */
export function withSuggestion(draft: string, action: string): string {
  if (draft.trim() === "") return action;
  return /\s$/.test(draft) ? `${draft}${action}` : `${draft} ${action}`;
}
