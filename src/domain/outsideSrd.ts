import { findClass } from "../rules";
import { OUTSIDE_SRD_PHRASE } from "../rules/generatorPrompt";
import { OUTSIDE_SRD_NOTE_MAX } from "./character";
import { rebuildSheet } from "./sheetProgress";
import type { Character } from "./types";

export type SubclassPick = { kind: "srd" } | { kind: "custom"; name: string };

/** The player reached the class's subclass level and has no subclass of either kind yet. */
export function needsSubclassChoice(player: Character): boolean {
  const cls = findClass(player.classId ?? player.characterClass);
  return (
    cls !== undefined && player.level >= cls.subclass.level && player.subclassId === null && player.outsideSrd.subclass === null
  );
}

/** Sets the SRD subclass or one from the player's manual (a blank name clears it). The sheet is rebuilt only when
    its choices are current; a pending level up rebuilds it afterwards. */
export function applySubclassPick(player: Character, pick: SubclassPick): Character {
  const cls = findClass(player.classId ?? player.characterClass);
  const name = pick.kind === "custom" ? pick.name.trim() : "";
  const custom = name === "" ? null : name;
  const next: Character = {
    ...player,
    subclassId: pick.kind === "srd" && cls ? cls.subclass.id : null,
    outsideSrd: { ...player.outsideSrd, subclass: pick.kind === "custom" ? custom : null },
  };
  const c = player.choices;
  if (!c) return next;
  const { srdSubclass: _drop, ...rest } = c;
  const choices = custom === null ? rest : { ...rest, srdSubclass: false as const };
  return player.level <= c.level ? rebuildSheet(next, choices) : { ...next, choices };
}

/** The Info edit: the note (trimmed, up to 1000 characters) and, when given, the subclass. */
export function setOutsideSrd(player: Character, edit: { note: string; subclass: SubclassPick | null }): Character {
  const withSubclass = edit.subclass ? applySubclassPick(player, edit.subclass) : player;
  return { ...withSubclass, outsideSrd: { ...withSubclass.outsideSrd, note: edit.note.trim().slice(0, OUTSIDE_SRD_NOTE_MAX) } };
}

/** The generator's note without its fixed opening phrase: just what was asked for and what replaced it. */
export function stripOutsideSrdPhrase(note: string | null): string {
  if (!note) return "";
  const text = note.trim();
  return text.startsWith(OUTSIDE_SRD_PHRASE) ? text.slice(OUTSIDE_SRD_PHRASE.length).trim() : text;
}
