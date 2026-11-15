import type { Character } from "../domain/types";
import { LOADED_MAX_LEVEL, findClass, findSpecies } from "../rules";
import type { ClassData, LevelRow } from "../rules";

function describeSlots(row: LevelRow): string | null {
  const parts: string[] = [];
  if (row.slots?.some((n) => n > 0)) {
    parts.push(row.slots.map((n, i) => (n > 0 ? `${n} de nivel ${i + 1}` : null)).filter(Boolean).join(", "));
  }
  if (row.pactSlots) parts.push(`${row.pactSlots.count} de pacto (nivel ${row.pactSlots.slotLevel})`);
  return parts.length ? `  Espacios de conjuro: ${parts.join("; ")}` : null;
}

/** One line per feature ("name: summary"), class and subclass, for one level.
    `previewSubclass` lists the unchosen SRD subclass's features under an explicit label. */
function describeLevel(cls: ClassData, subclassChosen: boolean, previewSubclass: boolean, level: number): string[] {
  const row = cls.levels.find((r) => r.level === level);
  if (!row) return [];
  const subclassFeatures = cls.subclass.features.filter((f) => f.level === level).map((f) => f.feature);
  const features = [...row.features, ...(subclassChosen ? subclassFeatures : [])];
  const slots = describeSlots(row);
  return [
    `Nivel ${level} (bonificador de competencia +${row.proficiencyBonus}):`,
    ...features.map((f) => `  ${f.name}: ${f.summary}`),
    ...(slots ? [slots] : []),
    ...(previewSubclass && subclassFeatures.length
      ? [
          `  Si elige la subclase SRD (${cls.subclass.name}, aún no elegida):`,
          ...subclassFeatures.map((f) => `    ${f.name}: ${f.summary}`),
        ]
      : []),
  ];
}

function describeCharacter(c: Character): string {
  const species = findSpecies(c.speciesId ?? c.race);
  const cls = findClass(c.classId ?? c.characterClass);
  const subclassChosen = cls !== undefined && c.subclassId !== null && c.subclassId === cls.subclass.id;
  const missing: string[] = [];
  if (!species) missing.push(`especie "${c.race}"`);
  if (!cls) missing.push(`clase "${c.characterClass}"`);
  if (cls && !subclassChosen && c.level >= cls.subclass.level) {
    missing.push(`subclase no elegida (se obtiene en el nivel ${cls.subclass.level})`);
  }
  if (c.level + 1 > LOADED_MAX_LEVEL) {
    const levels = c.level > LOADED_MAX_LEVEL ? `${c.level} y ${c.level + 1}` : `${c.level + 1}`;
    missing.push(`nivel ${levels} (solo hay datos hasta el nivel ${LOADED_MAX_LEVEL})`);
  }

  const subclassLabel = subclassChosen ? ` (${cls.subclass.name})` : "";
  const lines = [`${c.name} — ${species?.name ?? c.race} ${cls?.name ?? c.characterClass}${subclassLabel} nivel ${c.level}`];
  if (cls) {
    for (const level of [c.level, c.level + 1]) {
      // The SRD has one subclass per class, so even before it is chosen the DM
      // can preview what level-up brings (e.g. a level 2 fighter's Champion).
      const preview = !subclassChosen && c.level < cls.subclass.level && level === cls.subclass.level;
      lines.push(...describeLevel(cls, subclassChosen, preview, level));
    }
  }
  if (species) lines.push(`Rasgos de especie: ${species.traits.map((t) => t.name).join(", ")}`);
  if (missing.length) lines.push(`Sin datos de reglas: ${missing.join("; ")}`);
  return lines.join("\n");
}

/** The real SRD rules for each character's current and next level, so the DM
    answers rules and level-up questions from data. Sent every turn: kept compact. */
export function describeCharacterRules(players: Character[]): string {
  return players.map(describeCharacter).join("\n\n");
}
