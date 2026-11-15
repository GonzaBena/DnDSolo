import type { ClassData, LevelRow } from "../../types";
import { spellOptions } from "../spells";
import { ASI_TRAIT, SOURCE, level4FeatChoice, subclassTrait } from "./common";

// Cantrips, prepared spells, slots and Channel Divinity from the SRD table "Rasgos de clérigo".
// The extra cantrip of the Thaumaturge order is a conditional choice.
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: {}, cantrips: 3, preparedSpells: 4, slots: [2],
    features: [
      {
        name: "Lanzamiento de conjuros",
        summary: "Lanzás conjuros de clérigo con Sabiduría como aptitud mágica; un símbolo sagrado sirve de canalizador. Conocés 3 trucos y preparás conjuros de nivel 1 y superiores; recuperás los espacios en descanso largo.",
      },
      {
        name: "Orden divina",
        summary: "Elegís una función sacra: Protector (competencia con armas marciales y entrenamiento con armaduras pesadas) o Taumaturgo (un truco de clérigo adicional y un bonificador igual a tu modificador de Sabiduría, mín. +1, a las pruebas de Conocimiento arcano y Religión).",
      },
    ],
    choices: [
      {
        id: "class.cleric.divine_order", label: "Orden divina", count: 1,
        options: [
          { id: "protector", name: "Protector", summary: "Competencia con armas marciales y entrenamiento con armaduras pesadas." },
          {
            id: "thaumaturge", name: "Taumaturgo",
            summary: "Un truco adicional de la lista de clérigo y un bonificador a Conocimiento arcano y Religión igual a tu modificador de Sabiduría (mín. +1).",
          },
        ],
      },
      {
        id: "class.cleric.thaumaturge_cantrip", label: "Truco adicional (Taumaturgo)", count: 1,
        options: spellOptions("cleric", 0),
        requires: { choiceId: "class.cleric.divine_order", optionId: "thaumaturge" },
      },
    ],
  },
  {
    level: 2, proficiencyBonus: 2, resources: { "Canalizar divinidad": 2 }, cantrips: 3, preparedSpells: 5, slots: [3],
    features: [
      {
        name: "Canalizar divinidad",
        summary: "Dos usos (recuperás uno en descanso corto y todos en largo). Empezás con Chispa divina (1d8 + Sabiduría: curación a una criatura a 9 m o daño necrótico/radiante con salvación de Constitución) y Expulsar muertos vivientes (salvación de Sabiduría: asustados e incapacitados 1 minuto).",
      },
    ],
    choices: [],
  },
  {
    level: 3, proficiencyBonus: 2, resources: { "Canalizar divinidad": 2 }, cantrips: 3, preparedSpells: 6, slots: [4, 2],
    features: [subclassTrait("clérigo", "Dominio de la vida")],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: { "Canalizar divinidad": 2 }, cantrips: 4, preparedSpells: 7, slots: [4, 3],
    features: [ASI_TRAIT],
    choices: [level4FeatChoice("cleric")],
  },
];

export const CLERIC: ClassData = {
  id: "cleric", name: "Clérigo", source: SOURCE,
  hitDie: 8, primaryAbility: ["wis"], saves: ["wis", "cha"],
  skillChoice: { count: 2, options: ["history", "insight", "medicine", "persuasion", "religion"] },
  armor: ["Armaduras ligeras", "Armaduras medias", "Escudos"],
  weapons: ["Armas sencillas"],
  tools: [],
  weaponMasteryCount: 0,
  equipment: {
    A: { items: ["chain_shirt", "shield", "mace", "text:Símbolo sagrado", "text:Paquete de sacerdote"], gold: 7 },
    B: { items: [], gold: 110 },
    C: undefined,
  },
  spellcasting: { ability: "wis", spellList: "cleric" },
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "life", name: "Dominio de la vida", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Discípulo de la vida",
          summary: "Cuando lanzás con un espacio de conjuro un conjuro que cure puntos de golpe, la criatura recupera además 2 más el nivel del espacio.",
        },
      },
      {
        level: 3,
        feature: {
          name: "Conjuros del dominio de la vida",
          summary: "Siempre tenés preparados auxilio, bendición, curar heridas y restablecimiento menor (nivel 3); palabra de curación en masa y revivir (nivel 5).",
        },
      },
      {
        level: 3,
        feature: {
          name: "Preservar vida",
          summary: "Como acción de magia, gastás un uso de Canalizar divinidad y repartís entre criaturas maltrechas a 9 m (podés incluirte) puntos de golpe iguales a cinco veces tu nivel de clérigo, sin superar la mitad de los puntos de golpe máximos de cada una.",
        },
      },
    ],
  },
};
