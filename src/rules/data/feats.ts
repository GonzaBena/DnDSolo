import { ABILITIES, SKILLS } from "../types";
import type { Ability, ChoiceSpec, FeatData, Option } from "../types";
import { spellOptions } from "./spells";

const SOURCE = "SRD 5.2" as const;

const ABILITY_NAMES: Record<Ability, string> = {
  str: "Fuerza", dex: "Destreza", con: "Constitución", int: "Inteligencia", wis: "Sabiduría", cha: "Carisma",
};

const abilityOptions = (abilities: Ability[] = ABILITIES): Option[] =>
  abilities.map((a) => ({ id: a, name: ABILITY_NAMES[a], summary: ABILITY_NAMES[a] }));

/** Magic Initiate: the spell options come from the spell list, never typed by hand. */
function magicInitiate(list: "cleric" | "druid" | "wizard", listName: string): FeatData {
  const id = `magic_initiate_${list}`;
  return {
    id, name: `Iniciado en la magia (${listName})`, source: SOURCE, category: "origin",
    summary: `Aprendés dos trucos y un conjuro de nivel 1 de la lista de ${listName}. Siempre tenés preparado ese conjuro y podés lanzarlo una vez gratis por descanso largo. Tu aptitud mágica es Inteligencia, Sabiduría o Carisma (a elección).`,
    choices: [
      { id: `feat.${id}.ability`, label: "Aptitud mágica", count: 1, options: abilityOptions(["int", "wis", "cha"]) },
      { id: `feat.${id}.cantrips`, label: "Trucos", count: 2, options: spellOptions(list, 0) },
      { id: `feat.${id}.spell`, label: "Conjuro de nivel 1", count: 1, options: spellOptions(list, 1) },
    ],
  };
}

const skilledSkills: ChoiceSpec = {
  id: "feat.skilled.skills",
  label: "Habilidades",
  count: 3,
  // The SRD also allows tools; this generator only offers skills.
  options: SKILLS.map((s) => ({ id: s.id, name: s.name, summary: `Competencia en ${s.name}.`, skill: s.id })),
};

const fightingStyle = (id: string, name: string, summary: string): FeatData => ({
  id, name, source: SOURCE, category: "fighting_style", summary, choices: [],
});

export const FEATS_DATA: FeatData[] = [
  {
    id: "alert", name: "Alerta", source: SOURCE, category: "origin",
    summary: "Sumás tu bonificador por competencia a la iniciativa y, justo después de tirarla, podés intercambiarla con un aliado dispuesto.",
    choices: [],
    initiativeAddsProficiency: true,
  },
  magicInitiate("cleric", "clérigo"),
  magicInitiate("druid", "druida"),
  magicInitiate("wizard", "mago"),
  {
    id: "savage_attacker", name: "Atacante salvaje", source: SOURCE, category: "origin",
    summary: "Una vez por turno, al acertar con un arma, tirás dos veces los dados de daño y usás el resultado que prefieras.",
    choices: [],
  },
  {
    id: "skilled", name: "Habilidoso", source: SOURCE, category: "origin",
    summary: "Ganás competencia en tres habilidades a elección.",
    choices: [skilledSkills],
  },
  {
    id: "ability_score_improvement", name: "Mejora de característica", source: SOURCE, category: "general",
    summary: "Aumentás una puntuación de característica en 2 o dos en 1 cada una, sin pasar de 20.",
    prerequisite: { minLevel: 4 },
    choices: [
      { id: "feat.asi.abilities", label: "Características", count: 2, allowRepeat: true, options: abilityOptions() },
    ],
  },
  {
    id: "grappler", name: "Apresador", source: SOURCE, category: "general",
    summary: "Aumentás Fuerza o Destreza en 1 (máximo 20). Con un ataque sin armas de la acción de atacar podés dañar y agarrar a la vez (una vez por turno), tenés ventaja contra criaturas que estés agarrando y mover a una de tu tamaño o menor no cuesta movimiento extra.",
    prerequisite: { minLevel: 4, anyAbility: { abilities: ["str", "dex"], min: 13 } },
    choices: [
      { id: "feat.grappler.ability", label: "Característica", count: 1, options: abilityOptions(["str", "dex"]) },
    ],
  },
  fightingStyle("archery", "Tiro con arco", "Bonificador de +2 a las tiradas de ataque con armas a distancia."),
  fightingStyle("defense", "Defensa", "Con armadura ligera, media o pesada puesta, +1 a la clase de armadura."),
  fightingStyle(
    "great_weapon_fighting", "Combate con armas a dos manos",
    "Al tirar daño con un arma cuerpo a cuerpo a dos manos (a dos manos o versátil), podés tratar un 1 o un 2 en un dado de daño como un 3.",
  ),
  fightingStyle(
    "two_weapon_fighting", "Combate con dos armas",
    "En el ataque extra con un arma ligera, sumás tu modificador de característica al daño si no lo sumabas ya.",
  ),
];
