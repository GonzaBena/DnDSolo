import type { ClassData, LevelRow, SkillId } from "../../types";
import { ASI_TRAIT, SOURCE, level4FeatChoice, skillOptions, subclassTrait } from "./common";

const SCHOLAR_SKILLS: SkillId[] = ["arcana", "history", "investigation", "medicine", "nature", "religion"];

// Cantrips, prepared spells and slots from the SRD table "Rasgos de mago". The spellbook contents are picked in the spell task.
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: {}, cantrips: 3, preparedSpells: 4, slots: [2],
    features: [
      {
        name: "Lanzamiento de conjuros",
        summary: "Lanzás conjuros de mago con Inteligencia como aptitud mágica; un canalizador arcano sirve de canalizador. Conocés 3 trucos, llevás un libro de conjuros y preparás conjuros de nivel 1 y superiores de él; recuperás los espacios en descanso largo.",
      },
      {
        name: "Adepto en rituales",
        summary: "Podés lanzar como ritual cualquier conjuro de mago de tu libro con la etiqueta ritual, sin tenerlo preparado, leyéndolo del libro.",
      },
      {
        name: "Recuperación arcana",
        summary: "Tras un descanso corto recuperás espacios de conjuro gastados cuya suma de niveles sea como máximo la mitad de tu nivel de mago (redondeando hacia arriba), ninguno de nivel 6 o más. Una vez por descanso largo.",
      },
    ],
    choices: [],
  },
  {
    level: 2, proficiencyBonus: 2, resources: {}, cantrips: 3, preparedSpells: 5, slots: [3],
    features: [
      {
        name: "Académico",
        summary: "Elegís una habilidad en la que seas competente entre Conocimiento arcano, Historia, Investigación, Medicina, Naturaleza o Religión y ganás pericia en ella.",
      },
    ],
    choices: [
      { id: "class.wizard.scholar", label: "Académico", count: 1, options: skillOptions(SCHOLAR_SKILLS) },
    ],
  },
  {
    level: 3, proficiencyBonus: 2, resources: {}, cantrips: 3, preparedSpells: 6, slots: [4, 2],
    features: [subclassTrait("mago", "Evocador")],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: {}, cantrips: 4, preparedSpells: 7, slots: [4, 3],
    features: [ASI_TRAIT],
    choices: [level4FeatChoice("wizard")],
  },
];

export const WIZARD: ClassData = {
  id: "wizard", name: "Mago", source: SOURCE,
  hitDie: 6, primaryAbility: ["int"], saves: ["int", "wis"],
  skillChoice: { count: 2, options: ["arcana", "history", "insight", "investigation", "medicine", "nature", "religion"] },
  armor: [],
  weapons: ["Armas sencillas"],
  tools: [],
  weaponMasteryCount: 0,
  equipment: {
    A: {
      items: [
        "dagger", "dagger", "quarterstaff", "text:Canalizador arcano (bastón)", "text:Túnica", "text:Libro de conjuros",
        "text:Paquete de erudito",
      ],
      gold: 5,
    },
    B: { items: [], gold: 55 },
    C: undefined,
  },
  spellcasting: { ability: "int", spellList: "wizard" },
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "evoker", name: "Evocador", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Experto en evocación",
          summary: "Añadís gratis a tu libro de conjuros dos conjuros de mago de evocación de nivel 2 o inferior, y uno más de evocación cada vez que accedés a un nuevo nivel de espacios de conjuro.",
        },
      },
      {
        level: 3,
        feature: {
          name: "Truco potente",
          summary: "Cuando lanzás un truco que causa daño y la criatura supera la salvación o fallás el ataque, el objetivo sufre la mitad del daño, sin ningún otro efecto adicional.",
        },
      },
    ],
  },
};
