import type { CharacterSheet } from "../rules/types";
import type { CharacterStats, InventoryItem } from "./types";

/** The combat numbers the game keeps track of, copied from a generated sheet. */
export function statsFromSheet(sheet: CharacterSheet): CharacterStats {
  return {
    maxHp: sheet.hitPoints,
    armorClass: sheet.armorClass,
    initiative: sheet.initiative,
    speed: sheet.speed,
    hitDice: sheet.hitDice,
    attacks: sheet.attacks.map(({ name, attackBonus, damage }) => ({ name, attackBonus, damage })),
    spellSaveDc: sheet.spellcasting?.saveDc ?? null,
    spellAttackBonus: sheet.spellcasting?.attackBonus ?? null,
  };
}

/** "Jabalina (8)" -> { name: "Jabalina", quantity: 8 }; gold > 0 adds "Monedas de oro". */
export function inventoryFromSheet(sheet: CharacterSheet): InventoryItem[] {
  const items = sheet.equipment.map((entry): InventoryItem => {
    const match = /^(.*\S)\s*\((\d+)\)$/.exec(entry.trim());
    if (match) return { name: match[1]!, quantity: Math.max(1, Number(match[2])) };
    return { name: entry.trim(), quantity: 1 };
  });
  if (sheet.gold > 0) items.push({ name: "Monedas de oro", quantity: sheet.gold });
  return items;
}

/** Manual form: both numbers or nothing. */
export function statsFromForm(maxHp: number | null, armorClass: number | null): CharacterStats | null {
  if (maxHp === null || armorClass === null) return null;
  return { maxHp, armorClass, initiative: 0, speed: 9, hitDice: "", attacks: [], spellSaveDc: null, spellAttackBonus: null };
}
