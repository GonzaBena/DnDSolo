/** "fallback" means the caller must show the text so the player copies it by hand. */
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined,
): Promise<"copied" | "fallback"> {
  if (!clipboard) return "fallback";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "fallback";
  }
}
