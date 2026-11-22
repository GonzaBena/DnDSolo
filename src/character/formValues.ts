import type { CharacterInput } from "../domain/character";
import { inventoryFromSheet, statsFromSheet } from "../domain/stats";
import { findClass } from "../rules";
import type { GeneratedOption } from "../rules/generateOptions";

/** The form's values for a generated option, so "Usar este personaje" fills in the form. */
export function formValuesFromOption(option: GeneratedOption): CharacterInput {
  const { speciesId, classId, backgroundId, level } = option.choices;
  const subclass = findClass(classId)?.subclass;
  return {
    name: option.name,
    speciesId,
    classId,
    subclassId: subclass && level >= subclass.level ? subclass.id : null,
    srdBackgroundId: backgroundId,
    level,
    background: option.story,
    stats: statsFromSheet(option.sheet),
    startingInventory: inventoryFromSheet(option.sheet),
    choices: option.choices,
  };
}
