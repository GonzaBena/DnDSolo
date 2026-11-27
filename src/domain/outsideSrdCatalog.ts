/** Names of well-known D&D subclasses outside the SRD 5.2, grouped by class id.
    Offered as quick autocomplete suggestions so players don't have to type them
    from scratch; no copyrighted rule text is included. */
export const NON_SRD_SUBCLASSES: Record<string, readonly string[]> = {
  barbarian: ["Camino del árbol del mundo", "Camino del fanático", "Camino de la magia salvaje", "Camino del tótem"],
  bard: ["Colegio de la danza", "Colegio del glamour", "Colegio de la elocuencia", "Colegio de las espadas"],
  cleric: ["Dominio de la luz", "Dominio de la guerra", "Dominio del engaño", "Dominio de la tempestad"],
  druid: ["Círculo de la luna", "Círculo de las estrellas", "Círculo del mar", "Círculo de las esporas"],
  fighter: ["Maestro de batalla", "Caballero arcano", "Psicocombatiente", "Caballero rúnico"],
  monk: ["Guerrero de la misericordia", "Guerrero de la sombra", "Guerrero de los elementos", "Maestro borracho"],
  paladin: ["Juramento de gloria", "Juramento de venganza", "Juramento de los antiguos", "Juramento de la conquista"],
  ranger: ["Acechador en la penumbra", "Señor de las bestias", "Errante feérico", "Caminante del horizonte"],
  rogue: ["Asesino", "Embaucador arcano", "Cuchilla del alma", "Espadachín"],
  sorcerer: ["Hechicería aberrante", "Hechicería mecánica", "Hechicería salvaje", "Alma divina"],
  warlock: ["Patrón feérico", "Patrón del gran antiguo", "Patrón celestial", "Espada maldita"],
  wizard: ["Ilusionista", "Adivino", "Abjurador", "Cantor de la hoja"],
};

export function nonSrdSubclassesFor(classId: string | null | undefined): readonly string[] {
  if (!classId) return [];
  return NON_SRD_SUBCLASSES[classId] ?? [];
}
