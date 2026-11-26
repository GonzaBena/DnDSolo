// The DM used to pick each NPC's portrait from a long list in its prompt.
// Now the app reads it from what the NPC is called and how they are
// described: "Tabernera", "Guardia del portón" + "una mujer…", "Goblin 2".
import { PORTRAIT_IDS, type PortraitId } from "./portraits";

type Gender = "male" | "female";
/** An archetype base and, when the word says it, a gender. */
type Hit = { base: string; gender: Gender | null };

/** Words per archetype, without accents. A "-o/-a" pair is written as its
    two forms; a word that doesn't tell the gender is listed once in `any`. */
const WORDS: Record<string, { male?: string[]; female?: string[]; any?: string[] }> = {
  innkeeper: {
    male: ["tabernero", "posadero", "vendedor", "tendero", "artesano", "granjero", "campesino", "cocinero", "sirviente", "criado", "herrero", "panadero", "carnicero", "molinero", "aldeano", "pastor", "cantinero", "mesero", "mozo", "boticario", "curtidor", "buhonero", "pescadero", "leñador", "carpintero", "mercader", "hospedero"],
    female: ["tabernera", "posadera", "vendedora", "tendera", "artesana", "granjera", "campesina", "cocinera", "sirvienta", "criada", "herrera", "panadera", "carnicera", "molinera", "aldeana", "pastora", "cantinera", "mesera", "moza", "boticaria", "curtidora", "buhonera", "pescadera", "costurera", "lavandera", "tejedora", "hospedera"],
    any: ["comerciante", "feriante"],
  },
  guard: {
    male: ["miliciano", "carcelero", "alguacil", "portero"],
    female: ["miliciana", "carcelera"],
    any: ["guardia", "centinela", "vigia", "guardian", "guardiana"],
  },
  soldier: {
    male: ["mercenario", "caballero", "sargento", "teniente", "veterano", "escudero", "comandante"],
    female: ["mercenaria", "veterana", "escudera"],
    any: ["soldado", "capitan de la guardia"],
  },
  bandit: {
    male: ["bandido", "salteador", "maton", "bandolero", "forajido", "saqueador", "rufian"],
    female: ["bandida", "salteadora", "matona", "bandolera", "forajida", "saqueadora"],
    any: ["asaltante", "secuestrador"],
  },
  thief: {
    male: ["ladron", "picaro", "ratero", "estafador"],
    female: ["ladrona", "picara", "ratera", "estafadora"],
    any: ["carterista", "espia", "contrabandista"],
  },
  cleric: {
    male: ["sacerdote", "monje", "acolito", "clerigo", "curandero", "fraile", "sacristan", "abad", "prior", "sanador", "predicador", "obispo", "paladin"],
    female: ["sacerdotisa", "monja", "acolita", "cleriga", "curandera", "abadesa", "priora", "sanadora", "predicadora", "novicia"],
  },
  cultist: {
    male: ["sectario", "fanatico"],
    female: ["sectaria", "fanatica"],
    any: ["cultista"],
  },
  noble: {
    male: ["duque", "conde", "baron", "lord", "alcalde", "magistrado", "funcionario", "consejero", "principe", "rey", "cortesano", "marques", "juez", "emisario", "embajador"],
    female: ["duquesa", "condesa", "baronesa", "lady", "dama", "alcaldesa", "magistrada", "funcionaria", "consejera", "princesa", "reina", "cortesana", "marquesa", "jueza", "emisaria", "embajadora"],
    any: ["noble", "regente", "burgomaestre", "heredero"],
  },
  wizard: {
    male: ["mago", "hechicero", "brujo", "erudito", "archimago", "bibliotecario", "astrologo", "escriba"],
    female: ["maga", "hechicera", "bruja", "erudita", "archimaga", "bibliotecaria", "astrologa"],
    any: ["alquimista", "nigromante", "ocultista"],
  },
  elder: {
    male: ["anciano", "ermitano", "abuelo", "viejo", "sabio"],
    female: ["anciana", "ermitana", "abuela", "vieja", "sabia"],
  },
  sailor: {
    male: ["marinero", "pescador", "capitan", "contramaestre", "grumete", "barquero", "navegante", "timonel", "farero"],
    female: ["marinera", "pescadora", "capitana", "barquera", "farera"],
    any: ["pirata", "corsario"],
  },
  dwarf: { male: ["enano"], female: ["enana"] },
  elf: { male: ["elfo", "semielfo"], female: ["elfa", "semielfa"] },
  orc: { male: ["orco", "semiorco"], female: ["orca", "semiorca"] },
  child: { male: ["nino", "nene", "crio", "huerfano", "pibe"], female: ["nina", "nena", "cria", "huerfana", "piba"] },
  hooded: { male: ["encapuchado", "desconocido", "extrano", "embozado"], female: ["encapuchada", "desconocida", "extrana", "embozada"], any: ["informante", "figura"] },
  goblin: { any: ["goblin", "trasgo"] },
  kobold: { any: ["kobold"] },
  dragon: { any: ["dragon", "draco", "dragona", "wyrm", "dragoncito"] },
  drowned: { any: ["ahogado", "ahogada", "espectro", "aparecido", "fantasma"] },
  skeleton: { any: ["esqueleto", "osamenta"] },
  zombie: { any: ["zombi", "zombie", "muerto viviente", "necrofago"] },
  wolf: { any: ["lobo", "loba", "huargo", "perro", "chacal", "sabueso"] },
};

