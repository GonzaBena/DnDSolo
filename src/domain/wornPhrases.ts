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

/** Rules talk the DM has to repeat to ask for a roll ("tirá 1d20 + tu modificador"). */
const MECHANICS = new Set(
  "tirá tira tirada tiradas tirar tirás hacé dado dados modificador modificadores salvación cd ventaja desventaja iniciativa pg".split(" "),
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

/** Words for what is in the scene or carried: naming the waterfall or the
    studded leather again is describing, not a tic. */
function sceneWords(state: GameState): Set<string> {
  const texts = [
    state.location.description,
    ...state.npcs.filter((n) => n.present).map((n) => n.description),
    ...state.storyItems.map((i) => `${i.name} ${i.description}`),
    ...state.players.flatMap((p) => [
      ...p.inventory.map((i) => i.name),
      ...(p.stats?.attacks.map((a) => a.name) ?? []),
    ]),
  ];
  return new Set(texts.flatMap(words).filter((w) => !STOPWORDS.has(w)));
}

/** Every phrase of 3 to 6 words in a text, once each. */
function phrasesOf(text: string, names: Set<string>, scene: Set<string>): Set<string> {
  const found = new Set<string>();
  // Per sentence, so a phrase never spans two of them.
  for (const sentence of text.split(/[.!?;:…—\n]+/)) {
    const tokens = words(sentence);
    for (let n = MIN_WORDS; n <= MAX_WORDS; n += 1) {
      for (let i = 0; i + n <= tokens.length; i += 1) {
        const slice = tokens.slice(i, i + n);
        // A lone letter is what is left of dice notation ("1d20" -> "d").
        if (slice.some((w) => names.has(w) || MECHANICS.has(w) || w.length === 1)) continue;
        const content = slice.filter((w) => !STOPWORDS.has(w));
        // Mostly naming what is there ("la armadura de cuero tachonado cruje").
        if (content.length < 2 || content.filter((w) => scene.has(w)).length * 2 > content.length) continue;
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
  const scene = sceneWords(state);
  const turns: Turn[] = state.turns.slice(-WINDOW);
  const counts = new Map<string, number>();
  for (const turn of turns) {
    for (const phrase of phrasesOf(narratorText(turn.narration), names, scene)) {
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  const worn = [...counts].filter(([, count]) => count >= MIN_TURNS);
  // A phrase inside a longer one that is just as worn is the same habit: keep the longer.
  const kept = worn.filter(
    ([phrase, count]) =>
      !worn.some(([other, otherCount]) => other !== phrase && otherCount >= count && ` ${other} `.includes(` ${phrase} `)),
  );
  const score = ([phrase, count]: [string, number]) => count * phrase.split(" ").length;
  // Most worn first, and one entry per habit: a phrase that overlaps one
  // already chosen ("la cascada" / "de la cascada") is left out.
  const chosen: string[] = [];
  for (const [phrase] of kept.sort((a, b) => score(b) - score(a))) {
    if (chosen.some((c) => overlaps(c, phrase))) continue;
    chosen.push(phrase);
    if (chosen.length === limit) break;
  }
  return chosen;
}

/** Whether two phrases share two words in a row, not both filler ("de la"). */
function overlaps(a: string, b: string): boolean {
  const pairs = (text: string) => {
    const tokens = text.split(" ");
    return new Set(
      tokens
        .slice(1)
        .map((w, i) => [tokens[i]!, w] as const)
        .filter(([x, y]) => !STOPWORDS.has(x) || !STOPWORDS.has(y))
        .map(([x, y]) => `${x} ${y}`),
    );
  };
  const first = pairs(a);
  return [...pairs(b)].some((pair) => first.has(pair));
}
