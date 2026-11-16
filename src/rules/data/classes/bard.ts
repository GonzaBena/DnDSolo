import { SKILLS } from "../../types";
import type { ChoiceSpec, ClassData, LevelRow } from "../../types";
import { ASI_TRAIT, INSTRUMENTS, SOURCE, expertiseChoice, level4FeatChoice, skillOptions, subclassTrait } from "./common";

const instrumentsChoice: ChoiceSpec = {
  id: "class.bard.instruments", label: "Instrumentos musicales", count: 3, options: INSTRUMENTS,
};

// Cantrips, prepared spells and slots from the SRD table "Rasgos de bardo". The Bardic Inspiration die is a d6 up to level 4;
// its uses equal the Charisma modifier (minimum 1) and are not stored here.
const die = { "Dado de Inspiración bárdica": 6 };
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: die, cantrips: 2, preparedSpells: 4, slots: [2],
    features: [
      {
        name: "Inspiración bárdica",
        summary: "Como acción adicional, una criatura a 18 m que te vea u oiga recibe un dado de Inspiración bárdica (d6): durante la siguiente hora puede tirarlo y sumarlo a una prueba con d20 que falle. Tenés tantos usos como tu modificador de Carisma (mín. 1) y los recuperás en descanso largo.",
      },
      {
        name: "Lanzamiento de conjuros",
        summary: "Lanzás conjuros de bardo con Carisma como aptitud mágica; un instrumento musical sirve de canalizador. Conocés 2 trucos y preparás conjuros de nivel 1 y superiores; recuperás los espacios en descanso largo.",
      },
    ],
    choices: [instrumentsChoice],
  },
  {
    level: 2, proficiencyBonus: 2, resources: die, cantrips: 2, preparedSpells: 5, slots: [3],
    features: [
      {
        name: "Pericia",
        summary: "Ganás pericia (doble bonificador por competencia) en dos de tus habilidades competentes. Se recomiendan Interpretación y Persuasión.",
      },
      {
        name: "Aprendiz de mucho",
        summary: "Sumás la mitad de tu bonificador por competencia (redondeando hacia abajo) a las pruebas de característica con habilidades en las que no seas competente y que no usen ya tu bonificador.",
      },
    ],
    choices: [expertiseChoice("bard", 2)],
  },
  {
    level: 3, proficiencyBonus: 2, resources: die, cantrips: 2, preparedSpells: 6, slots: [4, 2],
    features: [subclassTrait("bardo", "Colegio del conocimiento")],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: die, cantrips: 3, preparedSpells: 7, slots: [4, 3],
    features: [ASI_TRAIT],
    choices: [level4FeatChoice("bard")],
  },
];

export const BARD: ClassData = {
  id: "bard", name: "Bardo", source: SOURCE,
  hitDie: 8, primaryAbility: ["cha"], saves: ["dex", "cha"],
  skillChoice: { count: 3, options: SKILLS.map((s) => s.id) },
  armor: ["Armaduras ligeras"],
  weapons: ["Armas sencillas"],
  tools: ["Tres instrumentos musicales a elección"],
  weaponMasteryCount: 0,
  equipment: {
    A: {
      items: ["leather_armor", "dagger", "dagger", "text:Instrumento musical a elección", "text:Paquete de artista"],
      gold: 19,
    },
    B: { items: [], gold: 90 },
    C: undefined,
  },
  spellcasting: { ability: "cha", spellList: "bard" },
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "lore", name: "Colegio del conocimiento", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Competencias adicionales",
          summary: "Ganás competencia en tres habilidades a elección.",
        },
        choices: [
          { id: "subclass.lore.bonus_skills", label: "Competencias adicionales", count: 3, options: skillOptions(SKILLS.map((s) => s.id)) },
        ],
      },
      {
        level: 3,
        feature: {
          name: "Palabras cortantes",
          summary: "Como reacción, cuando una criatura a 18 m que veas haga una tirada de daño o tenga éxito en una prueba de característica o tirada de ataque, gastás un uso de Inspiración bárdica y restás el resultado de tu dado a esa tirada.",
        },
      },
    ],
  },
};
