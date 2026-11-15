const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  '"': '"',
  "\\": "\\",
  "/": "/",
};

/** Reads the `narration` string out of a JSON document that is still being
    streamed, so the player sees text while the rest of the structured
    response is generated. Returns what is safely readable so far and stops
    before any half-received escape sequence. */
export function extractPartialNarration(rawJson: string): string {
  const start = /"narration"\s*:\s*"/.exec(rawJson);
  if (!start) return "";
  let out = "";
  let i = start.index + start[0].length;
  while (i < rawJson.length) {
    const char = rawJson[i]!;
    if (char === '"') break;
    if (char !== "\\") {
      out += char;
      i += 1;
      continue;
    }
    const next = rawJson[i + 1];
    if (next === undefined) break;
    if (next === "u") {
      const hex = rawJson.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 6;
      continue;
    }
    out += ESCAPES[next] ?? next;
    i += 2;
  }
  return out;
}
