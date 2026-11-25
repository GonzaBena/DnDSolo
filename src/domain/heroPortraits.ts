// The player's own portrait: optional, one of a few busts per class in
// public/heroes/<classId>-<male|female>.webp. Without one (or with an id
// that isn't on disk any more) the player keeps their initials.

/** Ids of the images in public/heroes (tests/heroPortraits.test.ts checks it against the disk). */
export const HERO_PORTRAIT_IDS: readonly string[] = [
  "barbarian-male",
  "barbarian-female",
  "bard-male",
  "bard-female",
  "cleric-male",
  "cleric-female",
  "druid-male",
  "druid-female",
  "fighter-male",
  "fighter-female",
  "monk-male",
  "monk-female",
  "paladin-male",
  "paladin-female",
  "ranger-male",
  "ranger-female",
  "rogue-male",
  "rogue-female",
  "sorcerer-male",
];

/** The portraits a character of this class can pick, in order. */
export function heroPortraitsFor(classId: string | null): string[] {
  if (!classId) return [];
  return HERO_PORTRAIT_IDS.filter((id) => id.replace(/-(male|female)$/, "") === classId);
}

/** Where a portrait's image lives; null for no portrait or an unknown id. */
export function heroPortraitUrl(id: string | null): string | null {
  return id !== null && HERO_PORTRAIT_IDS.includes(id) ? `/heroes/${id}.webp` : null;
}

/** The portrait kept for a character of this class: the same one when it belongs to the class, none otherwise. */
export function portraitForClass(portrait: string | null | undefined, classId: string | null): string | null {
  return portrait != null && heroPortraitsFor(classId).includes(portrait) ? portrait : null;
}
