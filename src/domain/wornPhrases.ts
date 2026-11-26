// The DM leans on the same expressions turn after turn ("el aire se vuelve
// denso", "un escalofrío te recorre"). The app spots them in what it already
// narrated and hands the DM a short list to steer away from.
import type { GameState, Turn } from "./types";

/** Only this many of the latest turns count: an old habit already gone doesn't matter. */
const WINDOW = 40;
/** A phrase is worn once it shows up in this many different turns. */
const MIN_TURNS = 3;
const MIN_WORDS = 3;
const MAX_WORDS = 6;

/** Words too common to make a phrase on their own. */
const STOPWORDS = new Set(
  (
    "a al algo ante antes así aun aún bajo cada como con contra cual cuando de del desde donde dos e el él " +
    "ella ellas ellos en entre era es esa ese eso esta está este esto ha hace hacia hasta hay la las le les " +
    "lo los más me mi mientras muy nada ni no nos o otra otro para pero poco por que qué se sé ser si sí sin " +
    "sobre son su sus también tan te tenés ti todo tras tu tú tus un una uno unos unas vos y ya"
  ).split(" "),
);

/** Lowercase words, accents kept so the DM reads them as it wrote them. */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
}

/** The narrator's own text: NPC lines ([[Nombre]] …) are left out, since an
    NPC repeating their pet phrase is their voice, not a tic. */
function narratorText(narration: string): string {
  return narration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("[["))
    .join("\n");
}

/** Names the story uses on purpose: repeating them is not a tic. */
function storyNames(state: GameState): Set<string> {
  const names = [
    ...state.players.map((p) => p.name),
    ...state.npcs.flatMap((n) => [n.name, ...(n.formerNames ?? [])]),
    state.location.name,
    ...state.storyItems.map((i) => i.name),
    ...state.quests.map((q) => q.title),
  ];
  return new Set(names.flatMap(words).filter((w) => !STOPWORDS.has(w)));
}

/** Every phrase of 3 to 6 words in a text, once each. */
function phrasesOf(text: string, names: Set<string>): Set<string> {
  const found = new Set<string>();
  // Per sentence, so a phrase never spans two of them.
  for (const sentence of text.split(/[.!?;:…—\n]+/)) {
    const tokens = words(sentence);
    for (let n = MIN_WORDS; n <= MAX_WORDS; n += 1) {
      for (let i = 0; i + n <= tokens.length; i += 1) {
        const slice = tokens.slice(i, i + n);
        if (slice.some((w) => names.has(w))) continue;
        const content = slice.filter((w) => !STOPWORDS.has(w));
        if (content.length < 2) continue;
        // A phrase that starts or ends on a filler word is a fragment of another.
        if (STOPWORDS.has(slice[0]!) && STOPWORDS.has(slice[slice.length - 1]!)) continue;
        found.add(slice.join(" "));
      }
    }
  }
  return found;
}

/** The expressions the DM keeps repeating, most worn first. */
export function wornPhrases(state: GameState, limit = 8): string[] {
  const names = storyNames(state);
  const turns: Turn[] = state.turns.slice(-WINDOW);
  const counts = new Map<string, number>();
  for (const turn of turns) {
    for (const phrase of phrasesOf(narratorText(turn.narration), names)) {
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  const worn = [...counts].filter(([, count]) => count >= MIN_TURNS);
  // A phrase inside a longer one that is just as worn is the same habit: keep the longer.
  const kept = worn.filter(
    ([phrase, count]) =>
      !worn.some(([other, otherCount]) => other !== phrase && otherCount >= count && ` ${other} `.includes(` ${phrase} `)),
  );
  return kept
    .sort((a, b) => b[1] * b[0].split(" ").length - a[1] * a[0].split(" ").length)
    .slice(0, limit)
    .map(([phrase]) => phrase);
}
