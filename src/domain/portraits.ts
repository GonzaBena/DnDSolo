// NPC portraits live in public/portraits/<folder>/<n>.webp. A folder is an
// archetype, with its gender when it has one ("guard-female") or without it
// ("goblin", "soldier"). The DM picks an archetype; the app picks which of
// the folder's images, from the NPC's name, so an NPC keeps the same face.

/** Archetypes the DM picks with a gender. */
const GENDERED = [
  "bandit", "cleric", "cultist", "dwarf", "elder", "elf", "guard",
  "innkeeper", "noble", "orc", "sailor", "soldier", "thief", "wizard",
] as const;

/** Archetypes with no gender to pick. */
const PLAIN = ["child", "dragon", "drowned", "goblin", "hooded", "kobold", "skeleton", "wolf", "zombie"] as const;

type GenderedBase = (typeof GENDERED)[number];
export type PortraitId = `${GenderedBase}-male` | `${GenderedBase}-female` | (typeof PLAIN)[number];

/** Folders in public/portraits and how many images each one has
    (tests/portraits.test.ts checks it against the disk). */
export const PORTRAIT_FOLDERS: Readonly<Record<string, number>> = {
  "bandit-female": 1,
  "bandit-male": 1,
  child: 4,
  "cleric-female": 4,
  "cultist-female": 1,
  "cultist-male": 1,
  dragon: 2,
  drowned: 2,
  "dwarf-male": 3,
  "elder-female": 2,
  "elder-male": 2,
  "elf-female": 3,
  "elf-male": 2,
  goblin: 5,
  "guard-female": 4,
  "guard-male": 4,
  hooded: 1,
  "innkeeper-female": 2,
  "innkeeper-male": 2,
  kobold: 2,
  "noble-female": 2,
  "noble-male": 2,
  "orc-female": 2,
  "orc-male": 2,
  "sailor-female": 1,
  "sailor-male": 1,
  skeleton: 2,
  soldier: 6,
  "thief-female": 2,
  "thief-male": 2,
  "wizard-female": 2,
  "wizard-male": 2,
  wolf: 2,
  zombie: 2,
};

/** The folder an archetype's images come from: its own, or its base's
    without the gender. */
function folderOf(id: string): string | null {
  const base = id.replace(/-(male|female)$/, "");
  for (const folder of [id, base]) if ((PORTRAIT_FOLDERS[folder] ?? 0) > 0) return folder;
  return null;
}

const ALL_IDS: PortraitId[] = [
  ...GENDERED.flatMap((base) => [`${base}-male`, `${base}-female`] as const),
  ...PLAIN,
];

/** What the DM can pick: the archetypes that have images. */
export const PORTRAIT_IDS = ALL_IDS.filter((id) => folderOf(id) !== null) as [PortraitId, ...PortraitId[]];

/** FNV-1a: small, stable across runs and browsers. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The DM's own portrait. */
export const DM_PORTRAIT_URL = "/portraits/dm.webp";

/** The image for an NPC with this archetype, the same one every time for
    the same name; null when the archetype has no images. */
export function portraitUrl(id: string, npcName: string): string | null {
  const folder = folderOf(id);
  if (!folder) return null;
  const count = PORTRAIT_FOLDERS[folder]!;
  const variant = (hash(npcName.trim().toLowerCase()) % count) + 1;
  return `/portraits/${folder}/${variant}.webp`;
}

/** Spanish names for the archetypes, male and female (the same when the
    archetype has no gender). */
const ARCHETYPE_NAMES: Readonly<Record<string, readonly [string, string]>> = {
  bandit: ["Bandido", "Bandida"],
  cleric: ["Sacerdote", "Sacerdotisa"],
  cultist: ["Cultista", "Cultista"],
  dwarf: ["Enano", "Enana"],
  elder: ["Anciano", "Anciana"],
  elf: ["Elfo", "Elfa"],
  guard: ["Guardia", "Guardia"],
  innkeeper: ["Tabernero", "Tabernera"],
  noble: ["Noble", "Noble"],
  orc: ["Orco", "Orca"],
  sailor: ["Marinero", "Marinera"],
  soldier: ["Soldado", "Soldado"],
  thief: ["Ladrón", "Ladrona"],
  wizard: ["Mago", "Maga"],
  child: ["Niño", "Niño"],
  dragon: ["Dragón", "Dragón"],
  drowned: ["Ahogado", "Ahogado"],
  goblin: ["Goblin", "Goblin"],
  hooded: ["Encapuchado", "Encapuchado"],
  kobold: ["Kobold", "Kobold"],
  skeleton: ["Esqueleto", "Esqueleto"],
  wolf: ["Lobo", "Lobo"],
  zombie: ["Zombi", "Zombi"],
};

/** The model sometimes names an NPC after their portrait archetype
    ("innkeeper-male"). Such a name becomes the archetype in Spanish
    ("Tabernero"), keeping a trailing number ("goblin-2" -> "Goblin 2");
    any other name is returned as is. */
export function npcNameFromArchetype(name: string): string {
  const match = /^([a-z]+)(?:[-_ ](male|female))?(?:[-_ ](\d+))?$/.exec(name.trim().toLowerCase());
  const names = match ? ARCHETYPE_NAMES[match[1]!] : undefined;
  if (!match || !names) return name;
  const spanish = names[match[2] === "female" ? 1 : 0];
  return match[3] ? `${spanish} ${match[3]}` : spanish;
}
