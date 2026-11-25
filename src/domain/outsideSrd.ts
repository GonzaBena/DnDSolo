import { findClass } from "../rules";
import { OUTSIDE_SRD_PHRASE } from "../rules/generatorPrompt";
import { OUTSIDE_SRD_NOTE_MAX } from "./character";
import { buildSheet, type CharacterChoices } from "../rules/buildSheet";
import { activeChoices, requiredChoices } from "../rules/choices";
import { applyLevelUp, pendingLevelUp, withSheet } from "./sheetProgress";
import type { Character } from "./types";

export const SUBCLASS_NAME_MAX = 80;

export type SubclassPick = { kind: "srd" } | { kind: "custom"; name: string };

/** The player reached the class's subclass level and has no subclass of either kind yet. */
export function needsSubclassChoice(player: Character): boolean {
  const cls = findClass(player.classId ?? player.characterClass);
  return (
    cls !== undefined && player.level >= cls.subclass.level && player.subclassId === null && player.outsideSrd.subclass === null
  );
}

export type SubclassResult = { ok: true; player: Character } | { ok: false; message: string };

/** Sets the SRD subclass or one from the player's manual and rebuilds the sheet at the level its choices were made
    (also while a level up is pending, so no stale subclass numbers stay). Picks of the SRD subclass's own choices go
    when leaving it. Going back to an SRD subclass that needs picks of its own can't be done here: it is refused and
    nothing changes. */
export function applySubclassPick(player: Character, pick: SubclassPick): SubclassResult {
  const cls = findClass(player.classId ?? player.characterClass);
  const name = pick.kind === "custom" ? pick.name.trim().slice(0, SUBCLASS_NAME_MAX) : "";
  if (pick.kind === "custom" && name === "") return { ok: false, message: "Escribí el nombre de la subclase." };
  const next: Character = {
    ...player,
    subclassId: pick.kind === "srd" && cls ? cls.subclass.id : null,
    outsideSrd: { ...player.outsideSrd, subclass: pick.kind === "custom" ? name : null },
  };
  const c = player.choices;
  if (!c) return { ok: true, player: next };
  const { srdSubclass: _drop, ...rest } = c;
  const concept: CharacterChoices = pick.kind === "custom" ? { ...rest, srdSubclass: false } : rest;
  const active = new Set(activeChoices(requiredChoices(concept), concept.picks).map((s) => s.id));
  const choices = { ...concept, picks: Object.fromEntries(Object.entries(concept.picks).filter(([id]) => active.has(id))) };
  const built = buildSheet(choices);
  if (!built.ok) {
    return {
      ok: false,
      message: `No se puede pasar a ${cls?.subclass.name ?? "esa subclase"} desde acá: pide elecciones propias. ${built.errors
        .map((e) => e.message)
        .join(" ")}`,
    };
  }
  return { ok: true, player: withSheet(next, choices, built.sheet) };
}

/** The Info edit: the note (trimmed, up to 1000 characters) and, when given, the subclass. */
export function setOutsideSrd(player: Character, edit: { note: string; subclass: SubclassPick | null }): SubclassResult {
  const withSubclass = edit.subclass ? applySubclassPick(player, edit.subclass) : { ok: true as const, player };
  if (!withSubclass.ok) return withSubclass;
  const p = withSubclass.player;
  return { ok: true, player: { ...p, outsideSrd: { ...p.outsideSrd, note: edit.note.trim().slice(0, OUTSIDE_SRD_NOTE_MAX) } } };
}

/** The generator's note without its fixed opening phrase: just what was asked for and what replaced it. */
export function stripOutsideSrdPhrase(note: string | null): string {
  if (!note) return "";
  const text = note.trim();
  return text.startsWith(OUTSIDE_SRD_PHRASE) ? text.slice(OUTSIDE_SRD_PHRASE.length).trim() : text;
}

/** "Seguir" on the level-up screen: the subclass (when asked), then the level's picks, then the note. A level up
    whose picks don't build leaves the sheet as it was (the screen doesn't let that happen). */
export function confirmLevelUp(player: Character, picks: Record<string, string[]>, subclass: SubclassPick | null, note: string): Character {
  const picked = subclass ? applySubclassPick(player, subclass) : null;
  // The screen only offers a pick it could stage, so a refusal here keeps the player as is.
  const withSubclass = picked?.ok ? picked.player : player;
  const leveled = pendingLevelUp(withSubclass) ? applyLevelUp(withSubclass, picks) : null;
  const base = leveled?.ok ? leveled.player : withSubclass;
  return { ...base, outsideSrd: { ...base.outsideSrd, note: note.trim().slice(0, OUTSIDE_SRD_NOTE_MAX) } };
}
