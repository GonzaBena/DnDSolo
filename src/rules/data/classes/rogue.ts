import type { ClassData, LevelRow } from "../../types";
import {
  ASI_TRAIT, SOURCE, expertiseChoice, languageChoice, level4FeatChoice, masteryWeapons, subclassTrait, weaponMasteryChoice,
  weaponMasteryTrait,
} from "./common";

// Sneak Attack dice (d6s) from the SRD table "Rasgos de pícaro".
const sneak = (dice: number) => ({ "Ataque furtivo (d6)": dice });

const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: sneak(1),
    features: [
      {
        name: "Ataque furtivo",
        summary: "Una vez por turno infligís 1d6 de daño adicional a una criatura a la que aciertes con un arma sutil o a distancia si tenés ventaja, o si un aliado no incapacitado está a 1,5 m del objetivo y no tenés desventaja. El daño aumenta con tu nivel.",
      },
      {
        name: "Jerga de ladrones",
        summary: "Conocés la jerga de ladrones y otro idioma a elección.",
      },
      weaponMasteryTrait(2, "armas sencillas o marciales ligeras o sutiles"),
      {
        name: "Pericia",
        summary: "Ganás pericia (doble bonificador por competencia) en dos de tus habilidades competentes. Se recomiendan Juego de manos y Sigilo.",
      },
    ],
    choices: [
      expertiseChoice("rogue", 2),
      weaponMasteryChoice("rogue", 2, masteryWeapons.rogue()),
      languageChoice("class.rogue.language", 1, ["thieves_cant"]),
    ],
  },
  {
    level: 2, proficiencyBonus: 2, resources: sneak(1),
    features: [
      {
        name: "Acción astuta",
        summary: "En tu turno podés usar como acción adicional: correr, destrabarse o esconderse.",
      },
    ],
    choices: [],
  },
  {
    level: 3, proficiencyBonus: 2, resources: sneak(2),
    features: [
      {
        name: "Puntería certera",
        summary: "Como acción adicional te das ventaja en tu siguiente tirada de ataque del turno. Solo si no te moviste este turno; después tu velocidad es 0 hasta el final del turno.",
      },
      subclassTrait("pícaro", "Ladrón"),
    ],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: sneak(2),
    features: [ASI_TRAIT],
    choices: [level4FeatChoice("rogue")],
  },
];

export const ROGUE: ClassData = {
  id: "rogue", name: "Pícaro", source: SOURCE,
  hitDie: 8, primaryAbility: ["dex"], saves: ["dex", "int"],
  skillChoice: {
    count: 4,
    options: [
      "acrobatics", "athletics", "deception", "intimidation", "investigation", "sleight_of_hand", "perception", "insight",
      "persuasion", "stealth",
    ],
  },
  armor: ["Armaduras ligeras"],
  weapons: ["Armas sencillas", "Armas marciales con las propiedades ligera o sutil"],
  tools: ["Herramientas de ladrón"],
  weaponMasteryCount: 2,
  equipment: {
    A: {
      items: [
        "leather_armor", "dagger", "dagger", "shortsword", "shortbow", "text:20 flechas", "text:Aljaba",
        "text:Herramientas de ladrón", "text:Paquete de ladrón",
      ],
      gold: 8,
    },
    B: { items: [], gold: 100 },
    C: undefined,
  },
  spellcasting: null,
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "thief", name: "Ladrón", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Manos rápidas",
          summary: "Como acción adicional podés hacer una prueba de Destreza (Juego de manos) para robar, forzar una cerradura o desarmar una trampa con herramientas de ladrón, o usar un objeto con la acción de utilizar o de magia.",
        },
      },
      {
        level: 3,
        feature: {
          name: "Balconero",
          summary: "Tenés una velocidad trepando igual a tu velocidad y podés calcular tu distancia de salto con Destreza en lugar de Fuerza.",
        },
      },
    ],
  },
};
