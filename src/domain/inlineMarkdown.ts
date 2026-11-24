// The model sometimes formats its narration with Markdown emphasis
// ("**Brena**", "*susurra*"). Only inline emphasis is parsed: paragraphs
// are already split by domain/dialogue, and anything else stays text.
// It returns plain nodes, never HTML, so nothing the model writes can
// inject markup.

export type InlineNode =
  | string
  | { kind: "strong" | "em"; children: InlineNode[] };

// A delimiter run of 1 to 3 asterisks, its content (not starting or ending
// with a space, so "2 * 3 * 4" stays text) and the same run closing it.
const EMPHASIS = /(\*{1,3})(?=[^\s*])([\s\S]*?[^\s*])\1(?!\*)/;

function wrap(stars: number, children: InlineNode[]): InlineNode {
  if (stars === 3) return { kind: "strong", children: [{ kind: "em", children }] };
  return { kind: stars === 2 ? "strong" : "em", children };
}

/** `streaming` is set while the text is still arriving: an emphasis that
    has opened but not closed yet is shown emphasised to the end instead of
    flashing its asterisks, and a lone trailing "*" (the start of one still
    arriving) is hidden. */
export function parseInline(text: string, streaming = false): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = text;
  while (rest !== "") {
    const match = EMPHASIS.exec(rest);
    if (!match) break;
    if (match.index > 0) nodes.push(rest.slice(0, match.index));
    nodes.push(wrap(match[1]!.length, parseInline(match[2]!)));
    rest = rest.slice(match.index + match[0].length);
  }
  if (rest !== "") nodes.push(...(streaming ? openTail(rest) : [rest]));
  return nodes;
}

/** The unmatched end of a text still arriving. */
function openTail(rest: string): InlineNode[] {
  const open = /(^|\s)(\*{1,3})(?=[^\s*])([^*]*)$/.exec(rest);
  if (open) {
    const before = rest.slice(0, open.index + open[1]!.length);
    return [
      ...(before !== "" ? [before] : []),
      wrap(open[2]!.length, [open[3]!]),
    ];
  }
  const trimmed = rest.replace(/(^|\s)\*{1,3}$/, "$1");
  return trimmed !== "" ? [trimmed] : [];
}
