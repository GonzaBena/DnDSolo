import { ARMOR } from "./data/equipment";
import type { Ability } from "./types";

export interface AcInput {
  mods: Record<Ability, number>;
  armorId: string | null;
  shield: boolean;
  unarmoredDefense: "barbarian" | "monk" | "draconic" | null;
  defenseStyle: boolean;
}

const SHIELD_BONUS = 2;

/** Armor Class: the highest applicable formula, plus shield and the Defense
    fighting style (which only counts while wearing armor). */
export function armorClass(input: AcInput): number {
  const { mods, armorId, shield, unarmoredDefense, defenseStyle } = input;
  const armor = armorId ? ARMOR.find((a) => a.id === armorId && a.type !== "shield") : undefined;

  const formulas: number[] = [];
  if (armor) {
    if (armor.type === "light") formulas.push(armor.baseAc + mods.dex);
    else if (armor.type === "medium") formulas.push(armor.baseAc + Math.min(mods.dex, 2));
    else formulas.push(armor.baseAc);
  } else {
    formulas.push(10 + mods.dex);
    if (unarmoredDefense === "barbarian") formulas.push(10 + mods.dex + mods.con);
    // The monk's formula does not work while carrying a shield.
    if (unarmoredDefense === "monk" && !shield) formulas.push(10 + mods.dex + mods.wis);
    if (unarmoredDefense === "draconic") formulas.push(10 + mods.dex + mods.cha);
  }

  return Math.max(...formulas) + (shield ? SHIELD_BONUS : 0) + (armor && defenseStyle ? 1 : 0);
}