/** Single words straight to their hit; multi-word phrases are checked apart. */
const WORD_HITS = new Map<string, Hit>();
const PHRASE_HITS: [string, Hit][] = [];
for (const [base, forms] of Object.entries(WORDS)) {
  const add = (word: string, gender: Gender | null) => {
    if (word.includes(" ")) PHRASE_HITS.push([word, { base, gender }]);
    else WORD_HITS.set(word, { base, gender });
  };
  for (const w of forms.male ?? []) add(w, "male");
  for (const w of forms.female ?? []) add(w, "female");
  for (const w of forms.any ?? []) add(w, null);
}

const FEMALE_ARTICLES = new Set(["la", "una", "esta", "esa", "aquella"]);
const MALE_ARTICLES = new Set(["el", "un", "este", "ese", "aquel"]);
const FEMALE_CUES = new Set(["mujer", "muchacha", "chica", "ella", "madre", "hija", "hermana", "esposa", "viuda", "senora", "dama", "jovencita", "matrona"]);
const MALE_CUES = new Set(["hombre", "muchacho", "chico", "padre", "hijo", "hermano", "esposo", "viudo", "senor", "jovencito", "tipo"]);

/** Lowercase words without accents ("Guardia del Portón" -> guardia, del, porton). */
function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** A word's hit, also for its plural ("guardias", "ladrones"). */
function hitOf(word: string): Hit | undefined {
  return WORD_HITS.get(word) ?? WORD_HITS.get(word.replace(/s$/, "")) ?? WORD_HITS.get(word.replace(/es$/, ""));
}

/** The first archetype word in the text, with the word before it. */
function firstHit(tokens: string[]): { hit: Hit; before: string | undefined } | null {
  const joined = ` ${tokens.join(" ")} `;
  let best: { hit: Hit; index: number } | null = null;
  tokens.forEach((token, index) => {
    const hit = hitOf(token);
    if (hit && (!best || index < best.index)) best = { hit, index };
  });
  for (const [phrase, hit] of PHRASE_HITS) {
    const at = joined.indexOf(` ${phrase} `);
    if (at === -1) continue;
    const index = joined.slice(0, at).trim().split(" ").filter(Boolean).length;
    // A phrase beats the single word it starts with ("capitan de la guardia").
    if (!best || index <= best.index) best = { hit, index };
  }
  if (!best) return null;
  const found = best as { hit: Hit; index: number };
  return { hit: found.hit, before: tokens[found.index - 1] };
}

/** The gender the words say, or null when they say nothing. */
function genderFromCues(tokens: string[]): Gender | null {
  for (const token of tokens) {
    if (FEMALE_CUES.has(token)) return "female";
    if (MALE_CUES.has(token)) return "male";
    const hit = hitOf(token);
    if (hit?.gender) return hit.gender;
  }
  return null;
}

/** The portrait archetype for an NPC, from their name first and then their
    description; null when nothing fits (the player then sees initials). */
export function guessPortrait(name: string, description: string): PortraitId | null {
  const nameTokens = words(name);
  const descriptionTokens = words(description);
  const found = firstHit(nameTokens) ?? firstHit(descriptionTokens);
  if (!found) return null;
  const { base } = found.hit;
  if ((PORTRAIT_IDS as readonly string[]).includes(base)) return base as PortraitId;

  let gender = found.hit.gender;
  if (!gender && found.before && FEMALE_ARTICLES.has(found.before)) gender = "female";
  if (!gender && found.before && MALE_ARTICLES.has(found.before)) gender = "male";
  gender ??= genderFromCues(descriptionTokens);
  // A given name that ends in -a ("Brena", "Odrina") is most often a woman's.
  if (!gender) {
    const given = nameTokens.find((t) => !hitOf(t));
    gender = given?.endsWith("a") ? "female" : "male";
  }
  const id = `${base}-${gender}`;
  return (PORTRAIT_IDS as readonly string[]).includes(id) ? (id as PortraitId) : null;
}
