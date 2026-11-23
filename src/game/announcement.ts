import { splitDialogue, type Cast } from "../domain/dialogue";

/** A finished turn's narration as one plain sentence run for screen readers:
    the visible log streams in letter by letter, so it is not a live region;
    this text is announced once, when the turn is complete. */
export function announcementOf(narration: string, cast: Cast): string {
  return splitDialogue(narration, cast)
    .map((segment) => {
      const text = segment.paragraphs.map((p) => p.trim()).filter(Boolean).join(" ");
      if (text === "") return "";
      return segment.speaker === null ? text : `${segment.speaker} dice: ${text}`;
    })
    .filter(Boolean)
    .join(" ");
}
