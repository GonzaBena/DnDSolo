// How names are matched: the model rarely repeats a name byte for byte.

/** Same person, item or quest: case and surrounding spaces don't count. */
export const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

const placeKey = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Same place: also ignores repeated spaces and accents ("Cienaga" is
    "Ciénaga"), so a respelled place is neither a move nor a new chapter. */
export const samePlace = (a: string, b: string): boolean => placeKey(a) === placeKey(b);
